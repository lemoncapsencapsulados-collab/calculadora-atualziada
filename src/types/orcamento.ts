export interface InsumoSnapshot {
  nome: string;
  quantidade: number;
  unidade: string;
}

export interface DetalhesProducao {
  cor_tampa?: string;
  cor_pote?: string;
  cor_gummy?: string;
  sabor_gummy?: string;
  sabor_soluvel?: string;
  cor_soluvel?: string;
  sabor_liquido?: string;
  cor_liquido?: string;
  observacao_producao?: string;
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
  tipo_produto?: string;
  quantidade_por_pote?: number;
  unidade_por_pote?: string;
  quantidade_por_dose?: number;
  unidade_por_dose?: string;
  quantidade_doses?: number;
  dose_diaria_sugerida?: string;
  // Detalhes de produção (preenchidos na aprovação)
  detalhes_producao?: DetalhesProducao;
  // Print on Demand: registro de consumo em período (opcional)
  pod_consumo_quantidade?: number;
  pod_consumo_inicio?: string; // YYYY-MM-DD
  pod_consumo_fim?: string;    // YYYY-MM-DD
}

export interface Entregavel {
  nome: string;
  incluso: boolean;
  quantidade: number;
}

export interface ServicoMarca {
  nome_plano: string;
  descricao?: string;
  valor: number;
  entregaveis?: Entregavel[];
}

export interface PessoaFisicaResponsavel {
  nome?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  email?: string;
  estado_civil?: string;
}

export interface DadosCliente {
  tipo_pessoa?: 'pj' | 'pf';
  // PJ fields
  cnpj?: string;
  razao_social?: string;
  inscricao_municipal?: string;
  inscricao_estadual?: string;
  endereco_cnpj?: string;
  numero_cnpj?: string;
  bairro_cnpj?: string;
  cep_cnpj?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  email?: string;
  // PJ - responsável PF (QSA)
  responsavel_pj?: PessoaFisicaResponsavel;
  // PF - lista de pessoas físicas
  pessoas_fisicas?: PessoaFisicaResponsavel[];
  // Legados (manter compatibilidade)
  nome_completo?: string;
  cpf?: string;
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
export type MetodoPagamentoPrincipal = 'pix_boleto' | 'cartao_credito' | 'misto';
export type FormaPagamentoAvista = 'pix' | 'transferencia' | 'debito' | 'boleto';

export interface ParcelaPixBoleto {
  tipo_valor: 'percentual' | 'fixo';
  valor: number;
  data_vencimento?: string; // YYYY-MM-DD
  pago?: boolean;
  data_pagamento?: string; // YYYY-MM-DD — data em que foi efetivamente pago
}

export interface CartaoPagamento {
  tipo_valor: 'percentual' | 'fixo';
  valor: number;
  parcelas: number;
  data_primeira_parcela?: string; // YYYY-MM-DD
  pago?: boolean;
  data_pagamento?: string; // YYYY-MM-DD — data em que foi efetivamente pago
}

export interface CondicoesPagamento {
  metodo_principal?: MetodoPagamentoPrincipal;
  // Pix/Boleto
  parcelas_pix_boleto?: ParcelaPixBoleto[];
  // Cartão de crédito
  cartoes?: CartaoPagamento[];
  // Misto
  misto_parcelas_pix_boleto?: ParcelaPixBoleto[];
  misto_cartoes?: CartaoPagamento[];
  // Pagamento único (sem estrutura de parcelas) — confirmação manual
  pagamento_unico_pago?: boolean;
  pagamento_unico_data_pagamento?: string; // YYYY-MM-DD
  // Campos legados (manter compatibilidade)
  forma_avista?: FormaPagamentoAvista;
  parcelas_cartao?: number;
  valor_avista?: number;
  forma_avista_fracionado?: FormaPagamentoAvista;
  parcelas_cartao_fracionado?: number;
  valor_cartao1?: number;
  parcelas_cartao1?: number;
  parcelas_cartao2?: number;
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

export type TipoOrcamento = 'novo_produtor' | 'recompra';

export interface IntermediadorOrcamento {
  nome: string;
  whatsapp: string;
  percentual: number;
  tipo_base: 'primeira_compra' | 'recompra';
  valor_comissao: number;
}

export type TipoContato = 'envio' | 'contato';

export interface ContatoOrcamento {
  id: string;
  data: string; // ISO timestamp
  tipo: TipoContato;
  observacao: string;
}

export interface OrcamentoSnapshot {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  consultor_responsavel?: string;
  tipo_orcamento: TipoOrcamento;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
  condicoes_pagamento?: CondicoesPagamento;
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  data_pagamento?: string;
  observacoes?: string;
  updated_at?: string;
}

export interface Orcamento {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  cliente_id?: string;
  consultor_responsavel?: string;
  tipo_orcamento: TipoOrcamento;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
  condicoes_pagamento?: CondicoesPagamento;
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  observacoes?: string;
  observacoes_internas?: string | null;
  forma_pagamento?: string;
  validade_dias: number;
  status: 'rascunho' | 'enviado' | 'pago' | 'recusado';
  data_pagamento?: string | null;
  data_envio?: string | null;
  historico_contatos?: ContatoOrcamento[];
  created_at: string;
  updated_at: string;
}

export interface OrcamentoInsert {
  numero_orcamento: string;
  nome_cliente: string;
  cliente_id?: string;
  consultor_responsavel?: string;
  tipo_orcamento?: TipoOrcamento;
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
  status?: 'rascunho' | 'enviado' | 'pago' | 'recusado';
}

export interface OrcamentoUpdate {
  nome_cliente?: string;
  cliente_id?: string;
  consultor_responsavel?: string;
  tipo_orcamento?: TipoOrcamento;
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
  status?: 'rascunho' | 'enviado' | 'pago' | 'recusado';
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
