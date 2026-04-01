import { ConfiguracaoCustos, PrecificacaoCalculada } from '@/types/precificacao';
import { arredondarReais } from '@/lib/utils';

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

/**
 * Calcula a precificação completa baseada no preço de venda desejado
 */
export function calcularPrecificacaoPorPreco(
  custosBase: CustosBase,
  custosIndiretos: CustosIndiretos,
  precoVenda: number,
  config: ConfiguracaoCustos
): PrecificacaoCalculada {
  // 1. Custos Diretos
  const subtotalCustosDiretos = 
    custosBase.custoMateriaPrima + 
    custosBase.custoEmbalagem + 
    custosIndiretos.maoObraDireta;

  // 2. Custos Indiretos
  const subtotalCustosIndiretos = 
    custosIndiretos.energia + 
    custosIndiretos.depreciacao + 
    custosIndiretos.administrativo;

  // 3. Total Custos de Produção Base
  const totalCustosProducaoBase = subtotalCustosDiretos + subtotalCustosIndiretos;
  
  // 4. Margem de Segurança (20% sobre custos base)
  const margemSeguranca = totalCustosProducaoBase * 0.20;
  
  // 5. Total Custos de Produção COM Margem de Segurança
  const totalCustosProducao = totalCustosProducaoBase + margemSeguranca;

  // 6. Cálculo de ICMS
  const icmsCreditoNF = (subtotalCustosDiretos * config.icms_credito_nf) / 100;
  const icmsSaida = (precoVenda * config.icms_saida) / 100;
  const icmsCreditoProdeic = (icmsSaida * config.credito_prodeic) / 100;
  const fundebFundes = (icmsSaida * config.fundeb_fundes) / 100;
  const icmsRecolher = icmsSaida - icmsCreditoNF - icmsCreditoProdeic + fundebFundes;

  // 7. Cálculo de PIS/COFINS
  const pisCOFINSSaida = (precoVenda * config.pis_cofins_saida) / 100;
  const pisCOFINSCredito = (subtotalCustosDiretos * config.pis_cofins_credito) / 100;
  const pisCOFINSRecolher = pisCOFINSSaida - pisCOFINSCredito;

  // 8. Cálculo de IPI
  const ipiValor = (precoVenda * config.ipi_saida) / 100;

  // 9. Base de Cálculo IRPJ e CSLL
  const baseCalculoIRPJCSLL = 
    precoVenda - 
    totalCustosProducao - 
    icmsRecolher - 
    pisCOFINSRecolher - 
    ipiValor;

  // 10. Cálculo IRPJ e CSLL
  const irpjCsllValor = (baseCalculoIRPJCSLL * config.irpj_csll) / 100;

  // 11. Total de Impostos
  const totalImpostos = icmsRecolher + pisCOFINSRecolher + ipiValor + irpjCsllValor;

  // 12. Margem de Lucro
  const margemLucroValor = precoVenda - totalCustosProducao - totalImpostos;
  const margemLucroPercentual = (margemLucroValor / precoVenda) * 100;

  // 13. Markup Bruto
  const markupBruto = ((precoVenda - totalCustosProducao) / totalCustosProducao) * 100;

  const r = arredondarReais;
  return {
    custoMateriaPrima: r(custosBase.custoMateriaPrima),
    custoEmbalagem: r(custosBase.custoEmbalagem),
    custoMaoObraDireta: r(custosIndiretos.maoObraDireta),
    custoEnergia: r(custosIndiretos.energia),
    custoDepreciacao: r(custosIndiretos.depreciacao),
    custoAdministrativo: r(custosIndiretos.administrativo),
    
    subtotalCustosDiretos: r(subtotalCustosDiretos),
    subtotalCustosIndiretos: r(subtotalCustosIndiretos),
    margemSeguranca: r(margemSeguranca),
    totalCustosProducao: r(totalCustosProducao),
    
    icmsCreditoNF: r(icmsCreditoNF),
    icmsSaida: r(icmsSaida),
    icmsCreditoProdeic: r(icmsCreditoProdeic),
    fundebFundes: r(fundebFundes),
    icmsRecolher: r(icmsRecolher),
    
    pisCOFINSSaida: r(pisCOFINSSaida),
    pisCOFINSCredito: r(pisCOFINSCredito),
    pisCOFINSRecolher: r(pisCOFINSRecolher),
    
    ipiValor: r(ipiValor),
    
    baseCalculoIRPJCSLL: r(baseCalculoIRPJCSLL),
    irpjCsllValor: r(irpjCsllValor),
    
    totalImpostos: r(totalImpostos),
    
    precoVenda: r(precoVenda),
    markupBruto: r(markupBruto),
    margemLucroPercentual: r(margemLucroPercentual),
    margemLucroValor: r(margemLucroValor),
  };
}

/**
 * Calcula a precificação completa baseada no markup bruto desejado
 * Usa iteração para encontrar o preço de venda que resulta no markup desejado
 */
export function calcularPrecificacaoPorMarkup(
  custosBase: CustosBase,
  custosIndiretos: CustosIndiretos,
  markupBrutoDesejado: number,
  config: ConfiguracaoCustos
): PrecificacaoCalculada {
  // Calcula total de custos primeiro
  const totalCustosProducao = 
    custosBase.custoMateriaPrima + 
    custosBase.custoEmbalagem + 
    custosIndiretos.maoObraDireta +
    custosIndiretos.energia + 
    custosIndiretos.depreciacao + 
    custosIndiretos.administrativo;

  // Estimativa inicial de preço usando markup simples
  let precoVenda = totalCustosProducao * (1 + markupBrutoDesejado / 100);
  
  // Iteração para encontrar o preço correto (considerando impostos)
  // Máximo de 50 iterações para convergir
  for (let i = 0; i < 50; i++) {
    const resultado = calcularPrecificacaoPorPreco(
      custosBase,
      custosIndiretos,
      precoVenda,
      config
    );
    
    const diferencaMarkup = Math.abs(resultado.markupBruto - markupBrutoDesejado);
    
    // Se a diferença for menor que 0.01%, encontramos o preço correto
    if (diferencaMarkup < 0.01) {
      return resultado;
    }
    
    // Ajusta o preço para próxima iteração
    if (resultado.markupBruto < markupBrutoDesejado) {
      precoVenda *= 1.01; // Aumenta 1%
    } else {
      precoVenda *= 0.99; // Diminui 1%
    }
  }
  
  // Retorna o último cálculo mesmo se não convergiu perfeitamente
  return calcularPrecificacaoPorPreco(
    custosBase,
    custosIndiretos,
    precoVenda,
    config
  );
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
