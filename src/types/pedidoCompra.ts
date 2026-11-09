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

/**
 * Quem fornece a embalagem. Os dois casos do padrão; o campo aceita texto
 * livre para o pedido em que ela vem dividida ou de um terceiro.
 *
 * Os valores são os curtos, sem "(Lemoncaps)" e "(produtor)", porque é o que
 * os pedidos já gravados têm: alargar o rótulo faria cada um deles cair fora
 * da lista e abrir como se fosse preenchimento personalizado. O PDF escreve
 * "por conta de CONTRATADA", que é como o documento sempre saiu.
 */
export const FORNECIMENTO_EMBALAGEM = ['CONTRATADA', 'CONTRATANTE'] as const;

export type PlanoMarca = 'faca_voce_mesmo' | 'start' | 'branding' | 'premium' | 'nao_contratado';

export const PLANO_MARCA_LABEL: Record<PlanoMarca, string> = {
  faca_voce_mesmo: 'Faça Você Mesmo',
  start: 'Start',
  branding: 'Branding',
  premium: 'Premium',
  nao_contratado: 'Não contratado',
};

/**
 * O nome do plano como ele vai para o papel.
 *
 * O campo aceita plano fora da lista, digitado pelo consultor, e o que fica
 * gravado é o texto. Buscar direto em `PLANO_MARCA_LABEL` devolveria
 * `undefined` para esses -- e o Pedido de Compra sairia com a palavra
 * "undefined" impressa numa linha que o cliente assina.
 *
 * Chave conhecida vira rótulo; qualquer outra coisa vale por si mesma.
 */
export function rotuloPlanoMarca(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  if (!v) return '';
  return PLANO_MARCA_LABEL[v as PlanoMarca] ?? v;
}

/**
 * O que a coluna de resposta imprime na linha "Plano de marca".
 *
 * Plano em branco saía como célula vazia no documento que o cliente assina --
 * e célula vazia num contrato se lê como esquecimento, não como escolha.
 * Quando não há plano nomeado, o que foi combinado é um plano fora da tabela,
 * e é isso que o papel passa a dizer.
 *
 * Diferente de "Não contratado", que continua saindo como está: ali houve uma
 * decisão de não contratar marca, e trocá-la por "Plano Personalizado" diria
 * que há um serviço contratado onde não há.
 *
 * Só para impressão. No formulário o campo vazio continua vazio, senão o
 * texto apareceria como se tivesse sido digitado e seria gravado assim.
 */
export const PLANO_PERSONALIZADO = 'Plano Personalizado';

export function descricaoPlanoMarca(valor: string | null | undefined): string {
  return rotuloPlanoMarca(valor) || PLANO_PERSONALIZADO;
}

/**
 * O caminho de volta: do que aparece na tela para o que se grava.
 *
 * A tela mostra rótulos ("Branding") e o registro guarda chaves ("branding"),
 * porque é a chave que o PDF sabe traduzir. Sem esta volta, escolher na lista
 * gravaria o rótulo e a tradução passaria a depender de o texto bater letra
 * por letra -- um acento trocado no futuro quebraria calado.
 *
 * Texto que não corresponde a plano nenhum é plano personalizado, e vai
 * gravado como foi escrito.
 */
export function chavePlanoMarca(rotuloOuTexto: string | null | undefined): string {
  const v = String(rotuloOuTexto ?? '').trim();
  if (!v) return '';
  const achado = (Object.keys(PLANO_MARCA_LABEL) as PlanoMarca[]).find(
    (k) => PLANO_MARCA_LABEL[k] === v,
  );
  return achado ?? v;
}

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
  /** "5 g/dia", "2 capsulas/dia". Vazio quando o orcamento nao trouxe. */
  dose_diaria?: string;
  /**
   * Quantas doses o pote rende: "30 doses".
   *
   * Sai da divisao entre o que vai no pote e o que vai na dose, mas fica
   * editavel porque a fabrica as vezes fecha num numero redondo -- e o que
   * vale para produzir e' o que esta' escrito no documento, nao a conta.
   */
  doses_por_pote?: string;
  /** Ativos e suas doses diarias, em linhas. */
  composicao: AtivoFormula[];
  embalagem: EmbalagemPedidoCompra;
}

export interface DadosPedidoCompra {
  // 1. Identificacao
  contratante: string;
  cnpj_cpf: string;
  /** Nome da marca do cliente. E' por ele que a fabrica identifica o lote. */
  marca: string;
  /** E-mail para onde o financeiro manda nota e cobranca. */
  email: string;
  faturamento_em: string;
  data_pedido: string;
  canal_formal: string;
  /** Quem vendeu. O cliente cobra dessa pessoa o que foi combinado. */
  consultor_responsavel: string;
  // 2. Produtos
  produtos: ProdutoPedidoCompra[];
  // 3. Condicoes comerciais
  /** Um dos planos conhecidos, ou o que o consultor escreveu. */
  plano_marca: PlanoMarca | (string & {});
  entregaveis: string[];
  valor_setup: number;
  valor_producao: number;
  prazo_rotulo_primeira_versao: number;
  prazo_rotulo_correcao: number;
  prazo_producao_dias: number;
  prazo_entrega_dias: number;
  /**
   * Recesso de fim de ano da fabrica, em datas e nao em numero de dias.
   *
   * E' parada de calendario: nao desloca com a data do pedido, nem conta dia
   * util. O prazo de producao acima ja' sai ajustado a ela -- por isso a linha
   * do documento diz isso em vez de somar dias a frente.
   *
   * Editavel porque a data muda todo ano. Campo ausente e' pedido gravado
   * antes de a linha existir: vale o padrao, ja' que a fabrica para para ele
   * igual. Campo em branco e' decisao de quem editou, e tira a linha do papel.
   */
  recesso_inicio?: string;
  recesso_fim?: string;
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
  /**
   * Numero do pedido impresso nos documentos, quando o consultor troca o
   * calculado. Vale so' para o papel: o `numero_orcamento`/`numero_pedido` do
   * sistema nao muda, porque e' por ele que Asaas, VHSys, ZapSign e ClickUp
   * acham o registro e e' dele que sai a sequencia dos proximos pedidos.
   * Vazio ou ausente: vale o calculado.
   */
  numero_pedido?: string;
}

/**
 * O numero que sai no documento: o editado, se houver, senao o do sistema.
 */
export function numeroPedidoDoDocumento(
  dados: Partial<DadosPedidoCompra> | null | undefined,
  numeroDoSistema: string,
): string {
  return dados?.numero_pedido?.trim() || numeroDoSistema;
}

/**
 * O Pedido de Compra ja' foi elaborado?
 *
 * Nao basta existir `pedido_compra_dados`: o Projeto para Contrato grava ali so'
 * o numero do pedido editado, antes de o documento ser montado. Documento de
 * verdade tem produtos e especificacoes.
 */
export function pedidoCompraPreenchido(dados: unknown): dados is DadosPedidoCompra {
  const d = dados as Partial<DadosPedidoCompra> | null | undefined;
  return !!d && Array.isArray(d.produtos) && Array.isArray(d.especificacoes);
}

/** Padroes que o documento v3 ja' traz impressos. */
export const PADROES_PEDIDO_COMPRA = {
  prazo_rotulo_primeira_versao: 7,
  prazo_rotulo_correcao: 4,
  prazo_producao_dias: 40,
  prazo_entrega_dias: 7,
  recesso_inicio: '2026-12-18',
  recesso_fim: '2027-01-06',
  entrada_minima_percentual: 45,
  local_assinatura: 'Cuiabá/MT',
} as const;

/**
 * O recesso que o documento imprime, ou nada.
 *
 * Ausente (`undefined`) cai no padrao; em branco (`''`) e' escolha de quem
 * editou e tira a linha. A diferenca importa: sem ela, todo pedido gravado
 * antes desta linha existir sairia sem o aviso do recesso -- e sao justamente
 * os pedidos em producao agora, que a parada atinge.
 *
 * Com uma data so', devolve o par assim mesmo. A lacuna aparece na previa e a
 * tela cobra a outra data antes de liberar o download; sumir com a linha
 * inteira esconderia o meio preenchimento de quem o fez.
 */
export function periodoRecesso(
  dados: Pick<DadosPedidoCompra, 'recesso_inicio' | 'recesso_fim'> | null | undefined,
): { inicio: string; fim: string } | null {
  const inicio = (dados?.recesso_inicio ?? PADROES_PEDIDO_COMPRA.recesso_inicio).trim();
  const fim = (dados?.recesso_fim ?? PADROES_PEDIDO_COMPRA.recesso_fim).trim();
  if (!inicio && !fim) return null;
  return { inicio, fim };
}

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
  exigir(!!dados.marca?.trim(), 'marca', 'Marca');
  exigir(!!dados.email?.trim(), 'email', 'E-mail do financeiro');
  exigir(!!dados.canal_formal?.trim(), 'canal_formal', 'Canal formal (WhatsApp ou e-mail)');
  exigir(
    !!dados.consultor_responsavel?.trim(),
    'consultor_responsavel',
    'Consultor responsável',
  );
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
  // Recesso pela metade. Sem recesso nenhum a linha some do documento e nada
  // falta; com uma ponta so', o cliente assina "de 18/12/2026 a __/__/____".
  const recesso = periodoRecesso(dados);
  if (recesso) {
    exigir(!!recesso.inicio, 'recesso_inicio', 'Início do recesso de fim de ano');
    exigir(!!recesso.fim, 'recesso_fim', 'Fim do recesso de fim de ano');
  }
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
