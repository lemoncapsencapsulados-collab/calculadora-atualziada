/**
 * O `functions.invoke` do supabase-js lança, em qualquer resposta não-2xx, um
 * erro com a string fixa "Edge Function returned a non-2xx status code" — ele
 * nunca lê o corpo. Nossas edge functions respondem `{ error: "..." }` com
 * status ≠ 200, então a mensagem útil fica presa em `error.context` (a
 * `Response` crua que o supabase-js anexa ao erro mas não consome).
 *
 * Sem isto, toda falha de edge function chega ao usuário como a mesma frase
 * genérica, e o motivo real (chave ausente, crédito esgotado, rate limit)
 * some. O mesmo tratamento existe em `useZapVendas.ts`, dedicado à função
 * `zapvendas`; este aqui é a versão genérica.
 */
export async function mensagemErroEdgeFunction(error: unknown, fallback: string): Promise<string> {
  const contexto = (error as { context?: Response } | undefined)?.context;

  if (contexto && typeof contexto.clone === 'function') {
    try {
      const corpo = await contexto.clone().json();
      const mensagem = (corpo as { error?: unknown } | null)?.error;
      if (typeof mensagem === 'string' && mensagem.trim()) {
        // O status entra na mensagem porque distingue causas que a função
        // relata com textos parecidos (402 crédito x 429 rate limit).
        return `${mensagem} (HTTP ${contexto.status})`;
      }
    } catch {
      // Corpo não era JSON — ex.: página de erro de proxy ou timeout do gateway.
    }
    return `${fallback} (HTTP ${contexto.status})`;
  }

  const bruta = (error as { message?: unknown } | undefined)?.message;
  return typeof bruta === 'string' && bruta.trim() ? bruta : fallback;
}
