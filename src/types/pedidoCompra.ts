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
  /** White Label (catalogo) ou Private Label (personalizada). */
  linha?: 'white_label' | 'private_label';
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
  'Transparente', 'Verde', 'Vermelha', 'Branca', 'Roxo', 'Azul', 'Creme', 'Laranja',
] as const;
export const POTE_CORES = ['Branco', 'Preto', 'Transparente'] as const;
export const TAMPA_TIPOS = ['Rosca', 'Flip-top', 'Pump', 'Tampão 38 mm', 'Conta-gotas'] as const;
export const SIM_NAO = ['Sim', 'Não'] as const;
export const BULBOS = ['Bulbo de borracha', 'Bulbo de silicone'] as const;
export const CANULAS = ['Cânula de vidro', 'Cânula plástica'] as const;
export const DOSADORES = [
  'Não', 'Colher medida', 'Dosador 5 mL', 'Dosador 10 mL', 'Conta-gotas', 'Válvula pump',
] as const;
export const TAMPA_CORES = ['Branco', 'Preto', 'Transparente', 'Azul'] as const;
export const ROTULO_MATERIAIS = ['BOPP'] as const;
export const ROTULO_ACABAMENTOS = ['Metalizado', 'Transparente', 'Fosco', 'Perolizado'] as const;
export const EMBALAGEM_SECUNDARIA = ['Sim', 'Não'] as const;

/** Chaves de embalagem que uma apresentacao usa. */
export type CampoEmbalagem =
  | 'capsula_tipo' | 'capsula_cor'
  | 'bulbo' | 'canula'
  | 'pote_material' | 'pote_capacidade' | 'pote_cor'
  | 'tampa_tipo' | 'tampa_cor'
  | 'silica' | 'lacre_inducao' | 'dosador'
  | 'rotulo_material' | 'rotulo_acabamento' | 'rotulo_quantidade'
  | 'embalagem_secundaria' | 'fornecimento_embalagem';

/**
 * Campos de embalagem por apresentacao.
 *
 * Perguntar cor de capsula para um liquido, ou bulbo para um encapsulado, so'
 * gera campo em branco no documento. Cada forma farmaceutica tem a sua lista.
 */
export const CAMPOS_POR_APRESENTACAO: Record<string, CampoEmbalagem[]> = {
  Encapsulado: [
    'capsula_tipo', 'capsula_cor',
    'pote_material', 'pote_capacidade', 'pote_cor',
    'tampa_tipo', 'tampa_cor', 'lacre_inducao', 'silica',
    'rotulo_material', 'rotulo_acabamento', 'rotulo_quantidade',
    'embalagem_secundaria', 'fornecimento_embalagem',
  ],
  'Líquido': [
    'bulbo', 'canula',
    'pote_material', 'pote_capacidade', 'pote_cor',
    'tampa_tipo', 'tampa_cor', 'dosador',
    'rotulo_material', 'rotulo_acabamento', 'rotulo_quantidade',
    'embalagem_secundaria', 'fornecimento_embalagem',
  ],
  Goma: [
    'pote_material', 'pote_capacidade', 'pote_cor',
    'tampa_tipo', 'tampa_cor', 'lacre_inducao', 'silica',
    'rotulo_material', 'rotulo_acabamento', 'rotulo_quantidade',
    'embalagem_secundaria', 'fornecimento_embalagem',
  ],
  'Solúvel': [
    'pote_material', 'pote_capacidade', 'pote_cor',
    'tampa_tipo', 'tampa_cor', 'dosador',
    'rotulo_material', 'rotulo_acabamento', 'rotulo_quantidade',
    'embalagem_secundaria', 'fornecimento_embalagem',
  ],
};

/** Sem apresentacao definida, pede o conjunto mais comum. */
export function camposDaApresentacao(apresentacao: string | undefined): CampoEmbalagem[] {
  return CAMPOS_POR_APRESENTACAO[(apresentacao || '').trim()] || CAMPOS_POR_APRESENTACAO.Encapsulado;
}

/** Rotulo de cada campo, usado na tela e na cobranca do que falta. */
export const CAMPO_EMBALAGEM_LABEL: Record<CampoEmbalagem, string> = {
  capsula_tipo: 'Tipo de cápsula',
  capsula_cor: 'Cor da cápsula',
  bulbo: 'Bulbo',
  canula: 'Cânula',
  pote_material: 'Material do pote / frasco',
  pote_capacidade: 'Capacidade do pote / frasco',
  pote_cor: 'Cor do pote / frasco',
  tampa_tipo: 'Tipo de tampa',
  tampa_cor: 'Cor da tampa',
  silica: 'Sílica',
  lacre_inducao: 'Lacre de indução',
  dosador: 'Dosador / acessório',
  rotulo_material: 'Material do rótulo',
  rotulo_acabamento: 'Acabamento do rótulo',
  rotulo_quantidade: 'Quantidade de rótulo',
  embalagem_secundaria: 'Embalagem secundária',
  fornecimento_embalagem: 'Fornecimento da embalagem',
};

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
  /** Encapsulado e goma: sache de silica dentro do pote. */
  silica: string;
  /** Gotas: bulbo e canula do frasco conta-gotas. */
  bulbo: string;
  canula: string;
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
  // Parcela sem meio ou sem vencimento imprime lacuna no documento.
  (dados.parcelas ?? []).forEach((parcela, i) => {
    exigir(!!parcela.meio_pagamento?.trim(), 'parcelas', `Meio de pagamento da parcela ${i + 1}`);
    exigir(!!parcela.vencimento?.trim(), 'parcelas', `Vencimento da parcela ${i + 1}`);
    exigir((Number(parcela.valor) || 0) > 0, 'parcelas', `Valor da parcela ${i + 1}`);
  });
  // Campos livres que tambem viram lacuna impressa quando ficam em branco.
  exigir(!!dados.faturamento_em?.trim(), 'faturamento_em', 'Faturamento em');
  (dados.especificacoes ?? []).forEach((e, i) => {
    const qual = (dados.especificacoes!.length > 1)
      ? ` — ${e.produto_nome?.trim() || `produto ${i + 1}`}`
      : '';
    exigir(!!e.quantidade_por_frasco?.trim(), 'especificacoes', `Quantidade por frasco${qual}`);
    exigir(
      (e.composicao || []).every((a) => !a.insumo?.trim() || a.dose?.trim()),
      'especificacoes',
      `Dose de cada insumo${qual}`,
    );
  });
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
    const emb = e.embalagem || ({} as typeof e.embalagem);
    exigir(!!emb.apresentacao?.trim(), 'especificacoes', `Apresentação da embalagem${qual}`);
    // Cobra so' o que aquela apresentacao usa -- pedir cor de capsula num
    // liquido deixaria o consultor travado num campo que nem se aplica.
    camposDaApresentacao(emb.apresentacao).forEach((campo) => {
      if (campo === 'lacre_inducao') return; // booleano: "nao" e' resposta valida
      const valor = (emb as any)[campo];
      exigir(!!String(valor ?? '').trim(), 'especificacoes', `${CAMPO_EMBALAGEM_LABEL[campo]}${qual}`);
    });
  });
  exigir((dados.especificacoes?.length ?? 0) > 0, 'especificacoes', 'Especificação técnica');
  exigir(!!dados.representante_nome?.trim(), 'representante_nome', 'Nome do representante legal');
  exigir(!!dados.representante_cpf?.trim(), 'representante_cpf', 'CPF do representante legal');

  return faltantes;
}
