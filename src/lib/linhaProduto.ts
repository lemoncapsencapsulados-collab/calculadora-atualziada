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

export function linhaDoCliente(clienteDaFormula: string | null | undefined): LinhaProduto {
  return ehCatalogo(clienteDaFormula) ? 'white_label' : 'private_label';
}
