/**
 * Código para editar a taxa de juros do cartão.
 *
 * O que está guardado aqui é o SHA-256 do código, não o código — para que ele
 * não apareça para quem abre o código da página e procura por texto, que é o
 * caso real: um consultor curioso, não um invasor.
 *
 * NÃO É SEGURANÇA. A conferência acontece no navegador, e quatro dígitos caem
 * por tentativa e erro em segundos para quem souber o que está fazendo. É uma
 * tranca contra mudança casual: a taxa é termo do contrato que o cliente
 * assina, e um 5 virando 15 por descuido vira discussão depois de assinado.
 * Barrar de verdade exigiria papel no banco, com o RLS recusando a gravação.
 *
 * CONSTANTE PRÓPRIA, E NÃO A DO CATÁLOGO 2026, embora hoje os dígitos sejam os
 * mesmos: as duas trancas guardam coisas diferentes — uma curadoria comercial
 * e um termo de preço — e trocar o código de uma não deve destrancar a outra
 * sem ninguém perceber.
 */

const HASH_ESPERADO = '310ced37200b1a0dae25edb263fe52c491f6e467268acab0ffec06666e2ed959';

async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Confere o código digitado. Espaço em volta não conta — teclado de celular põe. */
export async function conferirCodigoJuros(codigo: string): Promise<boolean> {
  if (!codigo?.trim()) return false;
  return (await sha256(codigo.trim())) === HASH_ESPERADO;
}
