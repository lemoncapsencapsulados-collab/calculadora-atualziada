import type {
  ClienteEmAberto,
  InsightDashboard,
  PrioridadeCobranca,
  VendedorAgrupado,
} from '@/types/dashboard';

const STORAGE_KEY = 'dashboard_cobrancas_devolutiva';

export interface RegistroCobranca {
  cobradoEm: string; // ISO
  observacao?: string;
}

export type MapaCobrancas = Record<string, RegistroCobranca>;

export const chaveCobranca = (consultor: string, cliente: string) =>
  `${consultor.trim().toLowerCase()}::${cliente.trim().toLowerCase()}`;

export function lerCobrancas(): MapaCobrancas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MapaCobrancas) : {};
  } catch {
    return {};
  }
}

export function salvarCobrancas(mapa: MapaCobrancas) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    /* ignora quota/privacidade */
  }
}

export const PRIORIDADE_ORDEM: Record<PrioridadeCobranca, number> = {
  critico: 0,
  urgente: 1,
  atencao: 2,
  normal: 3,
};

export const PRIORIDADE_LABEL: Record<PrioridadeCobranca, string> = {
  critico: '🔴 Crítico',
  urgente: '🟠 Urgente',
  atencao: '🟡 Atenção',
  normal: '⚪ Normal',
};

function calcularPrioridade(temAlerta: boolean, dias: number): PrioridadeCobranca {
  if (temAlerta && dias > 10) return 'critico';
  if (temAlerta && dias >= 5) return 'urgente';
  if (dias > 5) return 'atencao';
  return 'normal';
}

/**
 * Agrupa os insights acionáveis (com cliente identificado) por vendedor e cliente.
 * Insights agregados (sem cliente) são ignorados nesta visão.
 */
export function agruparInsightsPorCliente(insights: InsightDashboard[]): VendedorAgrupado[] {
  const acionaveis = insights.filter(
    i => !!i.cliente && (i.tipo === 'alerta' || i.tipo === 'atencao')
  );

  const porVendedor = new Map<string, Map<string, ClienteEmAberto>>();

  acionaveis.forEach(i => {
    const consultor = (i.consultor || 'Sem consultor').trim();
    const cliente = (i.cliente || '').trim();
    if (!porVendedor.has(consultor)) porVendedor.set(consultor, new Map());
    const mapaClientes = porVendedor.get(consultor)!;
    const chave = cliente.toLowerCase();

    const atual: ClienteEmAberto = mapaClientes.get(chave) || {
      cliente,
      consultor,
      ultimoOrcamento: undefined,
      diasParado: 0,
      valorTotal: 0,
      qtdOrcamentos: 0,
      temAlerta: false,
      prioridade: 'normal',
      itens: [],
    };

    atual.valorTotal += Number(i.valor || 0);
    atual.qtdOrcamentos += 1;
    atual.temAlerta = atual.temAlerta || i.tipo === 'alerta';
    atual.diasParado = Math.max(atual.diasParado, i.dias_parado || 0);
    if (
      i.data_referencia &&
      (!atual.ultimoOrcamento || new Date(i.data_referencia) > new Date(atual.ultimoOrcamento))
    ) {
      atual.ultimoOrcamento = i.data_referencia;
    }
    atual.itens.push({
      orcamento_id: i.orcamento_id,
      numero_orcamento: i.numero_orcamento,
      valor: Number(i.valor || 0),
      situacao: i.situacao || i.mensagem,
      dias: i.dias_parado || 0,
      tipo: i.tipo,
      data_referencia: i.data_referencia,
    });

    mapaClientes.set(chave, atual);
  });

  const resultado: VendedorAgrupado[] = [];

  porVendedor.forEach((mapaClientes, consultor) => {
    const clientes = Array.from(mapaClientes.values()).map(c => ({
      ...c,
      prioridade: calcularPrioridade(c.temAlerta, c.diasParado),
      itens: c.itens.sort((a, b) => b.dias - a.dias),
    }));

    clientes.sort((a, b) => {
      const p = PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade];
      if (p !== 0) return p;
      if (b.diasParado !== a.diasParado) return b.diasParado - a.diasParado;
      return b.valorTotal - a.valorTotal;
    });

    resultado.push({
      consultor,
      clientes,
      totalClientes: clientes.length,
      totalAlertas: clientes.filter(c => c.temAlerta).length,
      totalAtencoes: clientes.filter(c => !c.temAlerta).length,
      valorTotal: clientes.reduce((acc, c) => acc + c.valorTotal, 0),
    });
  });

  return resultado.sort((a, b) => b.valorTotal - a.valorTotal);
}

export function gerarMensagemCobranca(cliente: ClienteEmAberto): string {
  const primeiroNome = cliente.consultor.split(' ')[0];
  const nomeFormatado =
    primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
  const principal = cliente.itens[0];
  const numero = principal?.numero_orcamento ? ` ${principal.numero_orcamento}` : '';
  const valor = cliente.valorTotal.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const plural = cliente.qtdOrcamentos > 1 ? `${cliente.qtdOrcamentos} orçamentos` : `O orçamento${numero}`;
  return `${nomeFormatado}, qual o status do cliente ${cliente.cliente}? ${plural} (${valor}) está em aberto há ${cliente.diasParado} ${cliente.diasParado === 1 ? 'dia' : 'dias'}. Preciso de uma devolutiva até hoje.`;
}