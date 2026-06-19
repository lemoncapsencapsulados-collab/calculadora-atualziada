import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

async function asaasGet(path: string, apiKey: string) {
  const r = await fetch(`${ASAAS_BASE_URL}${path}`, {
    headers: { access_token: apiKey, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Asaas GET ${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const apiKey = Deno.env.get("ASAAS_API_KEY");

  try {
    if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

    const payload = await req.json();
    const event: string = payload?.event || "";
    const payment = payload?.payment;
    console.log("[asaas-webhook] event:", event, "paymentId:", payment?.id);

    if (!payment?.id) {
      return new Response(JSON.stringify({ ok: true, ignored: "no payment.id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só interessa confirmações de pagamento
    if (!["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event)) {
      return new Response(JSON.stringify({ ok: true, ignored: event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-busca o pagamento no Asaas como prova de autenticidade
    const paid = await asaasGet(`/payments/${payment.id}`, apiKey);
    if (!["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(paid.status)) {
      return new Response(JSON.stringify({ ok: true, ignored: "status not paid", status: paid.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = paid.customer;
    const installmentId = paid.installment || null;
    const valor = Number(paid.value);
    const paymentDate: string = paid.paymentDate || paid.confirmedDate || new Date().toISOString().slice(0, 10);

    const customer = await asaasGet(`/customers/${customerId}`, apiKey);
    const cpfCnpj = onlyDigits(customer?.cpfCnpj);
    if (!cpfCnpj) throw new Error("Cliente Asaas sem cpfCnpj");

    // Idempotência: já existe esse paymentId registrado?
    const { data: jaRegistrado } = await supabase
      .from("orcamentos")
      .select("id, status, pagamentos_recebidos")
      .or(`asaas_payment_id.eq.${paid.id}`)
      .limit(1);
    if (jaRegistrado && jaRegistrado.length > 0 && jaRegistrado[0].status === "pago") {
      return new Response(JSON.stringify({ ok: true, ignored: "already paid", orcamento_id: jaRegistrado[0].id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se for parcelado, tenta achar orçamento pelo installmentId
    let alvo: any = null;
    if (installmentId) {
      const { data } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("asaas_installment_id", installmentId)
        .limit(1);
      alvo = data?.[0] || null;
    }

    // Senão, procura por CNPJ/CPF nos dados_cliente
    if (!alvo) {
      const { data: candidatos } = await supabase
        .from("orcamentos")
        .select("*")
        .in("status", ["rascunho", "enviado"]);

      const filtrados = (candidatos || []).filter((o: any) => {
        const dc = o.dados_cliente || {};
        const cnpj = onlyDigits(dc.cnpj);
        const cpf = onlyDigits(dc.cpf);
        const pfs = (dc.pessoas_fisicas || []).map((p: any) => onlyDigits(p.cpf));
        const resp = onlyDigits(dc.responsavel_pj?.cpf);
        return cnpj === cpfCnpj || cpf === cpfCnpj || pfs.includes(cpfCnpj) || resp === cpfCnpj;
      });

      if (filtrados.length === 0) {
        await supabase.from("asaas_webhook_pendentes").insert({
          payload,
          cpf_cnpj: cpfCnpj,
          valor,
          asaas_payment_id: paid.id,
          asaas_customer_id: customerId,
          motivo: "nenhum_orcamento_encontrado",
        });
        return new Response(JSON.stringify({ ok: true, pendente: "nenhum encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Match por valor mais próximo (tol R$ 0,01), depois mais recente
      filtrados.sort((a: any, b: any) => {
        const da = Math.abs(Number(a.valor_total) - valor);
        const db = Math.abs(Number(b.valor_total) - valor);
        if (da !== db) return da - db;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      if (filtrados.length > 1 && Math.abs(Number(filtrados[0].valor_total) - valor) > 0.01) {
        await supabase.from("asaas_webhook_pendentes").insert({
          payload,
          cpf_cnpj: cpfCnpj,
          valor,
          asaas_payment_id: paid.id,
          asaas_customer_id: customerId,
          motivo: "multiplos_orcamentos_sem_match_de_valor",
        });
        return new Response(JSON.stringify({ ok: true, pendente: "ambiguo" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      alvo = filtrados[0];
    }

    // Atualiza pagamentos_recebidos
    const recebidos: any[] = Array.isArray(alvo.pagamentos_recebidos) ? alvo.pagamentos_recebidos : [];
    if (!recebidos.find((p) => p.asaas_payment_id === paid.id)) {
      recebidos.push({
        asaas_payment_id: paid.id,
        valor,
        data: paymentDate,
        installment_id: installmentId,
      });
    }

    // Total de parcelas
    let totalParcelas = alvo.asaas_parcelas_total || 1;
    if (installmentId) {
      try {
        const inst = await asaasGet(`/installments/${installmentId}`, apiKey);
        totalParcelas = inst?.installmentCount || inst?.paymentCount || totalParcelas;
      } catch (e) {
        console.log("[asaas-webhook] erro ao buscar installment:", e);
      }
    }

    const tudoPago = recebidos.length >= totalParcelas;

    const patch: any = {
      asaas_payment_id: paid.id,
      asaas_installment_id: installmentId,
      asaas_parcelas_total: totalParcelas,
      pagamentos_recebidos: recebidos,
    };
    if (tudoPago) {
      patch.status = "pago";
      patch.data_pagamento = paymentDate;
    }

    const { error: upErr } = await supabase.from("orcamentos").update(patch).eq("id", alvo.id);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ ok: true, orcamento_id: alvo.id, pago: tudoPago, parcelas: `${recebidos.length}/${totalParcelas}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[asaas-webhook] erro:", err);
    return new Response(JSON.stringify({ error: err?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});