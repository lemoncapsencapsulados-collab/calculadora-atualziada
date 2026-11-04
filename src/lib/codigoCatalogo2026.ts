/**
 * Código para mandar uma fórmula ao CATÁLOGO 2026.
 *
 * O que está guardado aqui é o SHA-256 do código, não o código. Isso impede
 * que ele apareça para quem abre o código da página e procura por texto -- que
 * é o caso real: um consultor curioso, não um invasor.
 *
 * NÃO É SEGURANÇA. A conferência acontece no navegador, e quatro dígitos caem
 * por tentativa e erro em segundos para quem souber o que está fazendo. Isto é
 * uma tranca contra clique errado e contra uso casual, no mesmo nível da
 * confirmação que se pede antes de apagar algo. Barrar de verdade exigiria
 * papel de admin no banco, com o RLS recusando a gravação.
 *
 * Código próprio, diferente da senha de administrador: o catálogo do ano é
 * uma curadoria comercial, e quem a monta não é necessariamente quem
 * administra o sistema.
 */

const HASH_ESPERADO = '310ced37200b1a0dae25edb263fe52c491f6e467268acab0ffec06666e2ed959';

async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Confere o código digitado. Espaço em volta não conta -- teclado de celular põe. */
export async function conferirCodigoCatalogo2026(codigo: string): Promise<boolean> {
  if (!codigo?.trim()) return false;
  return (await sha256(codigo.trim())) === HASH_ESPERADO;
}
