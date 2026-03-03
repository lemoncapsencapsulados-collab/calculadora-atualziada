export interface InsumoSnapshot {
  nome: string;
  quantidade: number;
  unidade: string;
}

export interface ItemProducao {
  tipo: 'precificacao' | 'avulso';
  precificacao_id?: string;
  nome_produto: string;
  segmento: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
  insumos_formula?: InsumoSnapshot[];
  modelo_negocio?: 'estoque' | 'print_on_demand';
  // Detalhes do produto
  quantidade_por_pote?: number;
  unidade_por_pote?: string;
  dose_diaria_sugerida?: string;
}

export interface ServicoMarca {
  nome_plano: string;
  descricao?: string;
  valor: number;
}

export interface DadosCliente {
  nome_completo?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  cnpj?: string;
  razao_social?: string;
  endereco_cnpj?: string;
  cep_cnpj?: string;
  cidade?: string;
  estado?: string;
  forma_venda?: 'locais_fisicos' | 'venda_digital' | 'ambas' | 'sem_informacao';
}

export interface PlanoFreteCustomizado {
  tipo_produto: string;
  plano: string;
  valor: number;
}

export interface DetalhamentoEnvio {
  tipo: 'total_produtor' | 'total_lemoncaps' | 'parcial';
  descricao_parcial?: string;
}

// Condições de pagamento estruturadas
export type FormaPagamentoTipo = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'outro';

export interface CondicoesPagamento {
  valor_entrada?: number;
  forma_pagamento_entrada?: FormaPagamentoTipo;
  descricao_entrada?: string;
  
  valor_termino?: number;
  usa_valor_restante?: boolean;
  forma_pagamento_termino?: FormaPagamentoTipo;
  descricao_termino?: string;
}

export interface DetalhamentoFrete {
  frete_lemon_caps: boolean;
  usa_tabela_tradicional: boolean;
  planos_customizados: PlanoFreteCustomizado[];
  detalhamento_envio?: DetalhamentoEnvio;
}

export interface Orcamento {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  consultor_responsavel?: string;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
  condicoes_pagamento?: CondicoesPagamento;
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  observacoes?: string;
  forma_pagamento?: string;
  validade_dias: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  data_pagamento?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoInsert {
  numero_orcamento: string;
  nome_cliente: string;
  consultor_responsavel?: string;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
  condicoes_pagamento?: CondicoesPagamento;
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  observacoes?: string;
  forma_pagamento?: string;
  validade_dias?: number;
  status?: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
}

export interface OrcamentoUpdate {
  nome_cliente?: string;
  consultor_responsavel?: string;
  itens_producao?: ItemProducao[];
  servicos_marca?: ServicoMarca[];
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
  condicoes_pagamento?: CondicoesPagamento;
  subtotal_producao?: number;
  subtotal_servicos?: number;
  valor_total?: number;
  observacoes?: string;
  forma_pagamento?: string;
  validade_dias?: number;
  status?: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
}

// Tabelas de frete padrão
export const TABELA_FRETE = {
  'Encapsulados': [
    { plano: 'Até 5 POTES', valor: 34.80 },
    { plano: '6 a 9 POTES', valor: 47.60 },
    { plano: '10 a 12 POTES', valor: 54.60 },
    { plano: '12+ POTES', valor: null, customizado: true }
  ],
  'Líquido': [
    { plano: 'Até 5 POTES', valor: 34.80 },
    { plano: '6 a 9 POTES', valor: 47.60 },
    { plano: '10 a 12 POTES', valor: 54.60 },
    { plano: '12+ POTES', valor: null, customizado: true }
  ],
  'Solúvel': [
    { plano: '1 POTE', valor: 48.50 },
    { plano: '2 POTES', valor: 51.50 },
    { plano: '3 a 5 POTES', valor: 54.40 },
    { plano: '6 a 7 POTES', valor: 62.90 },
    { plano: '8 a 10 POTES', valor: 65.90 },
    { plano: '10+ POTES', valor: null, customizado: true }
  ],
  'Gummy': [
    { plano: '1 POTE', valor: 48.70 },
    { plano: '2 a 3 POTES', valor: 50.20 },
    { plano: '4 a 7 POTES', valor: 54.50 },
    { plano: '8 a 10 POTES', valor: 63.40 },
    { plano: '10 a 12 POTES', valor: 67.10 },
    { plano: '12+ POTES', valor: null, customizado: true }
  ]
} as const;

export type TipoProdutoFrete = keyof typeof TABELA_FRETE;
