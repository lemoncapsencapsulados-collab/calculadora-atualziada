import { ConfiguracaoCustos, PrecificacaoCalculada } from '@/types/precificacao';
import { arredondarCusto, arredondarReais } from '@/lib/utils';

interface CustosBase {
  custoMateriaPrima: number;
  custoEmbalagem: number;
}

interface CustosIndiretos {
  maoObraDireta: number;
  energia: number;
  depreciacao: number;
  administrativo: number;
}

const OVERHEAD_PADRAO = 3;
export const ALIQUOTA_IMPOSTO = 0.12;

/**
 * Margem líquida (%) = (1 - custo/preço - imposto) * 100
 * Fonte única usada tanto na tela de Precificação quanto no Gerar Orçamento.
 */
export function calcularMargemLiquida(preco: number, custoUnit: number): number {
  if (!preco || preco <= 0) return 0;
  return (1 - custoUnit / preco - ALIQUOTA_IMPOSTO) * 100;
}

function overheadDaConfig(config: ConfiguracaoCustos | null | undefined): number {
  const v = Number((config as any)?.overhead_unitario);
  return Number.isFinite(v) && v > 0 ? v : OVERHEAD_PADRAO;
}

/**
 * Formação de preço simplificada:
 *   Total de custos = Matéria-Prima + Embalagem + Overhead (config, padrão R$ 3,00)
 *   Impostos       = 12% sobre o preço de venda
 *   Margem         = Preço - Custos - Impostos
 *
 * O parâmetro `custosIndiretos` é ignorado e mantido apenas por compatibilidade
 * com telas legadas (Editar Precificação, Histórico) que passam esses valores.
 */
export function calcularPrecificacaoPorPreco(
  custosBase: CustosBase,
  _custosIndiretos: CustosIndiretos,
  precoVenda: number,
  config: ConfiguracaoCustos
): PrecificacaoCalculada {
  const overhead = overheadDaConfig(config);
  const custoMP = Number(custosBase.custoMateriaPrima) || 0;
  const custoEmb = Number(custosBase.custoEmbalagem) || 0;

  const totalCustosProducao = custoMP + custoEmb + overhead;
  const totalImpostos = precoVenda * ALIQUOTA_IMPOSTO;
  const margemLucroValor = precoVenda - totalCustosProducao - totalImpostos;
  const margemLucroPercentual = precoVenda > 0 ? (margemLucroValor / precoVenda) * 100 : 0;
  const markupBruto = totalCustosProducao > 0
    ? ((precoVenda - totalCustosProducao) / totalCustosProducao) * 100
    : 0;

  // Custos vao com 6 casas: arredondar para centavos zera dose micro e ela
  // desaparece do montante. A exibicao continua mostrando em reais.
  const r = arredondarCusto;
  return {
    custoMateriaPrima: r(custoMP),
    custoEmbalagem: r(custoEmb),
    custoMaoObraDireta: r(overhead), // overhead exibido como "custo indireto"
    custoEnergia: 0,
    custoDepreciacao: 0,
    custoAdministrativo: 0,

    subtotalCustosDiretos: r(custoMP + custoEmb),
    subtotalCustosIndiretos: r(overhead),
    margemSeguranca: 0,
    totalCustosProducao: r(totalCustosProducao),

    icmsCreditoNF: 0,
    icmsSaida: 0,
    icmsCreditoProdeic: 0,
    fundebFundes: 0,
    icmsRecolher: 0,

    pisCOFINSSaida: 0,
    pisCOFINSCredito: 0,
    pisCOFINSRecolher: 0,

    ipiValor: 0,

    baseCalculoIRPJCSLL: 0,
    irpjCsllValor: 0,

    totalImpostos: r(totalImpostos),

    precoVenda: r(precoVenda),
    markupBruto: r(markupBruto),
    margemLucroPercentual: r(margemLucroPercentual),
    margemLucroValor: r(margemLucroValor),
  };
}

/**
 * Configuração de margens por tipo de produto
 * Regras atualizadas conforme especificação
 */
interface MargemConfig {
  minima: number;
  idealInicio: number;
  idealFim: number;
}

const MARGENS_CONFIG: Record<string, MargemConfig> = {
  'Gummy': { minima: 25, idealInicio: 25.01, idealFim: 32 },
  'Solúvel': { minima: 18, idealInicio: 20, idealFim: 25 },
  'Encapsulados': { minima: 15, idealInicio: 18, idealFim: 23 },
  'Líquido': { minima: 15, idealInicio: 18, idealFim: 23 },
  'Setup': { minima: 15, idealInicio: 20, idealFim: 25 },
};

export interface ValidacaoMargemResult {
  status: 'baixa' | 'aceitavel' | 'ideal' | 'excelente';
  mensagem: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Valida a margem de lucro por tipo de produto com 4 níveis:
 * - baixa (vermelho): abaixo do mínimo
 * - aceitavel (amarelo): entre mínimo e início do ideal
 * - ideal (verde): dentro da faixa ideal
 * - excelente (dourado): acima do ideal
 */
export function validarMargemPorTipo(
  margemCalculada: number,
  tipoProduto: string
): ValidacaoMargemResult {
  const config = MARGENS_CONFIG[tipoProduto] || MARGENS_CONFIG['Encapsulados'];
  
  if (margemCalculada < config.minima) {
    return {
      status: 'baixa',
      mensagem: `⚠️ Margem abaixo do mínimo! Mínimo: ${config.minima}%`,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
    };
  } else if (margemCalculada < config.idealInicio) {
    return {
      status: 'aceitavel',
      mensagem: `Margem aceitável. Ideal: ${config.idealInicio}% a ${config.idealFim}%`,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-500',
    };
  } else if (margemCalculada <= config.idealFim) {
    return {
      status: 'ideal',
      mensagem: `✅ Excelente! Margem ideal atingida!`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
    };
  } else {
    return {
      status: 'excelente',
      mensagem: 'VOCÊ VAI FAZER A LEMON RICA',
      color: 'text-amber-600',
      bgColor: 'gold-shimmer',
      borderColor: 'border-amber-500',
    };
  }
}

/**
 * Valida se a margem está dentro dos limites aceitáveis (função legada mantida para compatibilidade)
 */
export function validarMargem(
  margemCalculada: number,
  margemIdeal: number,
  margemMinima: number
): {
  status: 'ideal' | 'aceitavel' | 'baixa';
  mensagem: string;
  color: string;
} {
  if (margemCalculada >= margemIdeal) {
    return {
      status: 'ideal',
      mensagem: `Excelente! Margem acima do ideal (${margemIdeal}%)`,
      color: 'text-green-600',
    };
  } else if (margemCalculada >= margemMinima) {
    return {
      status: 'aceitavel',
      mensagem: `Margem aceitável. Ideal seria ${margemIdeal}%`,
      color: 'text-yellow-600',
    };
  } else {
    return {
      status: 'baixa',
      mensagem: `⚠️ Margem abaixo do mínimo! Mínimo: ${margemMinima}%`,
      color: 'text-red-600',
    };
  }
}

/**
 * Preco que devolve uma margem liquida alvo, dado o custo de producao.
 *
 * Da definicao de margem, com imposto proporcional ao preco:
 *   margem = (preco - custo - preco*aliquota) / preco
 *   margem = (1 - aliquota) - custo/preco
 *   preco  = custo / (1 - aliquota - margem)
 *
 * Devolve null quando a margem alvo e' inalcancavel -- a partir de
 * (1 - aliquota) nao existe preco finito que a satisfaca.
 */
export function precoParaMargem(
  custoProducao: number,
  margemPercentual: number,
): number | null {
  const custo = Number(custoProducao);
  const margem = Number(margemPercentual) / 100;
  if (!Number.isFinite(custo) || custo <= 0) return null;
  const denominador = 1 - ALIQUOTA_IMPOSTO - margem;
  if (!Number.isFinite(denominador) || denominador <= 0) return null;
  return arredondarReais(custo / denominador);
}
