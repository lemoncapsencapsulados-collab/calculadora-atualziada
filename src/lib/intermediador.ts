import { ALIQUOTA_IMPOSTO } from '@/lib/precificacaoCalculator';
import type { IntermediadorOrcamento } from '@/types/orcamento';

export const PERCENTUAL_PRIMEIRA_COMPRA = 3;
export const PERCENTUAL_RECOMPRA = 1;

export interface ResumoIntermediador {
  base: number;
  percentual: number;
  comissao: number;
  // Produção
  receitaProducao: number;
  custoProducao: number;
  impostoProducao: number;
  margemProducaoAntes: number;
  comissaoProducao: number;
  margemProducaoDepois: number;
  // Setup
  receitaSetup: number;
  custoSetup: number;
  margemSetupAntes: number;
  comissaoSetup: number;
  margemSetupDepois: number;
  // Totais
  margemTotalAntes: number;
  margemTotalDepois: number;
  margemTotalDepoisPct: number;
}

interface Params {
  /** Receita de produção (subtotal dos produtos) */
  receitaProducao: number;
  /** Custo total de produção (custo unitário × quantidade) */
  custoProducao: number;
  /** Receita de setup + estabilidade/anvisa (subtotal de serviços) */
  receitaSetup: number;
  /** Custo conhecido de setup + estabilidade/anvisa */
  custoSetup: number;
  percentual: number;
}

/** Calcula comissão do intermediador e o impacto na margem da Lemon Caps. */
export function calcularResumoIntermediador({
  receitaProducao,
  custoProducao,
  receitaSetup,
  custoSetup,
  percentual,
}: Params): ResumoIntermediador {
  const base = receitaProducao + receitaSetup;
  const comissao = base * (percentual / 100);

  const impostoProducao = receitaProducao * ALIQUOTA_IMPOSTO;
  const margemProducaoAntes = receitaProducao - custoProducao - impostoProducao;
  const margemSetupAntes = receitaSetup - custoSetup;

  // Rateio da comissão proporcional à receita de cada bloco
  const pesoProducao = base > 0 ? receitaProducao / base : 0;
  const comissaoProducao = comissao * pesoProducao;
  const comissaoSetup = comissao - comissaoProducao;

  const margemProducaoDepois = margemProducaoAntes - comissaoProducao;
  const margemSetupDepois = margemSetupAntes - comissaoSetup;
  const margemTotalAntes = margemProducaoAntes + margemSetupAntes;
  const margemTotalDepois = margemProducaoDepois + margemSetupDepois;

  return {
    base,
    percentual,
    comissao,
    receitaProducao,
    custoProducao,
    impostoProducao,
    margemProducaoAntes,
    comissaoProducao,
    margemProducaoDepois,
    receitaSetup,
    custoSetup,
    margemSetupAntes,
    comissaoSetup,
    margemSetupDepois,
    margemTotalAntes,
    margemTotalDepois,
    margemTotalDepoisPct: base > 0 ? (margemTotalDepois / base) * 100 : 0,
  };
}

export function percentualPadraoPorTipo(tipo: string | undefined): number {
  return tipo === 'recompra' ? PERCENTUAL_RECOMPRA : PERCENTUAL_PRIMEIRA_COMPRA;
}

export function rotuloBaseIntermediador(base: IntermediadorOrcamento['tipo_base']): string {
  return base === 'recompra' ? 'Recompra' : 'Primeira compra';
}

export interface ItemComCusto {
  nome: string;
  preco_unitario: number;
  quantidade: number;
  custoUnit: number;
}

export interface ImpactoItemIntermediador {
  nome: string;
  precoUnitario: number;
  quantidade: number;
  custoUnit: number;
  subtotal: number;
  comissaoItem: number;
  comissaoPorPote: number;
  margemAntesPct: number;
  margemDepoisPct: number;
  quedaPp: number;
  temCusto: boolean;
}

/**
 * Impacto da comissão do intermediador por produto/pote.
 * A comissão total é rateada proporcionalmente ao subtotal de cada item sobre a base.
 */
export function calcularImpactoPorItem(
  itens: ItemComCusto[],
  comissaoTotal: number,
  base: number
): ImpactoItemIntermediador[] {
  return itens.map((it) => {
    const preco = Number(it.preco_unitario) || 0;
    const qtd = Number(it.quantidade) || 0;
    const subtotal = preco * qtd;
    const comissaoItem = base > 0 ? comissaoTotal * (subtotal / base) : 0;
    const comissaoPorPote = qtd > 0 ? comissaoItem / qtd : 0;
    const temCusto = (Number(it.custoUnit) || 0) > 0;
    const margemAntesPct = temCusto ? calcularMargemLiquida(preco, it.custoUnit) : 0;
    const quedaPp = preco > 0 ? (comissaoPorPote / preco) * 100 : 0;
    return {
      nome: it.nome,
      precoUnitario: preco,
      quantidade: qtd,
      custoUnit: Number(it.custoUnit) || 0,
      subtotal,
      comissaoItem,
      comissaoPorPote,
      margemAntesPct,
      margemDepoisPct: margemAntesPct - quedaPp,
      quedaPp,
      temCusto,
    };
  });
}
