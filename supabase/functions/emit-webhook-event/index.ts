import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { evento, payload } = await req.json();
    if (!evento) {
      return new Response(JSON.stringify({ error: "evento requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: configs, error } = await admin
      .from("webhook_configs")
      .select("*")
      .eq("ativo", true)
      .contains("eventos", [evento]);
    if (error) throw error;

    const results: any[] = [];
    for (const cfg of configs || []) {
      const body = JSON.stringify({ evento, enviado_em: new Date().toISOString(), payload });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cfg.secret) headers["X-Webhook-Signature"] = "sha256=" + (await hmacSha256(cfg.secret, body));

      let status: string = "success";
      let httpStatus: number | null = null;
      let responseBody: string | null = null;
      let errMsg: string | null = null;
      try {
        const resp = await fetch(cfg.url, { method: "POST", headers, body });
        httpStatus = resp.status;
        responseBody = (await resp.text()).slice(0, 4000);
        if (!resp.ok) status = "failed";
      } catch (e) {
        status = "failed";
        errMsg = (e as Error).message;
      }

      await admin.from("webhook_deliveries").insert({
        webhook_config_id: cfg.id,
        evento,
        payload,
        status,
        http_status: httpStatus,
        response_body: responseBody,
        error: errMsg,
        tentativas: 1,
      });
      results.push({ id: cfg.id, status, httpStatus });
    }

    return new Response(JSON.stringify({ ok: true, dispatched: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});