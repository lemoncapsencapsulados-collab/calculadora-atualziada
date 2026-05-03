export interface DashboardFiltros {
  consultor: string | null;
  periodoTipo: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'customizado';
  dataInicio: Date;
  dataFim: Date;
}

export interface KPIsGerais {
  faturamentoTotal: number;
  entradaFinanceira: number;
  novasVendas: number;
  pipelineNegociacao: number;
  ticketMedio: number;
  taxaConversao: number;
  totalRecusados: number;
}

export interface MetricaConsultor {
  consultor: string;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  clientesUnicos: number;
}

export interface PipelineConsultor {
  consultor: string;
  propostas: number;
  valorTotal: number;
  ticketMedio: number;
  diasMedioAberto: number;
}

export interface ProdutoVendido {
  nome: string;
  quantidade: number;
  faturamento: number;
  percentualTotal: number;
}

export interface MixVendas {
  producao: {
    valor: number;
    percentual: number;
  };
  servicos: {
    valor: number;
    percentual: number;
  };
  equilibrado: boolean;
}

export interface InsightDashboard {
  tipo: 'alerta' | 'atencao' | 'positivo' | 'oportunidade';
  mensagem: string;
  consultor?: string;
  valor?: number;
  orcamento_id?: string;
  numero_orcamento?: string;
  observacao?: string;
  data_envio?: string;
  historico?: {
    primeiro_envio?: string;
    segundo_envio?: string;
    ultimo_contato?: string;
    ultimo_feedback?: string;
    total_envios: number;
    total_contatos: number;
    dias_desde_ultimo: number;
  };
}

export interface EvolucaoTemporal {
  periodo: string;
  faturamento: number;
  vendas: number;
  recorrencia: number;
}

export interface Recompra {
  id: string;
  nome_cliente: string;
  consultor_responsavel: string;
  data_recompra: string;
  produtos: RecompraProduto[];
  quantidade_total: number;
  valor_total: number;
  observacao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecompraProduto {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  modeloNegocio?: 'estoque' | 'print_on_demand';
  precificacaoId?: string;
  // Print on Demand: consumo em período personalizado
  podConsumoQuantidade?: number;
  podConsumoInicio?: string; // YYYY-MM-DD
  podConsumoFim?: string;    // YYYY-MM-DD
}

export interface MetricasRecorrencia {
  totalRecompras: number;
  percentualRecorrente: number;
  clientesRecorrentes: number;
  ticketMedioRecompra: number;
}

export interface PerfilCliente {
  canal: 'digital' | 'fisico' | 'ambos' | 'desconhecido';
  cidade?: string;
  estado?: string;
  tipoDocumento: 'cpf' | 'cnpj' | 'desconhecido';
}

export interface DistribuicaoCanal {
  canal: string;
  clientes: number;
  faturamento: number;
  ticketMedio: number;
}

export interface DistribuicaoConsultorStatus {
  consultor: string;
  aguardando_producao: number;
  no_estoque: number;
  enviado: number;
  concluido: number;
  total: number;
}

export interface OrcamentosPorConsultorStatus {
  consultor: string;
  rascunho: number;
  enviado: number;
  pago: number;
  recusado: number;
  valorRascunho: number;
  valorEnviado: number;
  valorPago: number;
  valorRecusado: number;
  total: number;
}
