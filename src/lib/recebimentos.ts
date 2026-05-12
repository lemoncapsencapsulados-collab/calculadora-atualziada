import { Pedido } from '@/types/formula';
import { CondicoesPagamento, ParcelaPixBoleto, CartaoPagamento } from '@/types/orcamento';
import { arredondarReais } from '@/lib/utils';

const JUROS_PARCELAS: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0.07, 5: 0.08, 6: 0.09,
};

export type StatusRecebimento = 'pago' | 'pendente' | 'futuro' | 'sem_data';

export interface Recebimento {
  pedidoId: string;
  numeroPedido: string;
  clienteNome: string;
  clienteDoc: string; // CNPJ ou CPF formatado se disponível
  consultor?: string;
  descricao: string;
  valor: number;
  data: string | null; // YYYY-MM-DD
  status: StatusRecebimento;
  metodo: string;
  indice: number; // posição da parcela dentro do pedido
}

const hojeStr = () => new Date().toISOString().slice(0, 10);

const addDiasISO = (iso: string | undefined | null, dias: number): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const calcularValorParcela = (p: ParcelaPixBoleto, valorTotal: number): number => {
  const v = p.tipo_valor === 'percentual' ? (p.valor / 100) * valorTotal : p.valor;
  return arredondarReais(v);
};

const calcularValorCartao = (c: CartaoPagamento, valorTotal: number): number => {
  const base = c.tipo_valor === 'percentual' ? (c.valor / 100) * valorTotal : c.valor;
  const taxa = JUROS_PARCELAS[c.parcelas] || 0;
  return arredondarReais(base * (1 + taxa));
};

const statusFromData = (data: string | null, pago?: boolean): StatusRecebimento => {
  if (pago) return 'pago';
  if (!data) return 'sem_data';
  const h = hojeStr();
  if (data > h) return 'futuro';
  return 'pendente';
};

const expandirParcelasPixBoleto = (
  parcelas: ParcelaPixBoleto[] | undefined,
  valorTotal: number,
  rotulo: string,
  startIdx: number,
  baseDataRef: string | null,
): Array<Omit<Recebimento, 'pedidoId' | 'numeroPedido' | 'clienteNome' | 'clienteDoc' | 'consultor' | 'metodo'>> => {
  if (!parcelas?.length) return [];
  return parcelas.map((p, i) => {
    const data = p.data_vencimento || (i === 0 ? baseDataRef : null);
    return {
      descricao: `${rotulo} ${i + 1}/${parcelas.length}${p.tipo_valor === 'percentual' ? ` (${p.valor}%)` : ''}`,
      valor: calcularValorParcela(p, valorTotal),
      data,
      status: statusFromData(data, p.pago),
      indice: startIdx + i,
    };
  });
};

const expandirCartoes = (
  cartoes: CartaoPagamento[] | undefined,
  valorTotal: number,
  rotulo: string,
  startIdx: number,
  baseDataRef: string | null,
): Array<Omit<Recebimento, 'pedidoId' | 'numeroPedido' | 'clienteNome' | 'clienteDoc' | 'consultor' | 'metodo'>> => {
  if (!cartoes?.length) return [];
  const out: Array<Omit<Recebimento, 'pedidoId' | 'numeroPedido' | 'clienteNome' | 'clienteDoc' | 'consultor' | 'metodo'>> = [];
  let idx = startIdx;
  cartoes.forEach((c, ci) => {
    const totalComJuros = calcularValorCartao(c, valorTotal);
    const valorParcela = arredondarReais(totalComJuros / c.parcelas);
    const baseData = c.data_primeira_parcela || baseDataRef;
    for (let i = 0; i < c.parcelas; i++) {
      const data = addDiasISO(baseData, i * 30);
      out.push({
        descricao: `${rotulo} ${ci + 1} — parcela ${i + 1}/${c.parcelas}`,
        valor: valorParcela,
        data,
        status: statusFromData(data, c.pago),
        indice: idx++,
      });
    }
  });
  return out;
};

export function derivarRecebimentos(pedido: Pedido): Recebimento[] {
  const snap: any = pedido.orcamento_snapshot || {};
  const cond: CondicoesPagamento | undefined = snap.condicoes_pagamento;
  const valorTotal = Number(snap.valor_total) || 0;
  if (!cond || valorTotal <= 0) return [];

  const baseData: string | null = snap.data_pagamento ? String(snap.data_pagamento).slice(0, 10) : null;

  const dadosCli = snap.dados_cliente || {};
  const tipoPessoa = dadosCli.tipo_pessoa || (dadosCli.cnpj ? 'pj' : 'pf');
  const clienteNome = dadosCli.nome_completo || dadosCli.razao_social || snap.nome_cliente || 'Cliente';
  const clienteDoc = (tipoPessoa === 'pj' ? (dadosCli.cnpj || '') : (dadosCli.cpf || '')) || '';
  const consultor = snap.consultor_responsavel || undefined;

  let parts: Array<Omit<Recebimento, 'pedidoId' | 'numeroPedido' | 'clienteNome' | 'clienteDoc' | 'consultor' | 'metodo'>> = [];
  let metodo = '';
  if (cond.metodo_principal === 'pix_boleto') {
    metodo = 'Pix / Boleto';
    parts = expandirParcelasPixBoleto(cond.parcelas_pix_boleto, valorTotal, 'Pix/Boleto', 0, baseData);
  } else if (cond.metodo_principal === 'cartao_credito') {
    metodo = 'Cartão de Crédito';
    parts = expandirCartoes(cond.cartoes, valorTotal, 'Cartão', 0, baseData);
  } else if (cond.metodo_principal === 'misto') {
    metodo = 'Misto';
    const a = expandirParcelasPixBoleto(cond.misto_parcelas_pix_boleto, valorTotal, 'Pix/Boleto', 0, baseData);
    const b = expandirCartoes(cond.misto_cartoes, valorTotal, 'Cartão', a.length, baseData);
    parts = [...a, ...b];
  } else {
    // Sem método estruturado: usa valor total + data única
    metodo = 'Pagamento único';
    parts = [{
      descricao: 'Pagamento integral',
      valor: arredondarReais(valorTotal),
      data: baseData,
      status: statusFromData(baseData, !!baseData),
      indice: 0,
    }];
  }

  return parts.map((p) => ({
    pedidoId: pedido.id,
    numeroPedido: pedido.numero_pedido,
    clienteNome,
    clienteDoc,
    consultor,
    metodo,
    ...p,
  }));
}
