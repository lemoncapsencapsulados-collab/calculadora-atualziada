import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Gerenciar webhooks no VHSys (listar / criar / excluir).
 * Action via body: { action: "list" | "create" | "delete", id?: number, entidade?: string, evento?: string }
 */

const VHSYS_BASE = "https://api.vhsys.com.br/v2";
const ACCESS_TOKEN = Deno.env.get("VHSYS_ACCESS_TOKEN")!;
const SECRET_SERVICE = Deno.env.get("VHSYS_SECRET_SERVICE")!;
const WEBHOOK_SECRET = Deno.env.get("VHSYS_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Basic Auth credentials que o VHSys usa para chamar nosso webhook
const WEBHOOK_USER = "lemoncaps_vhsys";
const WEBHOOK_PASSWORD = WEBHOOK_SECRET; // já tem comprimento >= 8

function vhsysHeaders() {
  return {
    "Content-Type": "application/json",
    "access-token": ACCESS_TOKEN,
    "secret-access-token": SECRET_SERVICE,
  };
}

function webhookUrl() {
  return `${SUPABASE_URL}/functions/v1/vhsys-webhook?secret=${encodeURIComponent(WEBHOOK_SECRET)}`;
}

function mask(url: string) {
  return url.replace(/secret=[^&]+/, "secret=***");
}

function sanitizeList(json: any) {
  const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return arr.map((w: any) => ({
    ...w,
    url: typeof w?.url === "string" ? mask(w.url) : w?.url,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ACCESS_TOKEN || !SECRET_SERVICE || !WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Credenciais VHSys não configuradas" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = String(body?.action || "list");

  try {
    if (action === "list") {
      const resp = await fetch(`${VHSYS_BASE}/webhook`, { headers: vhsysHeaders() });
      const text = await resp.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      return new Response(JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        webhooks: sanitizeList(json),
        resposta: json,
        urlEsperada: mask(webhookUrl()),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      // Entidades válidas (VHSys): clientes, ordem_servico, vendas_balcao, contas_receber, produtos, todos
      const entidade = String(body?.entidade || "contas_receber");
      const payload = {
        url: webhookUrl(),
        user: WEBHOOK_USER,
        password: WEBHOOK_PASSWORD,
        entidade,
      };
      const resp = await fetch(`${VHSYS_BASE}/webhook`, {
        method: "POST", headers: vhsysHeaders(), body: JSON.stringify(payload),
      });
      const text = await resp.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      // VHSys às vezes devolve code 200 mas com erros de validação em data:[...]
      const dataErros = Array.isArray(json?.data) ? json.data : [];
      const realmenteOk = resp.ok && (json?.code === 201 || (json?.code === 200 && !dataErros.length)) && !!json?.data?.id_webhook;
      return new Response(JSON.stringify({
        ok: realmenteOk,
        status: resp.status,
        enviado: { entidade, url: mask(webhookUrl()), user: WEBHOOK_USER },
        resposta: json,
        avisos: dataErros,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const id = Number(body?.id);
      if (!Number.isFinite(id) || id <= 0) {
        return new Response(JSON.stringify({ error: "id inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resp = await fetch(`${VHSYS_BASE}/webhook/${id}`, {
        method: "DELETE", headers: vhsysHeaders(),
      });
      const json = await resp.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, resposta: json }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});