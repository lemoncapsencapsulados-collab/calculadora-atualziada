export type UnitType = 'mcg' | 'mg' | 'g' | 'kg' | 'mL' | 'L' | 'UI' | 'unidade';

export interface Insumo {
  id: string;
  nome: string;
  unidade_compra: UnitType;
  preco_por_unidade_compra: number;
  densidade?: number; // g/mL - for mass↔volume conversions
  observacoes?: string;
  fornecedor?: string;
}

export interface Embalagem {
  id: string;
  descricao: string;
  preco_unitario: number;
  qtd_por_pote: number;
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
  qtd_por_pote: number;
  custo_calculado: number;
}

export interface Formula {
  id: string;
  cliente: string;
  nome_formula: string;
  itens: FormulaItem[];
  embalagens: EmbalagemItem[];
  total_mp: number;
  total_embalagem: number;
  custo_total: number;
  data: Date;
}
