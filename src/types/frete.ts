export type FreteTipo = 'estoque_proprio' | 'pod';
export type FreteStatus = 'pendente' | 'confirmado';
export type FreteTipoProduto = 'Encapsulado' | 'Líquido' | 'Gummy' | 'Solúvel';

export const FRETE_TIPOS_PRODUTO: FreteTipoProduto[] = ['Encapsulado', 'Líquido', 'Gummy', 'Solúvel'];
export const FRETE_POD_PLANOS = [1, 2, 3, 5, 6, 8, 9, 10, 12, 20, 50] as const;

export interface FreteCotacao {
  id: string;
  tipo: FreteTipo;
  orcamento_id: string;
  ativa: boolean;
  // Estoque Próprio
  nome_produtor: string | null;
  nome_produto: string | null;
  tipo_produto: string | null;
  quantidade_unidades: number | null;
  valor_frete: number | null;
  status: FreteStatus | null;
  observacoes_internas: string | null;
  // POD
  pod_plano: number | null;
  pod_preco_por_envio: number | null;
  pod_preco_editado_manualmente: boolean | null;
  pod_quantidade_envios_estimada: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FreteCotacaoInsert {
  tipo: FreteTipo;
  orcamento_id: string;
  nome_produtor?: string | null;
  nome_produto?: string | null;
  tipo_produto?: string | null;
  quantidade_unidades?: number | null;
  valor_frete?: number | null;
  status?: FreteStatus | null;
  observacoes_internas?: string | null;
  pod_plano?: number | null;
  pod_preco_por_envio?: number | null;
  pod_preco_editado_manualmente?: boolean | null;
  pod_quantidade_envios_estimada?: number | null;
  observacoes?: string | null;
}

export interface FretePodPreco {
  id: string;
  tipo_produto: string;
  plano: number;
  preco: number;
  faixa_peso: string | null;
  vigencia_inicio: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FretePodPrecoHistorico {
  id: string;
  preco_id: string | null;
  tipo_produto: string;
  plano: number;
  preco_anterior: number | null;
  preco_novo: number;
  alterado_por: string | null;
  alterado_por_email: string | null;
  alterado_em: string;
}