import type { ContatoOrcamento } from '@/types/orcamento';
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
  /** Nome do cliente (quando o insight é de um orçamento/pedido específico) */
  cliente?: string;
  /** Dias sem atualização do item */
  dias_parado?: number;
  /** Data de referência (último orçamento/atualização) em ISO */
  data_referencia?: string;
  /** Situação curta do item, ex.: "Rascunho há 6 dias" */
  situacao?: string;
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

export type PrioridadeCobranca = 'critico' | 'urgente' | 'atencao' | 'normal';

export type StatusOrcamentoDetalhado = 'rascunho' | 'enviado' | 'pago' | 'recusado' | 'outro';

/** Orçamento normalizado para a visão "Por cliente" do Dashboard */
export interface OrcamentoDetalhado {
  orcamento_id: string;
  numero_orcamento?: string;
  cliente: string;
  consultor: string;
  status: StatusOrcamentoDetalhado;
  valor: number;
  created_at?: string;
  data_envio?: string;
  /** Data usada para calcular dias parado (último contato/envio/criação) */
  data_referencia?: string;
  dias_parado: number;
  situacao: string;
  observacao?: string;
  /** true quando o orçamento é anterior ao período mas continua em aberto */
  foraDoPeriodo?: boolean;
  emAberto: boolean;
  /** Historico completo, para a Analise de Orcamentos montar a linha do tempo. */
  historico_contatos?: ContatoOrcamento[];
}

export interface OrcamentoEmAberto {
  orcamento_id?: string;
  numero_orcamento?: string;
  valor: number;
  situacao: string;
  dias: number;
  tipo: InsightDashboard['tipo'];
  data_referencia?: string;
  status?: StatusOrcamentoDetalhado;
  created_at?: string;
  data_envio?: string;
  observacao?: string;
  foraDoPeriodo?: boolean;
  emAberto?: boolean;
}

export interface ClienteEmAberto {
  cliente: string;
  consultor: string;
  ultimoOrcamento?: string;
  diasParado: number;
  valorTotal: number;
  qtdOrcamentos: number;
  temAlerta: boolean;
  prioridade: PrioridadeCobranca;
  itens: OrcamentoEmAberto[];
  valorEmAberto?: number;
  contagens?: Record<StatusOrcamentoDetalhado, number>;
}

export interface VendedorAgrupado {
  consultor: string;
  clientes: ClienteEmAberto[];
  totalClientes: number;
  totalAlertas: number;
  totalAtencoes: number;
  valorTotal: number;
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
