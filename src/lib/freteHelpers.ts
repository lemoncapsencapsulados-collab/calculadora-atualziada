import { FreteCotacao } from '@/types/frete';

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
  return {
    titulo: `Logística (Print on Demand) — ${cotacao.tipo_produto || '-'} / Plano ${cotacao.pod_plano || '-'} frascos: ${formatBRL(cotacao.pod_preco_por_envio)}/envio`,
  };
}