import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Webhook do VHSys (entidade=receitas).
 * - Valida header `x-vhsys-secret` ou query ?secret=...
 * - Extrai id_receita e dispara a função central
 * - Responde 200 rápido (boas práticas)
 */

const WEBHOOK_SECRET = Deno.env.get("VHSYS_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function extrairIdReceita(payload: any): number | null {
  const candidatos = [
    payload?.id_receita_vhsys, payload?.id_receita,
    payload?.data?.id_receita, payload?.data?.id_rec,
    payload?.id_rec, payload?.id,
    payload?.data?.id, payload?.dados?.id_receita,
  ];
  for (const c of candidatos) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Autenticação: header OU query string (alguns webhooks só permitem URL)
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = req.headers.get("x-vhsys-secret") || req.headers.get("secret-access-token");
  const ok = WEBHOOK_SECRET && (headerSecret === WEBHOOK_SECRET || querySecret === WEBHOOK_SECRET);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const idReceita = extrairIdReceita(payload);
  const tipoEvento = String(payload?.evento || payload?.event || payload?.entidade || "receita.webhook");

  if (!idReceita) {
    await supabase.from("vhsys_eventos_log").insert({
      origem: "webhook",
      tipo_evento: tipoEvento,
      status: "erro",
      mensagem: "Não foi possível extrair id_receita do payload",
      payload,
    });
    return new Response(JSON.stringify({ ok: false, error: "id_receita ausente" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dispara processamento (await rápido — função já é idempotente)
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/vhsys-processar-receita`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": WEBHOOK_SECRET,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        id_receita_vhsys: idReceita,
        origem: "webhook",
        tipo_evento: tipoEvento,
        webhook_payload: payload,
      }),
    });
    const body = await resp.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true, resultado: body }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("vhsys_eventos_log").insert({
      origem: "webhook",
      tipo_evento: tipoEvento,
      id_receita_vhsys: idReceita,
      status: "erro",
      mensagem: `Falha ao invocar processador: ${(e as Error).message}`,
      payload,
    });
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});