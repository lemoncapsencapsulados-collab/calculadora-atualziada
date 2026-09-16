/**
 * Pedido de Compra Lemoncaps v3.
 *
 * Fluxo: o orcamento e' enviado ao cliente, vira Pedido de Compra, e so' depois
 * da assinatura no ZapSign o pedido pode ser pago e aprovado.
 * O modelo do documento esta' em `docs/pedido-de-compra-modelo-v3.md`.
 */

export type StatusAprovacao = 'pendente_assinatura' | 'pre_aprovado' | 'aprovado';

export const STATUS_APROVACAO_LABEL: Record<StatusAprovacao, string> = {
  pendente_assinatura: 'Pendente de assinatura do pedido de compra',
  pre_aprovado: 'Pedido pré-aprovado',
  aprovado: 'Aprovado',
};

export const STATUS_APROVACAO_CLASSE: Record<StatusAprovacao, string> = {
  pendente_assinatura: 'border-amber-500 text-amber-700 dark:text-amber-500',
  pre_aprovado: 'border-blue-500 text-blue-700 dark:text-blue-400',
  aprovado: 'border-green-500 text-green-700 dark:text-green-400',
};

export type PlanoMarca = 'faca_voce_mesmo' | 'start' | 'branding' | 'premium' | 'nao_contratado';

export const PLANO_MARCA_LABEL: Record<PlanoMarca, string> = {
  faca_voce_mesmo: 'Faça Você Mesmo',
  start: 'Start',
  branding: 'Branding',
  premium: 'Premium',
  nao_contratado: 'Não contratado',
};

export interface ProdutoPedidoCompra {
  descricao: string;
  apresentacao: string;
  preco_unitario: number;
  quantidade: number;
}

export interface ParcelaPedidoCompra {
  meio_pagamento: string;
  vencimento: string;
  valor: number;
}

/**
 * Opcoes fechadas das secoes 4 e 5. Fechar a lista e' o que torna o documento
 * padronizado -- e o que permite, depois, agrupar pedidos por tipo de embalagem.
 */
export const CANAIS_FORMAIS = ['Grupo de WhatsApp', 'E-mail'] as const;

export const APRESENTACOES = ['Encapsulado', 'Líquido', 'Goma', 'Solúvel'] as const;
export const CAPSULA_TIPOS = ['Cápsula 0'] as const;
export const CAPSULA_CORES = [
  'Transparente', 'Verde', 'Vermelha', 'Branca', 'Roxo', 'Azul', 'Creme',
] as const;
export const POTE_CORES = ['Branco', 'Preto', 'Transparente'] as const;
export const TAMPA_TIPOS = ['Rosca', 'Flip-top', 'Pump'] as const;
export const TAMPA_CORES = ['Branco', 'Preto', 'Transparente', 'Azul'] as const;
export const ROTULO_MATERIAIS = ['BOPP'] as const;
export const ROTULO_ACABAMENTOS = ['Metalizado', 'Transparente', 'Fosco', 'Perolizado'] as const;
export const EMBALAGEM_SECUNDARIA = ['Sim', 'Não'] as const;

/** Um ativo da formula: o insumo e a dose diaria dele. */
export interface AtivoFormula {
  insumo: string;
  dose: string;
}

/** Secao 5 do documento: descricao da embalagem. */
export interface EmbalagemPedidoCompra {
  apresentacao: string;
  capsula_tipo: string;
  capsula_cor: string;
  pote_material: string;
  pote_capacidade: string;
  pote_cor: string;
  tampa_tipo: string;
  tampa_cor: string;
  lacre_inducao: boolean;
  dosador: string;
  rotulo_material: string;
  rotulo_acabamento: string;
  rotulo_quantidade: string;
  embalagem_secundaria: string;
  fornecimento_embalagem: 'CONTRATADA' | 'CONTRATANTE' | '';
}

export interface EspecificacaoProduto {
  produto_nome: string;
  quantidade_por_frasco: string;
  /** Ativos e suas doses diarias, em linhas. */
  composicao: AtivoFormula[];
  embalagem: EmbalagemPedidoCompra;
}

export interface DadosPedidoCompra {
  // 1. Identificacao
  contratante: string;
  cnpj_cpf: string;
  faturamento_em: string;
  data_pedido: string;
  canal_formal: string;
  // 2. Produtos
  produtos: ProdutoPedidoCompra[];
  // 3. Condicoes comerciais
  plano_marca: PlanoMarca;
  entregaveis: string[];
  valor_setup: number;
  valor_producao: number;
  prazo_rotulo_primeira_versao: number;
  prazo_rotulo_correcao: number;
  prazo_producao_dias: number;
  prazo_entrega_dias: number;
  entrada_minima_percentual: number;
  endereco_entrega: string;
  contato_local: string;
  // 4. Condicoes de pagamento
  parcelas: ParcelaPedidoCompra[];
  /**
   * 5 e 6. Especificacao tecnica e embalagem, uma por produto.
   * Um pedido com tres produtos tem tres composicoes e tres embalagens; juntar
   * tudo num bloco so' era o que tornava o documento ambiguo na fabrica.
   */
  especificacoes: EspecificacaoProduto[];
  // Assinatura
  representante_nome: string;
  representante_cpf: string;
}

/** Padroes que o documento v3 ja' traz impressos. */
export const PADROES_PEDIDO_COMPRA = {
  prazo_rotulo_primeira_versao: 7,
  prazo_rotulo_correcao: 4,
  prazo_producao_dias: 40,
  prazo_entrega_dias: 7,
  entrada_minima_percentual: 45,
  local_assinatura: 'Cuiabá/MT',
} as const;

/** A CONTRATADA e' sempre a mesma; vem impressa no rodape do documento. */
export const CONTRATADA = {
  razao_social: 'LEMONCAPS INDÚSTRIA E COMÉRCIO LTDA',
  cnpj: '55.836.075/0001-07',
  representante: 'JOÃO VICTOR GOMES FERRARI',
  representante_cpf: '054.883.221-83',
} as const;

/**
 * Campos sem os quais o Pedido de Compra nao pode ser baixado nem enviado para
 * assinatura -- o financeiro recusa um documento incompleto.
 */
export interface CampoFaltante {
  campo: keyof DadosPedidoCompra | 'numero_contrato';
  label: string;
}

export function listarCamposFaltantes(
  dados: Partial<DadosPedidoCompra>,
  numeroContrato: string,
): CampoFaltante[] {
  const faltantes: CampoFaltante[] = [];
  const exigir = (ok: boolean, campo: CampoFaltante['campo'], label: string) => {
    if (!ok) faltantes.push({ campo, label });
  };

  exigir(!!numeroContrato.trim(), 'numero_contrato', 'Número do contrato');
  exigir(!!dados.contratante?.trim(), 'contratante', 'Razão social / nome do contratante');
  exigir(!!dados.cnpj_cpf?.trim(), 'cnpj_cpf', 'CNPJ / CPF');
  exigir(!!dados.canal_formal?.trim(), 'canal_formal', 'Canal formal (WhatsApp ou e-mail)');
  exigir((dados.produtos?.length ?? 0) > 0, 'produtos', 'Ao menos um produto');
  exigir(
    (dados.produtos ?? []).every((p) => p.descricao.trim() && p.quantidade > 0),
    'produtos',
    'Descrição e quantidade de cada produto',
  );
  exigir(!!dados.endereco_entrega?.trim(), 'endereco_entrega', 'Endereço de entrega');
  exigir(!!dados.contato_local?.trim(), 'contato_local', 'Contato no local (nome e telefone)');
  exigir((dados.parcelas?.length ?? 0) > 0, 'parcelas', 'Condições de pagamento');
  (dados.especificacoes ?? []).forEach((e, i) => {
    const qual = (dados.especificacoes!.length > 1)
      ? ` — ${e.produto_nome?.trim() || `produto ${i + 1}`}`
      : '';
    exigir(!!e.produto_nome?.trim(), 'especificacoes', `Nome do produto${qual}`);
    exigir(
      (e.composicao || []).some((a) => a.insumo?.trim()),
      'especificacoes',
      `Composição da fórmula${qual}`,
    );
    exigir(!!e.embalagem?.apresentacao?.trim(), 'especificacoes', `Apresentação da embalagem${qual}`);
    exigir(
      !!e.embalagem?.fornecimento_embalagem,
      'especificacoes',
      `Fornecimento da embalagem${qual}`,
    );
  });
  exigir((dados.especificacoes?.length ?? 0) > 0, 'especificacoes', 'Especificação técnica');
  exigir(!!dados.representante_nome?.trim(), 'representante_nome', 'Nome do representante legal');
  exigir(!!dados.representante_cpf?.trim(), 'representante_cpf', 'CPF do representante legal');

  return faltantes;
}
