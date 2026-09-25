/**
 * Senha de administrador para mandar uma fórmula para o Catálogo Lemon.
 *
 * O que está guardado aqui é o SHA-256 da senha, não a senha. Isso impede que
 * ela apareça para quem abre o código da página e procura por texto -- que é o
 * caso real: um consultor curioso, não um invasor.
 *
 * NÃO É SEGURANÇA. A conferência acontece no navegador, e seis dígitos são
 * quebrados por tentativa e erro em segundos por quem souber o que está
 * fazendo. Isto é uma tranca contra clique errado e contra uso casual, no
 * mesmo nível da confirmação que se pede antes de apagar algo. Barrar de
 * verdade exigiria papel de admin no banco, com o RLS recusando a gravação.
 */

const HASH_ESPERADO = '0084314a976cb46f30bd2f39c9bfc78fd7b1fbc8e3ca9d34c64f0202d343860e';

/** SHA-256 em hexadecimal. */
async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Confere a senha digitada. Espaço em volta não conta -- teclado de celular põe. */
export async function conferirSenhaAdmin(senha: string): Promise<boolean> {
  if (!senha?.trim()) return false;
  return (await sha256(senha.trim())) === HASH_ESPERADO;
}
