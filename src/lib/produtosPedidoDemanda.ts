import { ProdutoPedido, SEGMENTOS } from '@/types/demandaMarca';

export function mapearTipoProduto(item: any): string {
  const raw = `${item?.tipo_produto || ''} ${item?.segmento || ''}`.toLowerCase();
  if (raw.includes('gummy')) return 'Gummy';
  if (raw.includes('sol')) return 'Solúvel';
  if (raw.includes('líquid') || raw.includes('liquid')) return 'Líquido';
  return 'Encapsulado';
}

/** O snapshot às vezes guarda em `segmento` o tipo do produto; só aproveitamos
 *  quando o valor bate com um segmento de marca conhecido. */
export function mapearSegmento(item: any): string {
  const bruto = String(item?.segmento || '').trim().toLowerCase();
  if (!bruto) return '';
  return SEGMENTOS.find((s) => s.toLowerCase() === bruto) || '';
}

/** Extrai os produtos fechados a partir do snapshot do orçamento do pedido */
export function extrairProdutosPedido(orcamentoSnapshot: any): ProdutoPedido[] {
  const itens = (orcamentoSnapshot?.itens_producao || []) as any[];
  if (!Array.isArray(itens)) return [];
  return itens.map((i) => ({
    nome_produto: i.nome_produto || 'Produto',
    tipo_produto: mapearTipoProduto(i),
    quantidade: Number(i.pod_consumo_quantidade) || Number(i.quantidade) || 0,
    segmento: mapearSegmento(i),
    quantidade_doses: Number(i.quantidade_doses) || undefined,
    quantidade_por_pote: Number(i.quantidade_por_pote) || undefined,
    quantidade_por_dose: Number(i.quantidade_por_dose) || undefined,
    unidade_por_dose: i.unidade_por_dose || undefined,
    unidade_por_pote: i.unidade_por_pote || i.unidade_por_dose || undefined,
    dose_diaria_sugerida: i.dose_diaria_sugerida || undefined,
    cor_pote: i.detalhes_producao?.cor_pote || undefined,
    cor_tampa: i.detalhes_producao?.cor_tampa || undefined,
    preco_unitario: Number(i.preco_unitario) || undefined,
    insumos: Array.isArray(i.insumos_formula)
      ? i.insumos_formula.map((ins: any) => ({
          nome: ins?.nome || '',
          quantidade: Number(ins?.quantidade) || undefined,
          unidade: ins?.unidade || undefined,
        }))
      : undefined,
  }));
}

export function produtosPedidoIguais(a: ProdutoPedido[] = [], b: ProdutoPedido[] = []): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}