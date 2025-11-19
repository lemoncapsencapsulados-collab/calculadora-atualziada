export interface ConfiguracaoCustos {
  id: string;
  nome: string;
  ativa: boolean;
  senha_protecao: string;
  
  // Custos Indiretos (valores por unidade)
  mao_obra_direta: number;
  energia_eletrica: number;
  depreciacao_maquinas: number;
  despesas_administrativas: number;
  
  // Percentuais de Impostos
  icms_credito_nf: number;
  icms_saida: number;
  credito_prodeic: number;
  fundeb_fundes: number;
  pis_cofins_saida: number;
  pis_cofins_credito: number;
  ipi_saida: number;
  irpj_csll: number;
  
  created_at: string;
  updated_at: string;
}

export interface MargemLucro {
  id: string;
  tipo_produto: 'Encapsulados' | 'Pó' | 'Gummy' | 'Líquido';
  margem_ideal: number;
  margem_minima: number;
  created_at: string;
}

export interface Precificacao {
  id: string;
  formula_id: string;
  configuracao_custos_id: string;
  
  // Custos Base
  custo_materia_prima: number;
  custo_embalagem: number;
  
  // Custos Indiretos
  custo_mao_obra_direta: number;
  custo_energia: number;
  custo_depreciacao: number;
  custo_administrativo: number;
  
  subtotal_custos_diretos: number;
  subtotal_custos_indiretos: number;
  margem_seguranca: number;
  total_custos_producao: number;
  
  // Impostos
  icms_credito_nf: number;
  icms_saida: number;
  icms_credito_prodeic: number;
  fundeb_fundes: number;
  icms_recolher: number;
  
  pis_cofins_saida: number;
  pis_cofins_credito: number;
  pis_cofins_recolher: number;
  
  ipi_valor: number;
  
  base_calculo_irpj_csll: number;
  irpj_csll_valor: number;
  
  total_impostos: number;
  
  // Resultado
  preco_venda: number;
  markup_bruto: number;
  margem_lucro_percentual: number;
  margem_lucro_valor: number;
  
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface PrecificacaoCalculada {
  // Custos
  custoMateriaPrima: number;
  custoEmbalagem: number;
  custoMaoObraDireta: number;
  custoEnergia: number;
  custoDepreciacao: number;
  custoAdministrativo: number;
  
  subtotalCustosDiretos: number;
  subtotalCustosIndiretos: number;
  margemSeguranca: number;
  totalCustosProducao: number;
  
  // Impostos detalhados
  icmsCreditoNF: number;
  icmsSaida: number;
  icmsCreditoProdeic: number;
  fundebFundes: number;
  icmsRecolher: number;
  
  pisCOFINSSaida: number;
  pisCOFINSCredito: number;
  pisCOFINSRecolher: number;
  
  ipiValor: number;
  
  baseCalculoIRPJCSLL: number;
  irpjCsllValor: number;
  
  totalImpostos: number;
  
  // Resultado
  precoVenda: number;
  markupBruto: number;
  margemLucroPercentual: number;
  margemLucroValor: number;
}
