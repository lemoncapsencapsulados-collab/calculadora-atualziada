export type UnitType = 'mcg' | 'mg' | 'g' | 'kg' | 'mL' | 'L' | 'UI' | 'unidade';

export interface Insumo {
  id: string;
  nome: string;
  unidade_compra: UnitType;
  preco_por_unidade_compra: number;
  densidade?: number; // g/mL - for mass↔volume conversions
  observacoes?: string;
  fornecedor?: string;
  categoria?: string;
}

export interface Embalagem {
  id: string;
  nome: string;
  descricao: string;
  preco_unitario: number;
  categoria?: string;
  subcategoria?: string;
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

export interface Formula {
  id: string;
  cliente: string;
  nome_formula: string;
  tipo_produto: 'Encapsulados' | 'Pó' | 'Gummy' | 'Líquido';
  qtd_capsulas: number;
  unidades_por_dose?: number;
  unidade_po?: 'mg' | 'g'; // Unidade para produtos em Pó
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
  formula_id: string;
  numero_pedido: string;
  data_pedido: Date;
  data_entrega: Date;
  quantidade_produto: number;
  unidade_produto: string;
  observacoes?: string;
  status: StatusPedido;
  formula_snapshot: Formula;
  created_at: Date;
  updated_at: Date;
}
