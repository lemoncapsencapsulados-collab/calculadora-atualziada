/**
 * Linha do produto: White Label (catalogo) ou Private Label (personalizada).
 *
 * O sistema inteiro reconhece uma formula de catalogo por um unico criterio --
 * o cliente dela ser "Catalogo Lemon". Nao existe campo de departamento, entao
 * esta e' a fonte da verdade, e fica num lugar so' para nao divergir.
 */

export type LinhaProduto = 'white_label' | 'private_label';

export const LINHA_PRODUTO_LABEL: Record<LinhaProduto, string> = {
  white_label: 'White Label (Fórmula do Catálogo)',
  private_label: 'Private Label (Fórmula Personalizada)',
};

/** Rotulo curto, para caber em tabela e selo. */
export const LINHA_PRODUTO_CURTO: Record<LinhaProduto, string> = {
  white_label: 'White Label',
  private_label: 'Private Label',
};

/** O nome do cliente da formula e' o que marca o catalogo. */
export function ehCatalogo(clienteDaFormula: string | null | undefined): boolean {
  const c = (clienteDaFormula || '').toLowerCase();
  return c.includes('catálogo') || c.includes('catalogo');
}

/**
 * Terceira prateleira: formulas que a LemonCaps escolhe a dedo para oferecer.
 *
 * Marcada do mesmo jeito que o catalogo -- pelo nome do cliente da formula --,
 * porque e' o mecanismo que o sistema inteiro ja' entende. Nome proprio, sem a
 * palavra "catalogo", para `ehCatalogo` nao confundir as duas.
 */
export const CLIENTE_SELECAO = 'Seleção LemonCaps';

export function ehSelecao(clienteDaFormula: string | null | undefined): boolean {
  const c = (clienteDaFormula || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return c.includes('selecao lemoncaps') || c.includes('selecao lemon caps');
}

/**
 * Quarta prateleira: a curadoria do ano.
 *
 * Marcada pelo nome do cliente, como as outras -- e' o mecanismo que o sistema
 * inteiro ja' entende.
 *
 * ATENCAO a' ordem de verificacao: este nome CONTEM a palavra "catalogo",
 * entao `ehCatalogo` casa com ele tambem. Quem decide o departamento precisa
 * perguntar por este ANTES, senao toda formula do Catalogo 2026 cai em White
 * Label e some da prateleira nova. A Selecao escapou disso por ter nome sem a
 * palavra; esta nao tem como escapar, porque o nome foi pedido assim.
 */
export const CLIENTE_CATALOGO_2026 = 'CATÁLOGO 2026';

export function ehCatalogo2026(clienteDaFormula: string | null | undefined): boolean {
  const c = (clienteDaFormula || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /catalogo\s*2026/.test(c);
}

/** Departamento da formula: onde ela aparece na tela de Precificacao. */
export type Departamento =
  | 'private_label'
  | 'white_label'
  | 'selecao_lemoncaps'
  | 'catalogo_2026';

export const DEPARTAMENTO_LABEL: Record<Departamento, string> = {
  private_label: 'Private Label (Fórmulas Personalizadas)',
  white_label: 'White Label (Fórmulas do Catálogo)',
  selecao_lemoncaps: 'Seleção LemonCaps',
  catalogo_2026: 'CATÁLOGO 2026',
};

export function departamentoDoCliente(
  clienteDaFormula: string | null | undefined,
): Departamento {
  // O 2026 vem ANTES do catalogo generico: o nome dele contem "catalogo", e
  // perguntar na ordem inversa jogaria a prateleira inteira em White Label.
  if (ehCatalogo2026(clienteDaFormula)) return 'catalogo_2026';
  if (ehSelecao(clienteDaFormula)) return 'selecao_lemoncaps';
  return ehCatalogo(clienteDaFormula) ? 'white_label' : 'private_label';
}

/**
 * Linha do produto no orcamento e nos documentos.
 *
 * A Selecao e o CATALOGO 2026 contam como White Label aqui de proposito:
 * comercialmente os dois sao o que o catalogo e' -- formula da casa, oferecida
 * a qualquer cliente, sem teste de estabilidade por conta do produtor. As
 * prateleiras separadas sao organizacao interna da tela de Precificacao, nao
 * tipos de venda diferentes.
 */
export function linhaDoCliente(clienteDaFormula: string | null | undefined): LinhaProduto {
  const dep = departamentoDoCliente(clienteDaFormula);
  return dep === 'private_label' ? 'private_label' : 'white_label';
}
