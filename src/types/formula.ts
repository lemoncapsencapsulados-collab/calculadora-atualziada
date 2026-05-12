import { OrcamentoSnapshot } from '@/types/orcamento';

export type UnitType = 'mcg' | 'mg' | 'g' | 'kg' | 'mL' | 'L' | 'UI' | 'unidade';

export interface MateriaPrima {
  id: string;
  nome: string;
  unidade_compra: UnitType;
  preco_por_unidade_compra: number;
  densidade?: number; // g/mL - for mass↔volume conversions
  observacoes?: string;
  fornecedor?: string;
  categoria?: string;
  updated_at?: string;
}

// Alias for backward compatibility
export type Insumo = MateriaPrima;

export interface Lote {
  id: string;
  item_id: string;
  item_tipo: 'materia_prima' | 'embalagem';
  codigo?: string;
  quantidade: number;
  validade?: string;
  custo_unitario: number;
  fornecedor?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Embalagem {
  id: string;
  nome: string;
  descricao: string;
  preco_unitario: number;
  categoria?: string;
  subcategoria?: string;
  fornecedor?: string;
  updated_at?: string;
}

export interface FormulaItem {
  insumo_id: string;
  nome_insumo_snapshot: string;
  qtd_informada: number;
  unidade_informada: UnitType;
  custo_calculado: number;
}

export interface EmbalagemItem {
  embalagem_id: string;
  descricao_snapshot: string;
  custo_calculado: number;
}

export type TipoProduto = 'Encapsulados' | 'Solúvel' | 'Gummy' | 'Líquido';

export interface Formula {
  id: string;
  cliente: string;
  nome_formula: string;
  tipo_produto: TipoProduto;
  quantidade_por_pote: number;
  unidades_por_dose?: number;
  unidade_soluvel?: 'mg' | 'g'; // Unidade para produtos Solúveis
  itens: FormulaItem[];
  embalagens: EmbalagemItem[];
  total_mp: number;
  total_embalagem: number;
  custo_total: number;
  data: Date;
}

export type StatusProcesso = 'pendente' | 'entregue';
export type StatusProcessoLogistica = 'pendente' | 'entregue' | 'nao_necessario';

export interface AcompanhamentoProcessos {
  criacao_marca: StatusProcesso;
  producao: StatusProcesso;
  integracao_logistica: StatusProcessoLogistica;
  pagina_venda: StatusProcesso;
  envio_produto: StatusProcesso;
  satisfacao_nota: number | null;
  satisfacao_observacoes: string | null;
  // Setup extras (categorias gerenciadas nas subpáginas de Pedidos)
  registro_inpi?: StatusProcessoLogistica;
  impressao_rotulos?: StatusProcessoLogistica;
  codigo_barras?: StatusProcessoLogistica;
  // Sucesso do Cliente — campos opcionais, persistidos no mesmo jsonb
  prazos_por_etapa?: Record<string, { previsto?: string; concluido?: string }>;
  observacoes_por_etapa?: Record<string, string>;
  rotulagem_status?: 'aguardando_rotulo' | 'rotulo_na_lemon' | 'produto_rotulado';
  producao_status_detalhado?: 'sem_pedido_vhsys' | 'aguardando_producao' | 'produzido';
  producao_prazo_vhsys?: string;
  impressao_rotulo_pago_em?: string;
  briefing_preenchido_em?: string;
  // Versão estendida das opções dos serviços de marca:
  rotulos_arte_status?: 'faca_voce_mesmo' | 'pendente' | 'concluido';
  pagina_vendas_status?: 'nao_necessario' | 'pendente' | 'concluido';
  registro_inpi_status?: 'nao_necessario' | 'pendente' | 'concluido';
  codigo_barras_status?: 'nao_necessario' | 'pendente' | 'concluido';
  impressao_rotulo_status?: 'pendente_pagamento' | 'em_producao' | 'concluido';
  logistica_status?: 'aguardando_envio' | 'enviado';
  // Sucesso do Cliente — produtos do pedido e observação geral do CS
  produtos_cs?: { id: string; nome: string }[];
  observacao_geral_cs?: string;
  nome_marca_cs?: string;
}

export type StatusPedido = 
  | 'aguardando_producao' 
  | 'no_estoque' 
  | 'enviado' 
  | 'concluido';

export interface Pedido {
  id: string;
  formula_id?: string;
  orcamento_id?: string;
  numero_pedido: string;
  data_pedido: Date;
  data_entrega: Date;
  quantidade_produto: number;
  unidade_produto: string;
  observacoes?: string;
  status: StatusPedido;
  formula_snapshot?: Formula;
  orcamento_snapshot?: OrcamentoSnapshot;
  acompanhamento_processos?: AcompanhamentoProcessos;
  pagamento_alteracoes?: Array<{
    alterado_em: string;
    alterado_por?: string | null;
    data_pagamento_anterior?: string | null;
    data_pagamento_nova?: string | null;
    condicoes_anteriores?: any;
    condicoes_novas?: any;
    resumo_anterior?: string;
    resumo_novo?: string;
  }>;
  created_at: Date;
  updated_at: Date;
}
