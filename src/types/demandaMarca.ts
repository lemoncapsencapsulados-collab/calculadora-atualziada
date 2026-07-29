export type DemandaTipo = 'rotulo' | 'criativos' | 'banner' | 'monetizze';
export type DemandaStatus = 'pendente' | 'em_andamento' | 'concluida';

export const DEMANDA_TIPO_LABELS: Record<DemandaTipo, string> = {
  rotulo: 'Rótulo',
  criativos: 'Criativos',
  banner: 'Banner',
  monetizze: 'Conta Monetizze',
};

export const DEMANDA_TIPO_SETOR: Record<DemandaTipo, string> = {
  rotulo: 'Demanda Designer',
  criativos: 'Demanda Designer',
  banner: 'Demanda Designer',
  monetizze: 'Demanda T.I',
};

export const DEMANDA_STATUS_LABELS: Record<DemandaStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

export const TIPOS_PAPEL = ['Metalizado', 'Perolizado', 'Transparente'] as const;
export const TIPOS_PRODUTO = ['Encapsulado', 'Líquido', 'Gummy', 'Solúvel'] as const;
export const POSICIONAMENTOS = ['Premium', 'Intermediária', 'Popular'] as const;
export const ESTRUTURAS_ROTULO = ['Minimalista', 'Moderno', 'Clássico'] as const;
export const SEGMENTOS = [
  'Emagrecimento',
  'Libido',
  'Foco e concentração',
  'Sono',
  'Imunidade',
  'Beleza (cabelo, pele e unha)',
  'Energia',
  'Saúde intestinal',
  'Outro',
] as const;
export const OBJETIVOS_CRIATIVO = [
  'Venda de produto',
  'Informações do produto',
  'Lançamento da marca/produto',
] as const;

export interface ArquivoDemanda {
  path: string;
  nome: string;
  categoria: 'referencia' | 'logo';
}

export interface InsumoProdutoPedido {
  nome: string;
  quantidade?: number;
  unidade?: string;
}

/** Produto fechado no pedido (extraído do snapshot do orçamento) */
export interface ProdutoPedido {
  nome_produto: string;
  tipo_produto: string;
  quantidade: number;
  segmento?: string;
  quantidade_doses?: number;
  quantidade_por_pote?: number;
  quantidade_por_dose?: number;
  unidade_por_dose?: string;
  unidade_por_pote?: string;
  dose_diaria_sugerida?: string;
  cor_pote?: string;
  cor_tampa?: string;
  preco_unitario?: number;
  insumos?: InsumoProdutoPedido[];
}

export interface ProdutoRotulo {
  tipo_produto: string;
  nome_produto: string;
  nome_indefinido: boolean;
  quantidade_potes: number;
  segmento: string;
}

export interface DadosRotulo {
  tipo_papel: string;
  nome_marca: string;
  sem_marca: boolean;
  posicionamento: string;
  estrutura: string;
  produtos: ProdutoRotulo[];
  observacoes?: string;
}

export interface CriativoProduto {
  nome_produto: string;
  quantidade: number;
  objetivos: string[];
}

export interface DadosCriativos {
  produtos: CriativoProduto[];
  observacoes?: string;
}

export interface BannerProduto {
  nome_produto: string;
  selecionado: boolean;
  vertical: boolean;
  horizontal: boolean;
}

export interface DadosBanner {
  produtos: BannerProduto[];
  observacoes?: string;
}

export interface EtapaMonetizze {
  descricao: string;
  concluida: boolean;
}

export interface DadosMonetizze {
  etapas: EtapaMonetizze[];
  link_divulgacao?: string;
  observacoes?: string;
}

export type DemandaDados = DadosRotulo | DadosCriativos | DadosBanner | DadosMonetizze;

export interface DemandaMarca {
  id: string;
  pedido_id: string;
  tipo: DemandaTipo;
  status: DemandaStatus;
  cliente_nome: string;
  vendedor_nome: string;
  dados: any;
  arquivos: ArquivoDemanda[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandaMarcaInput {
  pedido_id: string;
  tipo: DemandaTipo;
  status?: DemandaStatus;
  cliente_nome: string;
  vendedor_nome: string;
  dados: any;
  arquivos?: ArquivoDemanda[];
}
