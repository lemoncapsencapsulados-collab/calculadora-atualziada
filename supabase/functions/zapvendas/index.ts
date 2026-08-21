// Edge function `zapvendas` — proxy autenticado para a Evolution API.
//
// Segurança (ordem obrigatória a cada requisição):
//   1. Tratar OPTIONS (CORS).
//   2. Resolver o usuário a partir do JWT (client anon + header Authorization). Sem usuário → 401.
//   3. Confirmar papel `zapvendas` em `user_roles`, consultado com o service_role. Sem papel → 403.
//   4. Só então falar com a Evolution API.
//
// `EVOLUTION_API_KEY` só é lida aqui dentro e só é usada no header `apikey`
// das chamadas à Evolution — nunca deve ser devolvida na resposta, em
// mensagem de erro ou em log.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Lidas apenas neste módulo. Nunca logar nem incluir em respostas.
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** instanceName só pode conter caracteres seguros — nunca é usado para montar a URL sem essa checagem. */
function validarInstanceName(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}

function extrairMensagemErro(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.message === "string") return p.message;
    if (Array.isArray(p.message)) return p.message.map(String).join(", ");
    if (typeof p.error === "string") return p.error;
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  return null;
}

type ResultadoEvolution =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

/**
 * Chama a Evolution API. `path` é sempre um template fixo desta função —
 * o único componente vindo do usuário que entra nele é `instanceName`, já
 * validado por regex antes de chegar aqui.
 */
async function chamarEvolution(path: string, method: string, body?: unknown): Promise<ResultadoEvolution> {
  const resp = await fetch(`${EVOLUTION_API_URL}${path}`, {
    method,
    headers: {
      apikey: EVOLUTION_API_KEY,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const texto = await resp.text();
  let payload: unknown = null;
  if (texto) {
    try {
      payload = JSON.parse(texto);
    } catch {
      payload = texto;
    }
  }

  if (!resp.ok) {
    const mensagem = extrairMensagemErro(payload) || `Evolution respondeu ${resp.status}`;
    return { ok: false, status: resp.status, error: mensagem };
  }
  return { ok: true, status: resp.status, data: payload };
}

Deno.serve(async (req) => {
  // 1. CORS.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método não suportado" }, 405);

  try {
    // 2. Resolver usuário pelo JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Não autenticado" }, 401);

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await anon.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ ok: false, error: "Não autenticado" }, 401);

    // 3. Confirmar papel `zapvendas` com o service_role.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: papel, error: papelError } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "zapvendas")
      .maybeSingle();

    if (papelError) {
      console.error("zapvendas: erro ao checar papel", papelError.message);
      return json({ ok: false, error: "Erro ao verificar permissão" }, 500);
    }
    if (!papel) return json({ ok: false, error: "Sem permissão para acessar o ZapVendas" }, 403);

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error("zapvendas: Evolution API não configurada");
      return json({ ok: false, error: "Integração com WhatsApp não configurada" }, 500);
    }

    // Corpo da requisição.
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    const action = body?.action;
    if (typeof action !== "string") return json({ ok: false, error: "Ação inválida" }, 400);

    // 4. Só agora falamos com a Evolution — `action` validada contra lista fechada.
    let resultado: ResultadoEvolution;

    switch (action) {
      case "instances.list": {
        resultado = await chamarEvolution("/instance/fetchInstances", "GET");
        break;
      }

      case "instances.create": {
        const { instanceName } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        resultado = await chamarEvolution("/instance/create", "POST", {
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        });
        break;
      }

      case "instances.qrcode": {
        const { instanceName } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        resultado = await chamarEvolution(`/instance/connect/${instanceName}`, "GET");
        break;
      }

      case "instances.state": {
        const { instanceName } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        resultado = await chamarEvolution(`/instance/connectionState/${instanceName}`, "GET");
        break;
      }

      case "instances.logout": {
        const { instanceName } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        resultado = await chamarEvolution(`/instance/logout/${instanceName}`, "DELETE");
        break;
      }

      case "instances.delete": {
        const { instanceName } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        resultado = await chamarEvolution(`/instance/delete/${instanceName}`, "DELETE");
        break;
      }

      case "chats.list": {
        const { instanceName } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        resultado = await chamarEvolution(`/chat/findChats/${instanceName}`, "POST", {});
        break;
      }

      case "messages.list": {
        const { instanceName, remoteJid } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        if (typeof remoteJid !== "string" || !remoteJid.trim()) {
          return json({ ok: false, error: "remoteJid é obrigatório" }, 400);
        }
        const limiteBruto = Number(body.limit);
        const limit = Number.isFinite(limiteBruto) && limiteBruto > 0 ? Math.min(Math.floor(limiteBruto), 200) : 50;
        resultado = await chamarEvolution(`/chat/findMessages/${instanceName}`, "POST", {
          where: { key: { remoteJid } },
          limit,
        });
        break;
      }

      case "messages.send": {
        const { instanceName, number, text } = body;
        if (!validarInstanceName(instanceName)) return json({ ok: false, error: "instanceName inválido" }, 400);
        if (typeof number !== "string" || !number.trim()) {
          return json({ ok: false, error: "number é obrigatório" }, 400);
        }
        if (typeof text !== "string" || !text.trim()) {
          return json({ ok: false, error: "text é obrigatório" }, 400);
        }
        resultado = await chamarEvolution(`/message/sendText/${instanceName}`, "POST", { number, text });
        break;
      }

      default:
        return json({ ok: false, error: "Ação inválida" }, 400);
    }

    if (!resultado.ok) return json({ ok: false, error: resultado.error }, resultado.status || 502);
    return json({ ok: true, data: resultado.data }, resultado.status || 200);
  } catch (e) {
    // Nunca logar/expor a apikey — o catch só vê `e`, que não a contém.
    console.error("zapvendas: erro inesperado", (e as Error)?.message);
    return json({ ok: false, error: "Erro inesperado ao processar a requisição" }, 500);
  }
});
