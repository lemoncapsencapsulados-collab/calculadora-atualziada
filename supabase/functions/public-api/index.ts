import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const publicHeaders = { ...corsHeaders, "Access-Control-Allow-Headers": (corsHeaders as any)["Access-Control-Allow-Headers"] + ", x-api-key" };

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...publicHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: publicHeaders });

  const apiKey = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("api_key");
  if (!apiKey) return json({ error: "API key requerida (header x-api-key)" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const keyHash = await sha256(apiKey);
  const { data: keyRow } = await admin
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("ativo", true)
    .maybeSingle();

  if (!keyRow) return json({ error: "API key inválida" }, 401);

  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  const url = new URL(req.url);
  // path: /public-api/{resource}/{id?}
  const parts = url.pathname.replace(/^\/public-api\/?/, "").split("/").filter(Boolean);
  const resource = parts[0];
  const id = parts[1];

  const allow = (perm: string) => (keyRow.permissoes || []).includes(perm) || (keyRow.permissoes || []).includes("*");

  try {
    if (resource === "pedidos") {
      if (!allow("pedidos")) return json({ error: "Sem permissão para pedidos" }, 403);
      if (id) {
        const { data, error } = await admin.from("pedidos").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "não encontrado" }, 404);
        return json({ data });
      }
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const { data, error } = await admin.from("pedidos").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return json({ data, count: data?.length ?? 0 });
    }

    if (resource === "clientes") {
      if (!allow("clientes")) return json({ error: "Sem permissão para clientes" }, 403);
      if (id) {
        const { data, error } = await admin.from("clientes").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "não encontrado" }, 404);
        return json({ data });
      }
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const q = url.searchParams.get("q");
      let query = admin.from("clientes").select("*").order("created_at", { ascending: false }).limit(limit);
      if (q) query = query.or(`nome.ilike.%${q}%,cnpj.ilike.%${q}%,email.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return json({ data, count: data?.length ?? 0 });
    }

    return json({
      api: "Lemon Caps Public API",
      recursos: ["pedidos", "clientes"],
      exemplos: [
        "GET /public-api/pedidos",
        "GET /public-api/pedidos/{id}",
        "GET /public-api/clientes?q=termo",
      ],
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});