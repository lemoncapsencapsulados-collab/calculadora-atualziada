import type {
  ClienteEmAberto,
  InsightDashboard,
  OrcamentoDetalhado,
  OrcamentoEmAberto,
  PrioridadeCobranca,
  StatusOrcamentoDetalhado,
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
  critico: 'Crítico',
  urgente: 'Urgente',
  atencao: 'Atenção',
  normal: 'Normal',
};

export const STATUS_LABEL: Record<StatusOrcamentoDetalhado, string> = {
  rascunho: 'Criado',
  enviado: 'Enviado',
  pago: 'Pago',
  recusado: 'Recusado',
  outro: 'Outro',
};

function calcularPrioridade(temAlerta: boolean, dias: number): PrioridadeCobranca {
  if (temAlerta && dias > 10) return 'critico';
  if (temAlerta && dias >= 5) return 'urgente';
  if (dias > 5) return 'atencao';
  return 'normal';
}

const contagensVazias = (): Record<StatusOrcamentoDetalhado, number> => ({
  rascunho: 0,
  enviado: 0,
  pago: 0,
  recusado: 0,
  outro: 0,
});

const novoCliente = (cliente: string, consultor: string): ClienteEmAberto => ({
  cliente,
  consultor,
  ultimoOrcamento: undefined,
  diasParado: 0,
  valorTotal: 0,
  valorEmAberto: 0,
  qtdOrcamentos: 0,
  temAlerta: false,
  prioridade: 'normal',
  itens: [],
  contagens: contagensVazias(),
});

/**
 * Agrupa TODOS os orçamentos (qualquer status) por vendedor e cliente, somando
 * também os insights de pedidos em produção (que não têm orçamento na lista).
 */
export function agruparInsightsPorCliente(
  orcamentos: OrcamentoDetalhado[],
  insightsExtras: InsightDashboard[] = []
): VendedorAgrupado[] {
  const porVendedor = new Map<string, Map<string, ClienteEmAberto>>();

  const obterCliente = (consultor: string, cliente: string): ClienteEmAberto => {
    if (!porVendedor.has(consultor)) porVendedor.set(consultor, new Map());
    const mapa = porVendedor.get(consultor)!;
    const chave = cliente.toLowerCase();
    if (!mapa.has(chave)) mapa.set(chave, novoCliente(cliente, consultor));
    return mapa.get(chave)!;
  };

  const registrar = (alvo: ClienteEmAberto, item: OrcamentoEmAberto, alerta: boolean) => {
    alvo.valorTotal += item.valor;
    if (item.emAberto) alvo.valorEmAberto = (alvo.valorEmAberto || 0) + item.valor;
    alvo.qtdOrcamentos += 1;
    alvo.temAlerta = alvo.temAlerta || alerta;
    if (item.emAberto) alvo.diasParado = Math.max(alvo.diasParado, item.dias);
    if (
      item.data_referencia &&
      (!alvo.ultimoOrcamento || new Date(item.data_referencia) > new Date(alvo.ultimoOrcamento))
    ) {
      alvo.ultimoOrcamento = item.data_referencia;
    }
    alvo.itens.push(item);
  };

  orcamentos.forEach(o => {
    const alvo = obterCliente(o.consultor || 'Sem consultor', o.cliente || 'Sem cliente');
    const alerta =
      (o.status === 'enviado' && o.dias_parado > 14) || (o.status === 'rascunho' && o.dias_parado > 5);
    alvo.contagens![o.status] += 1;
    registrar(
      alvo,
      {
        orcamento_id: o.orcamento_id,
        numero_orcamento: o.numero_orcamento,
        valor: o.valor,
        situacao: o.situacao,
        dias: o.dias_parado,
        tipo: alerta ? 'alerta' : o.emAberto ? 'atencao' : 'positivo',
        data_referencia: o.data_referencia,
        status: o.status,
        created_at: o.created_at,
        data_envio: o.data_envio,
        observacao: o.observacao,
        foraDoPeriodo: o.foraDoPeriodo,
        emAberto: o.emAberto,
      },
      alerta
    );
  });

  // Insights sem orçamento vinculado (ex.: pedidos aguardando produção)
  insightsExtras
    .filter(i => !!i.cliente && !i.orcamento_id && (i.tipo === 'alerta' || i.tipo === 'atencao'))
    .forEach(i => {
      const alvo = obterCliente((i.consultor || 'Sem consultor').trim(), (i.cliente || '').trim());
      alvo.contagens!.outro += 1;
      registrar(
        alvo,
        {
          orcamento_id: i.orcamento_id,
          numero_orcamento: i.numero_orcamento,
          valor: Number(i.valor || 0),
          situacao: i.situacao || i.mensagem,
          dias: i.dias_parado || 0,
          tipo: i.tipo,
          data_referencia: i.data_referencia,
          status: 'outro',
          emAberto: true,
        },
        i.tipo === 'alerta'
      );
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
      totalAtencoes: clientes.filter(c => !c.temAlerta && (c.valorEmAberto || 0) > 0).length,
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