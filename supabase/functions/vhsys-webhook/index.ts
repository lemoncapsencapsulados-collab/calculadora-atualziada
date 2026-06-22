import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Webhook do VHSys (entidade=contas_receber).
 * Faz o casamento direto pelo payload — SEM consultar a API do VHSys.
 * Regras de match:
 *   - CNPJ/CPF do cliente (no payload)  ==  CNPJ/CPF do orçamento
 *   - Número do orçamento aparece na observação/descrição/histórico da conta
 *   - Conta precisa estar liquidada (liquidado_rec = "S"/"sim"/true) com valor_pago > 0
 */

const WEBHOOK_SECRET = Deno.env.get("VHSYS_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WEBHOOK_USER = "lemoncaps_vhsys";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function onlyDigits(v: unknown) { return String(v ?? "").replace(/\D/g, ""); }

function extrairReceita(payload: any): any {
  // VHSys envia payloads variados. Tenta achar o objeto da conta a receber.
  if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload?.data) && payload.data[0]) return payload.data[0];
  if (payload?.dados && typeof payload.dados === "object") return payload.dados;
  return payload || {};
}

function extrairIdReceita(r: any): number | null {
  for (const c of [r?.id_receita, r?.id_rec, r?.id]) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extrairCnpjCpf(r: any): string {
  return onlyDigits(
    r?.cnpj_cli ?? r?.cpf_cli ?? r?.cnpj_cpf_cli ??
    r?.cliente?.cnpj_cliente ?? r?.cliente?.cnpj_cpf ?? r?.cliente?.cnpj ?? r?.cliente?.cpf ?? "",
  );
}

function extrairObservacao(r: any): string {
  return String(
    r?.obs_rec ?? r?.observacao_rec ?? r?.descricao_rec ?? r?.historico_rec ??
    r?.descricao ?? r?.observacao ?? r?.observacoes ?? "",
  ) + " " + String(r?.numero_documento ?? r?.num_documento ?? "");
}

function extrairNomeCliente(r: any): string {
  return String(
    r?.razao_cliente ?? r?.nome_cli ?? r?.cliente?.razao_cliente ?? r?.cliente?.nome ?? "",
  );
}

function isLiquidada(r: any): boolean {
  const liq = String(r?.liquidado_rec ?? r?.liquidado ?? r?.status_rec ?? "").toLowerCase();
  const valor = Number(r?.valor_pago_rec ?? r?.valor_pago ?? 0);
  const ok = ["s", "sim", "1", "true", "liquidado", "pago"].includes(liq);
  return ok && valor > 0;
}

function clienteCnpjFromOrc(orc: any): string {
  const dc = orc?.dados_cliente || {};
  if (dc?.cnpj) return onlyDigits(dc.cnpj);
  for (const pf of dc?.pessoas_fisicas || []) if (pf?.cpf) return onlyDigits(pf.cpf);
  if (dc?.responsavel_pj?.cpf) return onlyDigits(dc.responsavel_pj.cpf);
  if (dc?.cpf) return onlyDigits(dc.cpf);
  return "";
}

function normNome(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

async function localizarOrcamento(cnpjCpf: string, obs: string, nomeCli: string) {
  if (!obs && !cnpjCpf) return { orc: null, motivo: "Payload sem observação nem CNPJ/CPF" };
  const matches = obs.match(/ORC-?\d+|[A-Z]{2,5}-?\d{2,}/gi) || [];
  if (!matches.length) return { orc: null, motivo: "Nenhum número de orçamento na observação" };

  const { data: orcs, error } = await supabase
    .from("orcamentos")
    .select("id, numero_orcamento, nome_cliente, status, dados_cliente, pedido_id_gerado, id_receita_vhsys")
    .in("status", ["enviado", "rascunho"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const nomeCliNorm = normNome(nomeCli);
  for (const o of orcs || []) {
    const num = String(o.numero_orcamento || "");
    if (!num) continue;
    const matchNum = matches.some((m) => m.toUpperCase().replace(/-/g, "") === num.toUpperCase().replace(/-/g, ""));
    if (!matchNum) continue;

    // Se payload tem CNPJ, confere. Senão, confere por nome (se houver) ou aceita só pelo número.
    if (cnpjCpf) {
      if (clienteCnpjFromOrc(o) === cnpjCpf) return { orc: o, motivo: null };
      continue;
    }
    if (nomeCliNorm) {
      const orcNome = normNome(o.nome_cliente || "");
      if (orcNome && (orcNome.includes(nomeCliNorm.split(" ")[0]) || nomeCliNorm.includes(orcNome.split(" ")[0]))) {
        return { orc: o, motivo: null };
      }
      continue;
    }
    return { orc: o, motivo: null };
  }
  return { orc: null, motivo: `Nenhum orçamento casou (nº ${matches.join(", ")}, cnpj '${cnpjCpf}', cliente '${nomeCli}')` };
}

async function proximoNumeroPedido(): Promise<string> {
  const { data } = await supabase.from("pedidos").select("numero_pedido").like("numero_pedido", "PED-%");
  let max = 0;
  (data || []).forEach((p: any) => {
    const m = String(p.numero_pedido || "").match(/PED-(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return `PED-${(max + 1).toString().padStart(3, "0")}`;
}

function buildSnapshot(orc: any, data_pagamento: string) {
  return {
    id: orc.id, numero_orcamento: orc.numero_orcamento, nome_cliente: orc.nome_cliente,
    consultor_responsavel: orc.consultor_responsavel || undefined,
    tipo_orcamento: orc.tipo_orcamento || "novo_produtor",
    itens_producao: orc.itens_producao || [], servicos_marca: orc.servicos_marca || [],
    dados_cliente: orc.dados_cliente || undefined,
    detalhamento_frete: orc.detalhamento_frete || undefined,
    condicoes_pagamento: orc.condicoes_pagamento || undefined,
    subtotal_producao: Number(orc.subtotal_producao) || 0,
    subtotal_servicos: Number(orc.subtotal_servicos) || 0,
    valor_total: Number(orc.valor_total) || 0,
    data_pagamento, observacoes: orc.observacoes || undefined,
    updated_at: orc.updated_at || undefined,
  };
}

async function criarPedido(orcId: string, dataPgto: string) {
  const { data: orcCompleto, error } = await supabase.from("orcamentos").select("*").eq("id", orcId).limit(1).single();
  if (error || !orcCompleto) throw new Error(`Orçamento ${orcId} não encontrado`);
  const { data: existentes } = await supabase.from("pedidos").select("id").eq("orcamento_id", orcId).limit(1);
  if (existentes && existentes.length > 0) return existentes[0].id;
  const snapshot = buildSnapshot(orcCompleto, dataPgto);
  const totalQtd = (orcCompleto.itens_producao || []).reduce((s: number, it: any) => s + (Number(it?.quantidade) || 1), 0);
  const numero = await proximoNumeroPedido();
  const { data: novo, error: err2 } = await supabase.from("pedidos").insert([{
    orcamento_id: orcId, orcamento_snapshot: snapshot as any, numero_pedido: numero,
    data_pedido: new Date().toISOString(), data_entrega: dataPgto || new Date().toISOString(),
    quantidade_produto: totalQtd, unidade_produto: "potes",
    status: "aguardando_producao", formula_id: null, formula_snapshot: null,
    observacoes: orcCompleto.observacoes || null,
  }]).select("id").single();
  if (err2) throw new Error(err2.message);
  try {
    await fetch("https://n8n.lemoncaps.com.br/webhook/request-order", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot),
    });
  } catch { /* ignore */ }
  return novo!.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = req.headers.get("x-vhsys-secret") || req.headers.get("secret-access-token");

  let basicOk = false;
  const authz = req.headers.get("authorization") || "";
  if (authz.toLowerCase().startsWith("basic ")) {
    try {
      const [u, p] = atob(authz.slice(6).trim()).split(":");
      basicOk = u === WEBHOOK_USER && p === WEBHOOK_SECRET;
    } catch { /* ignore */ }
  }

  const ok = WEBHOOK_SECRET && (basicOk || headerSecret === WEBHOOK_SECRET || querySecret === WEBHOOK_SECRET);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const tipoEvento = String(payload?.evento || payload?.event || payload?.entidade || "contas_receber.webhook");
  const receita = extrairReceita(payload);
  const idReceita = extrairIdReceita(receita);
  const cnpj = extrairCnpjCpf(receita);
  const obs = extrairObservacao(receita);
  const nomeCli = extrairNomeCliente(receita);

  // 1) Liquidada?
  if (!isLiquidada(receita)) {
    await supabase.from("vhsys_eventos_log").insert({
      origem: "webhook", tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
      status: "pendente", mensagem: "Conta a receber ainda não liquidada (ignorada)",
      payload, resposta_vhsys: receita,
    });
    return new Response(JSON.stringify({ ok: true, status: "pendente" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) Match
  try {
    const { orc, motivo } = await localizarOrcamento(cnpj, obs, nomeCli);
    if (!orc) {
      await supabase.from("vhsys_eventos_log").insert({
        origem: "webhook", tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
        status: "ignorado", mensagem: motivo || "Sem orçamento correspondente",
        payload, resposta_vhsys: receita,
      });
      return new Response(JSON.stringify({ ok: true, status: "ignorado", motivo }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (orc.pedido_id_gerado) {
      await supabase.from("vhsys_eventos_log").insert({
        origem: "webhook", tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
        orcamento_id: orc.id, pedido_id: orc.pedido_id_gerado,
        status: "ignorado", mensagem: "Orçamento já convertido em pedido",
      });
      return new Response(JSON.stringify({ ok: true, status: "ignorado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataPgto = String(receita?.data_pagamento_rec ?? receita?.data_pagamento ?? receita?.vencimento ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const valorPago = Number(receita?.valor_pago_rec ?? receita?.valor_pago ?? 0);
    const pedidoId = await criarPedido(orc.id, dataPgto);

    await supabase.from("orcamentos").update({
      status: "pago", data_pagamento: dataPgto,
      id_receita_vhsys: idReceita, pedido_id_gerado: pedidoId,
    }).eq("id", orc.id);

    await supabase.from("vhsys_eventos_log").insert({
      origem: "webhook", tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
      orcamento_id: orc.id, pedido_id: pedidoId, status: "sucesso",
      mensagem: `Orçamento ${orc.numero_orcamento} convertido em pedido (R$ ${valorPago.toFixed(2)})`,
      payload, resposta_vhsys: receita,
    });

    return new Response(JSON.stringify({ ok: true, status: "sucesso", orcamento_id: orc.id, pedido_id: pedidoId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("vhsys_eventos_log").insert({
      origem: "webhook", tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
      status: "erro", mensagem: (e as Error).message, payload, resposta_vhsys: receita,
    });
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});