import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Rotina horária de fallback:
 * - Pega orçamentos com status 'enviado' dos últimos 90 dias.
 * - Para os já com id_receita_vhsys → rebusca status na API.
 * - Para os sem vínculo → consulta receitas do CNPJ/CPF do cliente e tenta casar pelo nº do orçamento na obs.
 * Pode ser chamada também manualmente pelo admin (via header x-internal-secret).
 */

const ACCESS_TOKEN = Deno.env.get("VHSYS_ACCESS_TOKEN")!;
const SECRET_SERVICE = Deno.env.get("VHSYS_SECRET_SERVICE")!;
const WEBHOOK_SECRET = Deno.env.get("VHSYS_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function onlyDigits(v: unknown) { return String(v ?? "").replace(/\D/g, ""); }

function clienteCnpjFromOrc(orc: any): string {
  const dc = orc?.dados_cliente || {};
  if (dc?.cnpj) return onlyDigits(dc.cnpj);
  for (const pf of dc?.pessoas_fisicas || []) if (pf?.cpf) return onlyDigits(pf.cpf);
  if (dc?.responsavel_pj?.cpf) return onlyDigits(dc.responsavel_pj.cpf);
  if (dc?.cpf) return onlyDigits(dc.cpf);
  return "";
}

async function callCore(idReceita: number, origem: "polling" | "manual") {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/vhsys-processar-receita`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": WEBHOOK_SECRET,
      "Authorization": `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({ id_receita_vhsys: idReceita, origem, tipo_evento: "receita.polling" }),
  });
  return await resp.json().catch(() => ({}));
}

async function listarReceitasDoCliente(cnpjCpf: string): Promise<any[]> {
  // Tenta listar receitas filtrando pelo CNPJ/CPF. A doc do VhSys aceita filtros via querystring;
  // como o nome do parâmetro pode variar, tentamos 2 chaves comuns.
  const tentativas = [
    `https://api.vhsys.com.br/v2/receitas?cnpj_cli=${cnpjCpf}&limit=50`,
    `https://api.vhsys.com.br/v2/receitas?cnpj_cpf=${cnpjCpf}&limit=50`,
  ];
  for (const url of tentativas) {
    try {
      const r = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "access-token": ACCESS_TOKEN,
          "secret-access-token": SECRET_SERVICE,
        },
      });
      if (!r.ok) continue;
      const json = await r.json().catch(() => null);
      const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      if (arr.length) return arr;
    } catch { /* ignore */ }
  }
  return [];
}

function obsContemNumero(receita: any, numero: string) {
  const obs = String(
    receita?.obs_rec ?? receita?.observacao_rec ?? receita?.descricao_rec ?? receita?.historico_rec ?? "",
  ).toUpperCase();
  return obs.includes(numero.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Autenticação leve: aceita service role (cron via pg_net) OU x-internal-secret (chamada manual da UI)
  const headerSecret = req.headers.get("x-internal-secret");
  const auth = req.headers.get("authorization") || "";
  const okSecret = WEBHOOK_SECRET && headerSecret === WEBHOOK_SECRET;
  const okServiceRole = auth === `Bearer ${SERVICE_ROLE}`;
  if (!okSecret && !okServiceRole) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const origem: "polling" | "manual" = okSecret && !okServiceRole ? "manual" : "polling";

  // Orçamentos elegíveis: enviado nos últimos 90 dias
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data: orcs, error } = await supabase
    .from("orcamentos")
    .select("id, numero_orcamento, status, dados_cliente, id_receita_vhsys, pedido_id_gerado, created_at")
    .eq("status", "enviado")
    .gte("created_at", cutoff)
    .limit(200);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processados = 0, casados = 0, jaPagos = 0;

  for (const orc of orcs || []) {
    if (orc.pedido_id_gerado) { jaPagos++; continue; }
    try {
      if (orc.id_receita_vhsys) {
        await callCore(Number(orc.id_receita_vhsys), origem);
        processados++;
        continue;
      }
      const cnpj = clienteCnpjFromOrc(orc);
      if (!cnpj) continue;
      const receitas = await listarReceitasDoCliente(cnpj);
      const match = receitas.find((r) => obsContemNumero(r, String(orc.numero_orcamento || "")));
      if (!match) continue;
      const idRec = Number(match?.id_receita ?? match?.id_rec ?? match?.id);
      if (!Number.isFinite(idRec) || idRec <= 0) continue;
      await callCore(idRec, origem);
      processados++; casados++;
    } catch (e) {
      console.error("Cron VHSys erro no orçamento", orc.id, e);
    }
  }

  await supabase.from("vhsys_eventos_log").insert({
    origem,
    tipo_evento: "cron.execucao",
    status: "sucesso",
    mensagem: `Rotina executada: ${processados} processados, ${casados} casados por busca, ${jaPagos} já convertidos, total elegíveis ${orcs?.length || 0}`,
  });

  return new Response(JSON.stringify({ ok: true, processados, casados, jaPagos, total: orcs?.length || 0 }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});