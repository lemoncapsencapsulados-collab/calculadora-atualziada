export function normalizeTelefone(tel: string | null | undefined): string {
  return (tel || '').replace(/\D/g, '');
}

export function isTelefoneValido(tel: string | null | undefined): boolean {
  return normalizeTelefone(tel).length >= 10;
}

/**
 * Constrói uma URL do WhatsApp (wa.me) para o telefone informado.
 * Retorna `null` se o telefone for inválido.
 */
export function buildWhatsappUrl(
  telefone: string | null | undefined,
  mensagem: string,
): string | null {
  const n = normalizeTelefone(telefone);
  if (n.length < 10) return null;
  const comDDI = n.startsWith('55') ? n : `55${n}`;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(mensagem)}`;
}

export function formatTelefone(tel: string | null | undefined): string {
  const n = normalizeTelefone(tel);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return tel || '';
}