import { Pedido } from '@/types/formula';
import { CondicoesPagamento, ParcelaPixBoleto, CartaoPagamento } from '@/types/orcamento';
import { arredondarReais } from '@/lib/utils';

export type StatusParcelaComissao = 'pago' | 'pendente' | 'vencido' | 'sem_data';

export interface ItemComissao {
  pedidoId: string;
  numeroPedido: string;
  clienteNome: string;
  clienteDoc: string;
  consultor: string;
  metodoPagamento: string;
  tipoVenda: 'nova_venda' | 'recompra';
  percentual: number; // 0.05 ou 0.01
  parcelaIndice: number;
  descricaoParcela: string;
  dataVencimento: string | null; // YYYY-MM-DD
  dataPagamento: string | null;  // YYYY-MM-DD — quando pago
  valorBruto: number; // o que o cliente paga (com juros)
  valorLiquido: number; // base de comissão (sem juros)
  comissao: number;
  status: StatusParcelaComissao;
  pago: boolean;
}

const JUROS_PARCELAS: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0.07, 5: 0.08, 6: 0.09,
};

const hojeStr = () => new Date().toISOString().slice(0, 10);

const addDiasISO = (iso: string | null, dias: number): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const statusFromData = (data: string | null, pago: boolean): StatusParcelaComissao => {
  if (pago) return 'pago';
  if (!data) return 'sem_data';
  return data < hojeStr() ? 'vencido' : 'pendente';
};

function isRecompra(pedido: Pedido): boolean {
  const snap: any = pedido.orcamento_snapshot || {};
  const tipo = snap.tipo_orcamento;
  if (tipo === 'recompra') return true;
  if (snap.is_recompra === true) return true;
  if (snap.origem_recompra_id) return true;
  return false;
}

function nomesCliente(pedido: Pedido): { nome: string; doc: string } {
  const snap: any = pedido.orcamento_snapshot || {};
  const dc = snap.dados_cliente || {};
  const tipoPessoa = dc.tipo_pessoa || (dc.cnpj ? 'pj' : 'pf');
  const nome = dc.nome_completo || dc.razao_social || snap.nome_cliente || 'Cliente';
  const doc = (tipoPessoa === 'pj' ? (dc.cnpj || '') : (dc.cpf || '')) || '';
  return { nome, doc };
}

function expandirPixBoleto(
  parcelas: ParcelaPixBoleto[] | undefined,
  valorTotal: number,
  rotulo: string,
  startIdx: number,
  baseDataRef: string | null,
) {
  if (!parcelas?.length) return [] as Array<{
    indice: number; desc: string; data: string | null;
    valorBruto: number; valorLiquido: number; pago: boolean;
  }>;
  return parcelas.map((p, i) => {
    const base = p.tipo_valor === 'percentual' ? (p.valor / 100) * valorTotal : p.valor;
    const data = p.data_vencimento || (i === 0 ? baseDataRef : null);
    return {
      indice: startIdx + i,
      desc: `${rotulo} ${i + 1}/${parcelas.length}${p.tipo_valor === 'percentual' ? ` (${p.valor}%)` : ''}`,
      data,
      dataPagamento: p.data_pagamento || null,
      valorBruto: arredondarReais(base),
      valorLiquido: arredondarReais(base),
      pago: !!p.pago,
    };
  });
}

function expandirCartoes(
  cartoes: CartaoPagamento[] | undefined,
  valorTotal: number,
  rotulo: string,
  startIdx: number,
  baseDataRef: string | null,
) {
  if (!cartoes?.length) return [] as Array<{
    indice: number; desc: string; data: string | null;
    dataPagamento: string | null;
    valorBruto: number; valorLiquido: number; pago: boolean;
  }>;
  const out: Array<{
    indice: number; desc: string; data: string | null;
    dataPagamento: string | null;
    valorBruto: number; valorLiquido: number; pago: boolean;
  }> = [];
  let idx = startIdx;
  cartoes.forEach((c, ci) => {
    const base = c.tipo_valor === 'percentual' ? (c.valor / 100) * valorTotal : c.valor;
    const taxa = JUROS_PARCELAS[c.parcelas] || 0;
    const totalBruto = base * (1 + taxa);
    const valorParcelaBruto = arredondarReais(totalBruto / c.parcelas);
    const valorParcelaLiquido = arredondarReais(base / c.parcelas);
    const baseData = c.data_primeira_parcela || baseDataRef;
    for (let i = 0; i < c.parcelas; i++) {
      const data = addDiasISO(baseData, i * 30);
      out.push({
        indice: idx++,
        desc: `${rotulo} ${ci + 1} — parcela ${i + 1}/${c.parcelas}`,
        data,
        dataPagamento: c.data_pagamento || null,
        valorBruto: valorParcelaBruto,
        valorLiquido: valorParcelaLiquido,
        pago: !!c.pago,
      });
    }
  });
  return out;
}

function metodoLabel(cond: CondicoesPagamento | undefined): string {
  if (!cond) return 'Pagamento único';
  if (cond.metodo_principal === 'pix_boleto') return 'Pix / Boleto';
  if (cond.metodo_principal === 'cartao_credito') return 'Cartão de Crédito';
  if (cond.metodo_principal === 'misto') return 'Misto';
  return 'Pagamento único';
}

export function derivarComissoes(pedido: Pedido): ItemComissao[] {
  const snap: any = pedido.orcamento_snapshot || {};
  const cond: CondicoesPagamento | undefined = snap.condicoes_pagamento;
  const valorTotal = Number(snap.valor_total) || 0;
  if (valorTotal <= 0) return [];

  const baseData: string | null = snap.data_pagamento ? String(snap.data_pagamento).slice(0, 10) : null;
  const recompra = isRecompra(pedido);
  const percentual = recompra ? 0.01 : 0.05;
  const consultor = snap.consultor_responsavel || '— Sem consultor —';
  const { nome, doc } = nomesCliente(pedido);
  const metodo = metodoLabel(cond);

  let parts: Array<{ indice: number; desc: string; data: string | null;
    valorBruto: number; valorLiquido: number; pago: boolean; }> = [];

  if (cond?.metodo_principal === 'pix_boleto') {
    parts = expandirPixBoleto(cond.parcelas_pix_boleto, valorTotal, 'Pix/Boleto', 0, baseData);
  } else if (cond?.metodo_principal === 'cartao_credito') {
    parts = expandirCartoes(cond.cartoes, valorTotal, 'Cartão', 0, baseData);
  } else if (cond?.metodo_principal === 'misto') {
    const a = expandirPixBoleto(cond.misto_parcelas_pix_boleto, valorTotal, 'Pix/Boleto', 0, baseData);
    const b = expandirCartoes(cond.misto_cartoes, valorTotal, 'Cartão', a.length, baseData);
    parts = [...a, ...b];
  } else {
    parts = [{
      indice: 0,
      desc: 'Pagamento integral',
      data: baseData,
      valorBruto: arredondarReais(valorTotal),
      valorLiquido: arredondarReais(valorTotal),
      pago: !!baseData,
    }];
  }

  return parts.map((p) => ({
    pedidoId: pedido.id,
    numeroPedido: pedido.numero_pedido,
    clienteNome: nome,
    clienteDoc: doc,
    consultor,
    metodoPagamento: metodo,
    tipoVenda: recompra ? 'recompra' : 'nova_venda',
    percentual,
    parcelaIndice: p.indice,
    descricaoParcela: p.desc,
    dataVencimento: p.data,
    valorBruto: p.valorBruto,
    valorLiquido: p.valorLiquido,
    comissao: arredondarReais(p.valorLiquido * percentual),
    status: statusFromData(p.data, p.pago),
    pago: p.pago,
  }));
}

export function pedidoEhRecompra(pedido: Pedido): boolean {
  return isRecompra(pedido);
}

export function percentualComissao(pedido: Pedido): number {
  return isRecompra(pedido) ? 0.01 : 0.05;
}

/** Localiza parcela em condições e marca pago=true/false, retornando novas condições. */
export function aplicarStatusPago(
  cond: CondicoesPagamento,
  parcelaIndice: number,
  pago: boolean,
): CondicoesPagamento {
  const clone: CondicoesPagamento = JSON.parse(JSON.stringify(cond || {}));
  let idx = 0;

  const aplicarEmPixBoleto = (lista?: ParcelaPixBoleto[]) => {
    if (!lista) return;
    for (const p of lista) {
      if (idx === parcelaIndice) p.pago = pago;
      idx++;
    }
  };
  const aplicarEmCartoes = (lista?: CartaoPagamento[]) => {
    if (!lista) return;
    for (const c of lista) {
      for (let i = 0; i < c.parcelas; i++) {
        if (idx === parcelaIndice) c.pago = pago;
        idx++;
      }
    }
  };

  if (clone.metodo_principal === 'pix_boleto') {
    aplicarEmPixBoleto(clone.parcelas_pix_boleto);
  } else if (clone.metodo_principal === 'cartao_credito') {
    aplicarEmCartoes(clone.cartoes);
  } else if (clone.metodo_principal === 'misto') {
    aplicarEmPixBoleto(clone.misto_parcelas_pix_boleto);
    aplicarEmCartoes(clone.misto_cartoes);
  }
  return clone;
}