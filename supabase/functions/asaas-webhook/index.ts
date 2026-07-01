import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Webhook do Asaas.
 * Configure no Asaas: URL desta função + header `asaas-access-token` = ASAAS_WEBHOOK_TOKEN.
 * Eventos relevantes: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED_IN_CASH.
 *
 * Fluxo:
 *  1) Valida token.
 *  2) Extrai referências (asaas_payment_id, externalReference, description, installment).
 *  3) Localiza orçamento em aberto (enviado/rascunho) pelo asaas_payment_id/installment
 *     salvo ou por ORC-xxx no externalReference/description.
 *  4) Registra o pagamento em `pagamentos_recebidos` (jsonb) e salva vhsys_valor_pago
 *     acumulado + data.
 *  5) Se contrato assinado E valor total quitado → cria pedido e status='pago'.
 */

const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const N8N_URL = "https://n8n.lemoncaps.com.br/webhook/request-order";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const norm = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

async function log(entry: {
  event?: string; status: string; mensagem?: string; payload?: any; resposta?: any;
  asaas_payment_id?: string | null; asaas_installment_id?: string | null;
  asaas_customer_id?: string | null; cpf_cnpj?: string | null;
  valor?: number | null; orcamento_id?: string | null; pedido_id?: string | null;
}) {
  try {
    await supabase.from("asaas_eventos_log").insert({
      event: entry.event || null,
      status: entry.status,
      mensagem: entry.mensagem || null,
      payload: entry.payload || null,
      resposta: entry.resposta || null,
      asaas_payment_id: entry.asaas_payment_id || null,
      asaas_installment_id: entry.asaas_installment_id || null,
      asaas_customer_id: entry.asaas_customer_id || null,
      cpf_cnpj: entry.cpf_cnpj || null,
      valor: entry.valor ?? null,
      orcamento_id: entry.orcamento_id || null,
      pedido_id: entry.pedido_id || null,
    });
  } catch { /* ignore */ }
}

const RECEIVED_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

function extrairOrcNumeros(txt: string): string[] {
  const m = String(txt || "").match(/ORC-?\d+/gi) || [];
  return m.map((x) => x.toUpperCase().replace("-", "")).map((x) => x.replace(/^ORC/, "ORC-"));
}

function clienteCnpjFromOrc(orc: any): string {
  const dc = orc?.dados_cliente || {};
  if (dc?.cnpj) return onlyDigits(dc.cnpj);
  for (const pf of dc?.pessoas_fisicas || []) if (pf?.cpf) return onlyDigits(pf.cpf);
  if (dc?.responsavel_pj?.cpf) return onlyDigits(dc.responsavel_pj.cpf);
  if (dc?.cpf) return onlyDigits(dc.cpf);
  return "";
}

async function buscarCustomerCpfCnpj(customerId: string): Promise<string> {
  if (!customerId || !ASAAS_API_KEY) return "";
  try {
    const r = await fetch(`https://api.asaas.com/v3/customers/${customerId}`, {
      headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" },
    });
    if (!r.ok) return "";
    const j = await r.json();
    return onlyDigits(j?.cpfCnpj || "");
  } catch { return ""; }
}

async function localizarOrcamento(pay: any, cpfCnpj: string, nomeCli: string): Promise<{ orc: any; motivo: string | null }> {
  const payId = pay?.id || "";
  const installment = pay?.installment || "";

  // 1) Match direto por asaas_payment_id / asaas_installment_id
  if (payId || installment) {
    const or: string[] = [];
    if (payId) or.push(`asaas_payment_id.eq.${payId}`);
    if (installment) or.push(`asaas_installment_id.eq.${installment}`);
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .or(or.join(","))
      .limit(1);
    if (data && data[0]) return { orc: data[0], motivo: null };
  }

  // 2) Match por número ORC-xxx no externalReference / description
  const textoRefs = `${pay?.externalReference || ""} ${pay?.description || ""}`;
  const nums = extrairOrcNumeros(textoRefs);
  if (nums.length) {
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .in("numero_orcamento", nums)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data && data.length) {
      if (cpfCnpj) {
        const match = data.find((o: any) => clienteCnpjFromOrc(o) === cpfCnpj);
        if (match) return { orc: match, motivo: null };
      }
      return { orc: data[0], motivo: null };
    }
  }

  // 3) Match por CPF/CNPJ do cliente com orçamento em aberto
  if (cpfCnpj) {
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .in("status", ["enviado", "rascunho"])
      .order("created_at", { ascending: false })
      .limit(500);
    const matches = (data || []).filter((o: any) => clienteCnpjFromOrc(o) === cpfCnpj);
    if (matches.length === 1) return { orc: matches[0], motivo: null };
    if (matches.length > 1) {
      // Escolhe o de valor mais próximo do total pago da cobrança
      const valor = Number(pay?.value) || 0;
      matches.sort((a: any, b: any) =>
        Math.abs(Number(a.valor_total) - valor) - Math.abs(Number(b.valor_total) - valor));
      return { orc: matches[0], motivo: null };
    }
  }

  // 4) Fallback por nome do cliente
  if (nomeCli) {
    const nn = norm(nomeCli);
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .in("status", ["enviado", "rascunho"])
      .order("created_at", { ascending: false })
      .limit(500);
    const match = (data || []).find((o: any) => norm(o.nome_cliente) === nn);
    if (match) return { orc: match, motivo: null };
  }

  return { orc: null, motivo: "Nenhum orçamento em aberto casou (payId/ORC/CPF/nome)" };
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
  const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", orcId).limit(1).single();
  if (!orc) throw new Error(`Orçamento ${orcId} não encontrado`);
  const { data: exist } = await supabase.from("pedidos").select("id").eq("orcamento_id", orcId).limit(1);
  if (exist && exist.length > 0) return exist[0].id;
  const snapshot = buildSnapshot(orc, dataPgto);
  const totalQtd = (orc.itens_producao || []).reduce((s: number, it: any) => s + (Number(it?.quantidade) || 1), 0);
  const numero = await proximoNumeroPedido();
  const { data: novo, error } = await supabase.from("pedidos").insert([{
    orcamento_id: orcId, orcamento_snapshot: snapshot as any, numero_pedido: numero,
    data_pedido: new Date().toISOString(), data_entrega: dataPgto || new Date().toISOString(),
    quantidade_produto: totalQtd, unidade_produto: "potes",
    status: "aguardando_producao", formula_id: null, formula_snapshot: null,
    observacoes: orc.observacoes || null,
  }]).select("id").single();
  if (error) throw new Error(error.message);
  try {
    await fetch(N8N_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot),
    });
  } catch { /* ignore */ }
  return novo!.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const tokenHeader =
    req.headers.get("asaas-access-token") ||
    req.headers.get("x-asaas-token") ||
    url.searchParams.get("token");
  if (!WEBHOOK_TOKEN || tokenHeader !== WEBHOOK_TOKEN) {
    await log({ status: "erro", mensagem: "Token inválido", payload: null });
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const event = String(payload?.event || "");
  const pay = payload?.payment || {};

  // Só age em eventos de recebimento
  if (!RECEIVED_EVENTS.has(event)) {
    await log({
      event, status: "ignorado",
      mensagem: `Evento ignorado: ${event || "sem evento"}`,
      payload, asaas_payment_id: pay?.id || null,
      valor: Number(pay?.value) || null,
    });
    return new Response(JSON.stringify({ ok: true, ignored: event || "sem evento" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nomeCli = String(pay?.customerName || pay?.customer?.name || "");
  const customerId = String(pay?.customer || "");
  const cpfCnpj = onlyDigits(pay?.cpfCnpj || pay?.customer?.cpfCnpj || "") ||
    (customerId ? await buscarCustomerCpfCnpj(customerId) : "");

  try {
    const { orc, motivo } = await localizarOrcamento(pay, cpfCnpj, nomeCli);
    if (!orc) {
      await supabase.from("asaas_webhook_pendentes").insert({
        payload, cpf_cnpj: cpfCnpj || null, valor: Number(pay?.value) || null,
        asaas_payment_id: pay?.id || null, asaas_customer_id: customerId || null,
        motivo: motivo || "Sem orçamento correspondente",
      });
      await log({
        event, status: "pendente", mensagem: motivo || "Sem orçamento correspondente",
        payload, cpf_cnpj: cpfCnpj, valor: Number(pay?.value) || null,
        asaas_payment_id: pay?.id || null, asaas_installment_id: pay?.installment || null,
        asaas_customer_id: customerId || null,
      });
      return new Response(JSON.stringify({ ok: true, status: "pendente", motivo }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataPgto = String(pay?.paymentDate || pay?.clientPaymentDate || pay?.creditDate || new Date().toISOString()).slice(0, 10);
    const valorPago = Number(pay?.value) || 0;
    const valorLiq = Number(pay?.netValue ?? valorPago) || valorPago;

    // Registra o pagamento na jsonb pagamentos_recebidos (idempotente por payment.id)
    const recebidos = Array.isArray(orc.pagamentos_recebidos) ? orc.pagamentos_recebidos.slice() : [];
    const jaRegistrado = recebidos.some((p: any) => p?.asaas_payment_id === pay?.id);
    if (!jaRegistrado && pay?.id) {
      recebidos.push({
        asaas_payment_id: pay.id,
        asaas_installment_id: pay.installment || null,
        installment_number: pay.installmentNumber ?? null,
        billing_type: pay.billingType || null,
        event,
        valor: valorPago,
        valor_liquido: valorLiq,
        data_pagamento: dataPgto,
        registrado_em: new Date().toISOString(),
      });
    }

    const totalPago = recebidos.reduce((s: number, p: any) => s + (Number(p?.valor) || 0), 0);
    const totalOrc = Number(orc.valor_total) || 0;
    const quitado = totalPago + 0.01 >= totalOrc; // tolerância de centavo

    // Sempre persiste refs Asaas + pagamentos + valor recebido acumulado
    const updates: any = {
      pagamentos_recebidos: recebidos as any,
      vhsys_liquidado_em: dataPgto,
      vhsys_valor_pago: totalPago,
    };
    if (!orc.asaas_payment_id && pay?.id) updates.asaas_payment_id = pay.id;
    if (!orc.asaas_installment_id && pay?.installment) updates.asaas_installment_id = pay.installment;
    await supabase.from("orcamentos").update(updates).eq("id", orc.id);

    // Se contrato não assinado, aguarda
    if (orc.status_contrato !== "assinado") {
      await log({
        event, status: "aguardando_contrato",
        mensagem: `Pagamento registrado, aguardando contrato assinado. Total pago: ${totalPago}/${totalOrc}`,
        payload, cpf_cnpj: cpfCnpj, valor: valorPago,
        asaas_payment_id: pay?.id || null, asaas_installment_id: pay?.installment || null,
        asaas_customer_id: customerId || null, orcamento_id: orc.id,
      });
      return new Response(JSON.stringify({
        ok: true, status: "aguardando_contrato",
        orcamento_id: orc.id, total_pago: totalPago, valor_total: totalOrc, quitado,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Só move para pedidos + status=pago quando quitado
    if (!quitado) {
      await log({
        event, status: "parcial",
        mensagem: `Parcial: ${totalPago}/${totalOrc}`,
        payload, cpf_cnpj: cpfCnpj, valor: valorPago,
        asaas_payment_id: pay?.id || null, asaas_installment_id: pay?.installment || null,
        asaas_customer_id: customerId || null, orcamento_id: orc.id,
      });
      return new Response(JSON.stringify({
        ok: true, status: "parcial", orcamento_id: orc.id,
        total_pago: totalPago, valor_total: totalOrc,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let pedidoId = orc.pedido_id_gerado;
    if (!pedidoId) pedidoId = await criarPedido(orc.id, dataPgto);
    if (orc.status !== "pago" || !orc.pedido_id_gerado) {
      await supabase.from("orcamentos").update({
        status: "pago", data_pagamento: dataPgto, pedido_id_gerado: pedidoId,
      }).eq("id", orc.id);
    }

    await log({
      event, status: "sucesso",
      mensagem: `Orçamento quitado. Pedido ${pedidoId} criado/atualizado.`,
      payload, cpf_cnpj: cpfCnpj, valor: valorPago,
      asaas_payment_id: pay?.id || null, asaas_installment_id: pay?.installment || null,
      asaas_customer_id: customerId || null, orcamento_id: orc.id, pedido_id: pedidoId,
    });
    return new Response(JSON.stringify({
      ok: true, status: "sucesso", orcamento_id: orc.id, pedido_id: pedidoId,
      consultor: orc.consultor_responsavel || null, total_pago: totalPago,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await supabase.from("asaas_webhook_pendentes").insert({
      payload, cpf_cnpj: cpfCnpj || null, valor: Number(pay?.value) || null,
      asaas_payment_id: pay?.id || null, asaas_customer_id: customerId || null,
      motivo: `Erro: ${(e as Error).message}`,
    });
    await log({
      event, status: "erro", mensagem: (e as Error).message,
      payload, cpf_cnpj: cpfCnpj, valor: Number(pay?.value) || null,
      asaas_payment_id: pay?.id || null, asaas_installment_id: pay?.installment || null,
      asaas_customer_id: customerId || null,
    });
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});