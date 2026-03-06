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
  created_at: Date;
  updated_at: Date;
}
