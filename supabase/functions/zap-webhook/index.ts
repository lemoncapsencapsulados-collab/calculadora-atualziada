// Recebe `messages.upsert` da Evolution e persiste a mensagem na hora.
//
// Roda com verify_jwt = false porque quem chama é a Evolution, que não tem
// sessão do Supabase. Em troca, exige um segredo compartilhado: sem ele
// qualquer um na internet poderia injetar mensagens falsas no acervo que
// alimenta a avaliação dos consultores.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizar, type MensagemEvolution } from '../_shared/zapNormalizar.ts';
import { salvarMensagens } from '../_shared/zapPersistir.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Comparação em tempo constante. Um `!==` vaza, pelo tempo de resposta, quantos
 * caracteres iniciais o atacante acertou — o que torna o segredo descobrível
 * caractere a caractere.
 */
function segredoConfere(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recebido.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'método não suportado' }, 405);

  const esperado = (Deno.env.get('ZAP_WEBHOOK_SECRET') || '').trim();
  if (!esperado) {
    console.error('ZAP_WEBHOOK_SECRET não configurado — recusando tudo');
    return json({ ok: false, error: 'webhook não configurado' }, 500);
  }
  const recebido = (req.headers.get('x-zap-secret') || '').trim();
  if (!segredoConfere(recebido, esperado)) return json({ ok: false, error: 'não autorizado' }, 401);

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, error: 'corpo inválido' }, 400);
  }

  const evento = String(corpo?.event || '').toLowerCase();
  // Só mensagens interessam. Os demais eventos (presence, connection, contacts)
  // chegam no mesmo endpoint e são descartados sem erro — devolver 4xx faria a
  // Evolution reenfileirar e reentregar para sempre.
  if (evento && !evento.startsWith('messages.upsert')) return json({ ok: true, ignorado: evento });

  const instancia = String(corpo?.instance || '').trim();
  if (!instancia) return json({ ok: false, error: 'instance ausente' }, 400);

  // A Evolution manda ora um objeto, ora um array, dependendo da versão.
  const brutas: MensagemEvolution[] = Array.isArray(corpo?.data) ? corpo.data : [corpo?.data];

  const linhas = [];
  const nomes = new Map<string, string>();
  for (const bruta of brutas) {
    const linha = normalizar(bruta, instancia);
    if (!linha) continue;
    linhas.push(linha);
    // `pushName` só identifica o contato quando a mensagem é RECEBIDA; no que o
    // consultor envia, é o nome do próprio vendedor.
    const push = String(bruta?.pushName || '').trim();
    if (push && !linha.from_me) nomes.set(linha.remote_jid, push);
  }

  if (linhas.length === 0) return json({ ok: true, gravadas: 0 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const gravadas = await salvarMensagens(supabase, linhas, nomes);
    return json({ ok: true, gravadas });
  } catch (e) {
    // 500 faz a Evolution tentar de novo, que é o que queremos numa falha
    // transitória de banco. O upsert é idempotente, então reentrega não duplica.
    console.error('zap-webhook:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
