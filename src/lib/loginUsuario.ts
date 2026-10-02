/**
 * Domínio completado quando se digita só o nome de usuário.
 *
 * O acesso administrativo foi combinado como "Admlemon", não como um e-mail. O
 * Supabase só autentica por e-mail, então em vez de obrigar a digitar o endereço
 * inteiro -- e errar o domínio -- o que falta é completado aqui.
 *
 * Quem digita um e-mail de verdade não é afetado: só entra o que não tem "@".
 */
export const DOMINIO_PADRAO = 'lemoncaps.com.br';

export function normalizarLogin(entrada: string): string {
  const texto = (entrada || '').trim();
  if (!texto) return '';
  if (texto.includes('@')) return texto.toLowerCase();
  // Espaço no meio não é nome de usuário; devolve como veio para o erro ser
  // "credenciais inválidas" e não um e-mail inventado que não existe.
  if (/\s/.test(texto)) return texto.toLowerCase();
  return `${texto.toLowerCase()}@${DOMINIO_PADRAO}`;
}
