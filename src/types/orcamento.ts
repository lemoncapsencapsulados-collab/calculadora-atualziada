export interface ItemProducao {
  tipo: 'precificacao' | 'avulso';
  precificacao_id?: string;
  nome_produto: string;
  segmento: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
}

export interface ServicoMarca {
  nome_plano: string;
  descricao?: string;
  valor: number;
}

export interface Orcamento {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  observacoes?: string;
  validade_dias: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  created_at: string;
  updated_at: string;
}

export interface OrcamentoInsert {
  numero_orcamento: string;
  nome_cliente: string;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  observacoes?: string;
  validade_dias?: number;
  status?: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
}

export interface OrcamentoUpdate {
  nome_cliente?: string;
  itens_producao?: ItemProducao[];
  servicos_marca?: ServicoMarca[];
  subtotal_producao?: number;
  subtotal_servicos?: number;
  valor_total?: number;
  observacoes?: string;
  validade_dias?: number;
  status?: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
}
