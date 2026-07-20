export type FreteTipo = 'estoque_proprio' | 'pod';
export type FreteStatus = 'pendente' | 'confirmado';
export type FreteTipoProduto = 'Encapsulado' | 'Líquido' | 'Gummy' | 'Solúvel';

export const FRETE_TIPOS_PRODUTO: FreteTipoProduto[] = ['Encapsulado', 'Líquido', 'Gummy', 'Solúvel'];
/** Planos sugeridos ao criar um novo plano no admin. Planos reais vêm de `frete_pod_precos`. */
export const FRETE_POD_PLANOS_SUGERIDOS = [1, 2, 3, 5, 6, 8, 9, 10, 12, 15, 20, 25, 50] as const;
/** @deprecated Use os planos cadastrados em `frete_pod_precos` (via useFretePodPrecos). */
export const FRETE_POD_PLANOS = FRETE_POD_PLANOS_SUGERIDOS;

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
  taxa_manuseio: number;
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
  taxa_manuseio_anterior: number | null;
  taxa_manuseio_nova: number | null;
  alterado_por: string | null;
  alterado_por_email: string | null;
  alterado_em: string;
}