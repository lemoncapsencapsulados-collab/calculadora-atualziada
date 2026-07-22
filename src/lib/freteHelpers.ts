import { FreteCotacao } from '@/types/frete';
import { FreteMargemFaixa } from '@/types/frete';

export function formatBRL(v: number | null | undefined): string {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function labelFreteCotacao(cotacao: FreteCotacao | null | undefined): string {
  if (!cotacao) return 'Sem cotação';
  if (cotacao.tipo === 'estoque_proprio') {
    const status = cotacao.status === 'confirmado' ? 'Confirmado' : 'Pendente';
    return `EP · ${formatBRL(cotacao.valor_frete)} (${status})`;
  }
  return `POD · ${cotacao.tipo_produto || '-'} / Plano ${cotacao.pod_plano || '-'} · ${formatBRL(cotacao.pod_preco_por_envio)}/envio`;
}

export function linhaPdfFrete(cotacao: FreteCotacao | null | undefined): { titulo: string; nota?: string } | null {
  if (!cotacao) return null;
  if (cotacao.tipo === 'estoque_proprio') {
    return {
      titulo: `Frete estimado (Estoque Próprio): ${formatBRL(cotacao.valor_frete)}`,
      nota: 'Valor sujeito a confirmação após finalização da produção.',
    };
  }
  const selecionados = Array.isArray((cotacao as any).pod_planos_selecionados)
    ? ((cotacao as any).pod_planos_selecionados as { plano: number; preco_final: number }[])
    : [];
  if (selecionados.length > 1) {
    const opcoes = [...selecionados].sort((a, b) => a.plano - b.plano)
      .map(s => `Plano ${s.plano}: ${formatBRL(s.preco_final)}/envio`)
      .join(' · ');
    return {
      titulo: `Logística (Print on Demand) — ${cotacao.tipo_produto || '-'} — Opções: ${opcoes}`,
    };
  }
  return {
    titulo: `Logística (Print on Demand) — ${cotacao.tipo_produto || '-'} / Plano ${cotacao.pod_plano || '-'} frascos: ${formatBRL(cotacao.pod_preco_por_envio)}/envio`,
  };
}

/** Bloco estruturado para renderização no PDF de orçamento / proposta. */
export interface BlocoPdfFrete {
  titulo: string;
  tipo: 'estoque_proprio' | 'pod';
  tipoProduto?: string | null;
  nomeProduto?: string | null;
  quantEnviosMedio?: number | null;
  /** Para POD: lista { plano, preco_final } ordenada por plano. */
  planos?: { plano: number; precoEnvio: number }[];
  /** Para Estoque Próprio */
  valorFrete?: number | null;
  status?: string | null;
  nota?: string;
}

export function blocoPdfFrete(cotacao: FreteCotacao | null | undefined): BlocoPdfFrete | null {
  if (!cotacao) return null;
  if (cotacao.tipo === 'estoque_proprio') {
    return {
      titulo: 'Cotação de Frete — Estoque Próprio',
      tipo: 'estoque_proprio',
      tipoProduto: cotacao.tipo_produto,
      nomeProduto: cotacao.nome_produto,
      valorFrete: cotacao.valor_frete,
      status: cotacao.status === 'confirmado' ? 'Confirmado' : 'Pendente',
      nota: cotacao.status === 'confirmado' ? undefined : 'Valor sujeito a confirmação após finalização da produção.',
    };
  }
  const selecionados = Array.isArray((cotacao as any).pod_planos_selecionados)
    ? ((cotacao as any).pod_planos_selecionados as { plano: number; preco_final: number }[])
    : [];
  const planos = (selecionados.length > 0
    ? selecionados.map(s => ({ plano: Number(s.plano), precoEnvio: Number(s.preco_final) }))
    : (cotacao.pod_plano != null
      ? [{ plano: Number(cotacao.pod_plano), precoEnvio: Number(cotacao.pod_preco_por_envio || 0) }]
      : [])
  ).sort((a, b) => a.plano - b.plano);
  return {
    titulo: 'Cotação de Frete — Print on Demand',
    tipo: 'pod',
    tipoProduto: cotacao.tipo_produto,
    nomeProduto: cotacao.nome_produto,
    quantEnviosMedio: cotacao.pod_quantidade_envios_estimada,
    planos,
  };
}

export const IMPOSTO_POD_PADRAO = 12;

export function resolverMargemPorEnvios(envios: number | null | undefined, faixas: FreteMargemFaixa[]): FreteMargemFaixa | null {
  const ativas = faixas.filter(f => f.ativo).sort((a, b) => a.envios_min - b.envios_min);
  const n = Number(envios ?? 0);
  for (const f of ativas) {
    const max = f.envios_max ?? Number.POSITIVE_INFINITY;
    if (n >= f.envios_min && n <= max) return f;
  }
  return ativas[0] ?? null;
}

export interface CalcPodInput {
  frete: number;
  manuseio: number;
  margemPct: number;
  impostoPct?: number;
}

export interface CalcPodResult {
  base: number;
  margemValor: number;
  subtotal: number;
  impostoValor: number;
  precoFinal: number;
}

export function calcularPrecoPod({ frete, manuseio, margemPct, impostoPct = IMPOSTO_POD_PADRAO }: CalcPodInput): CalcPodResult {
  const base = Number(frete || 0) + Number(manuseio || 0);
  const margemValor = base * (Number(margemPct || 0) / 100);
  const subtotal = base + margemValor;
  const impostoValor = subtotal * (Number(impostoPct || 0) / 100);
  const precoFinal = subtotal + impostoValor;
  return { base, margemValor, subtotal, impostoValor, precoFinal };
}

/**
 * Inverso de calcularPrecoPod: dado um preço final desejado, calcula qual
 * margem sobra depois de descontar imposto, frete e manuseio.
 *   precoLiquido = precoFinal / (1 + imposto%)
 *   margemValor  = precoLiquido − frete − manuseio
 *   margemPct    = margemValor / precoLiquido × 100
 */
export interface MargemPorPrecoInput {
  precoFinal: number;
  frete: number;
  manuseio: number;
  impostoPct?: number;
}
export interface MargemPorPrecoResult {
  precoLiquido: number;
  base: number;
  impostoValor: number;
  margemValor: number;
  margemPercentual: number;
}
export function calcularMargemPorPreco({ precoFinal, frete, manuseio, impostoPct = IMPOSTO_POD_PADRAO }: MargemPorPrecoInput): MargemPorPrecoResult {
  const preco = Number(precoFinal || 0);
  const imp = Number(impostoPct || 0) / 100;
  const precoLiquido = preco / (1 + imp);
  const impostoValor = preco - precoLiquido;
  const base = Number(frete || 0) + Number(manuseio || 0);
  const margemValor = precoLiquido - base;
  const margemPercentual = precoLiquido > 0 ? (margemValor / precoLiquido) * 100 : 0;
  return { precoLiquido, base, impostoValor, margemValor, margemPercentual };
}

export function descreverFaixa(f: FreteMargemFaixa | null): string {
  if (!f) return '—';
  const max = f.envios_max ?? null;
  const range = max == null ? `acima de ${f.envios_min - 1}` : `${f.envios_min}–${max}`;
  return `${range} envios/mês → ${Number(f.margem_percentual)}%`;
}