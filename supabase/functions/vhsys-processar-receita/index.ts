import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Função CENTRAL reaproveitável.
 * Recebe { id_receita_vhsys, origem } e:
 *  1. consulta a receita no VhSys
 *  2. valida se está liquidada
 *  3. localiza orçamento por CNPJ/CPF + número do orçamento na descrição
 *  4. atualiza orçamento p/ pago e cria pedido (idempotente)
 *  5. registra log em vhsys_eventos_log
 *
 * Protegida por header `x-internal-secret` (VHSYS_WEBHOOK_SECRET).
 */

type Origem = "webhook" | "polling" | "manual";

const ACCESS_TOKEN = Deno.env.get("VHSYS_ACCESS_TOKEN")!;
const SECRET_SERVICE = Deno.env.get("VHSYS_SECRET_SERVICE")!;
const WEBHOOK_SECRET = Deno.env.get("VHSYS_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

async function logEvento(entry: {
  origem: Origem;
  tipo_evento: string;
  id_receita_vhsys?: number | null;
  orcamento_id?: string | null;
  pedido_id?: string | null;
  status: "sucesso" | "pendente" | "ignorado" | "erro";
  mensagem: string;
  payload?: unknown;
  resposta_vhsys?: unknown;
}) {
  try {
    await supabase.from("vhsys_eventos_log").insert({
      origem: entry.origem,
      tipo_evento: entry.tipo_evento,
      id_receita_vhsys: entry.id_receita_vhsys ?? null,
      orcamento_id: entry.orcamento_id ?? null,
      pedido_id: entry.pedido_id ?? null,
      status: entry.status,
      mensagem: entry.mensagem,
      payload: entry.payload ?? null,
      resposta_vhsys: entry.resposta_vhsys ?? null,
    });
  } catch (e) {
    console.error("Falha ao gravar log vhsys", e);
  }
}

async function consultarReceita(id: number) {
  const resp = await fetch(`https://api.vhsys.com.br/v2/receitas/${id}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "access-token": ACCESS_TOKEN,
      "secret-access-token": SECRET_SERVICE,
    },
  });
  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: resp.ok, status: resp.status, body: json ?? text };
}

function isReceitaLiquidada(receita: any) {
  const liq = String(receita?.liquidado_rec ?? receita?.status_rec ?? "").toLowerCase();
  const valorPago = Number(receita?.valor_pago_rec ?? receita?.valor_pago ?? 0);
  const dataPgto = receita?.data_pagamento_rec ?? receita?.data_pagamento ?? null;
  const liquidada =
    liq === "sim" || liq === "s" || liq === "1" || liq === "true" || liq === "liquidado" || liq === "pago";
  return liquidada && valorPago > 0 && !!dataPgto;
}

function extrairCnpjCpf(receita: any): string {
  return onlyDigits(
    receita?.cnpj_cli ??
      receita?.cpf_cli ??
      receita?.cnpj_cpf_cli ??
      receita?.cliente?.cnpj_cliente ??
      receita?.cliente?.cnpj_cpf ??
      "",
  );
}

function extrairObservacao(receita: any): string {
  return String(
    receita?.obs_rec ?? receita?.observacao_rec ?? receita?.descricao_rec ?? receita?.historico_rec ?? "",
  );
}

function clienteCnpjFromOrc(orc: any): string {
  const dc = orc?.dados_cliente || {};
  if (dc?.cnpj) return onlyDigits(dc.cnpj);
  const pfs = dc?.pessoas_fisicas || [];
  for (const pf of pfs) if (pf?.cpf) return onlyDigits(pf.cpf);
  if (dc?.responsavel_pj?.cpf) return onlyDigits(dc.responsavel_pj.cpf);
  if (dc?.cpf) return onlyDigits(dc.cpf);
  return "";
}

async function localizarOrcamento(receita: any) {
  const cnpjCpf = extrairCnpjCpf(receita);
  const obs = extrairObservacao(receita);
  if (!cnpjCpf || !obs) return { orcamento: null, motivo: "Receita sem CNPJ/CPF ou observação" };

  // Extrai o nº do orçamento da observação (formato livre: "ORC-2026-0123", "Orçamento 0123", etc).
  const matches = obs.match(/[A-Z]{0,5}-?\d{2,}(?:-?\d{2,})*/gi) || [];
  if (!matches.length) return { orcamento: null, motivo: "Nenhum número de orçamento encontrado na observação" };

  const { data: orcs, error } = await supabase
    .from("orcamentos")
    .select("id, numero_orcamento, status, status_contrato, dados_cliente, pedido_id_gerado, id_receita_vhsys")
    .in("status", ["enviado", "rascunho", "pago"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  for (const orc of orcs || []) {
    const cnpjOrc = clienteCnpjFromOrc(orc);
    if (!cnpjOrc || cnpjOrc !== cnpjCpf) continue;
    const num = String(orc.numero_orcamento || "");
    if (!num) continue;
    if (matches.some((m) => m.toUpperCase().includes(num.toUpperCase()) || num.toUpperCase().includes(m.toUpperCase()))) {
      return { orcamento: orc, motivo: null };
    }
  }
  return { orcamento: null, motivo: `Nenhum orçamento encontrado para CNPJ/CPF ${cnpjCpf}` };
}

async function proximoNumeroPedido(): Promise<string> {
  const { data } = await supabase
    .from("pedidos")
    .select("numero_pedido")
    .like("numero_pedido", "PED-%");
  let max = 0;
  (data || []).forEach((p: any) => {
    const m = String(p.numero_pedido || "").match(/PED-(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return `PED-${(max + 1).toString().padStart(3, "0")}`;
}

function buildSnapshot(orc: any, data_pagamento: string) {
  return {
    id: orc.id,
    numero_orcamento: orc.numero_orcamento,
    nome_cliente: orc.nome_cliente,
    consultor_responsavel: orc.consultor_responsavel || undefined,
    tipo_orcamento: orc.tipo_orcamento || "novo_produtor",
    itens_producao: orc.itens_producao || [],
    servicos_marca: orc.servicos_marca || [],
    dados_cliente: orc.dados_cliente || undefined,
    detalhamento_frete: orc.detalhamento_frete || undefined,
    condicoes_pagamento: orc.condicoes_pagamento || undefined,
    subtotal_producao: Number(orc.subtotal_producao) || 0,
    subtotal_servicos: Number(orc.subtotal_servicos) || 0,
    valor_total: Number(orc.valor_total) || 0,
    data_pagamento,
    observacoes: orc.observacoes || undefined,
    updated_at: orc.updated_at || undefined,
  };
}

async function criarPedidoDoOrcamento(orcamentoId: string, dataPagamento: string) {
  const { data: orcCompleto, error: errOrc } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", orcamentoId)
    .limit(1)
    .single();
  if (errOrc || !orcCompleto) throw new Error(`Orçamento ${orcamentoId} não encontrado: ${errOrc?.message}`);

  const { data: existentes } = await supabase
    .from("pedidos").select("id").eq("orcamento_id", orcamentoId).limit(1);
  if (existentes && existentes.length > 0) return { pedidoId: existentes[0].id, criado: false };

  const snapshot = buildSnapshot(orcCompleto, dataPagamento);
  const totalQtd = (orcCompleto.itens_producao || []).reduce(
    (s: number, it: any) => s + (Number(it?.quantidade) || 1), 0,
  );
  const numero = await proximoNumeroPedido();

  const { data: novo, error: errPed } = await supabase
    .from("pedidos")
    .insert([{
      orcamento_id: orcamentoId,
      orcamento_snapshot: snapshot as any,
      numero_pedido: numero,
      data_pedido: new Date().toISOString(),
      data_entrega: dataPagamento || new Date().toISOString(),
      quantidade_produto: totalQtd,
      unidade_produto: "potes",
      status: "aguardando_producao",
      formula_id: null,
      formula_snapshot: null,
      observacoes: orcCompleto.observacoes || null,
    }])
    .select("id").single();
  if (errPed) throw new Error(`Erro ao criar pedido: ${errPed.message}`);

  // Webhook n8n (best-effort, padrão do projeto)
  try {
    await fetch("https://n8n.lemoncaps.com.br/webhook/request-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
  } catch { /* ignore */ }

  return { pedidoId: novo!.id, criado: true };
}

export async function processarReceita(
  idReceita: number,
  origem: Origem,
  tipoEvento = "receita.verificar",
  payload?: unknown,
) {
  if (!idReceita || !Number.isFinite(idReceita)) {
    await logEvento({ origem, tipo_evento: tipoEvento, status: "erro", mensagem: "id_receita_vhsys ausente/inválido", payload });
    return { ok: false, status: "erro", mensagem: "id_receita inválido" };
  }

  let consulta;
  try {
    consulta = await consultarReceita(idReceita);
  } catch (e) {
    const msg = (e as Error).message;
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, status: "erro", mensagem: `Falha ao consultar VhSys: ${msg}`, payload });
    return { ok: false, status: "erro", mensagem: msg };
  }

  if (!consulta.ok) {
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, status: "erro", mensagem: `VhSys respondeu ${consulta.status}`, payload, resposta_vhsys: consulta.body });
    return { ok: false, status: "erro", mensagem: `VhSys ${consulta.status}` };
  }

  const receita = consulta.body?.data ?? consulta.body;

  if (!isReceitaLiquidada(receita)) {
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, status: "pendente", mensagem: "Receita ainda não liquidada", resposta_vhsys: receita });
    return { ok: true, status: "pendente", mensagem: "Não liquidada" };
  }

  const { orcamento, motivo } = await localizarOrcamento(receita);
  if (!orcamento) {
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, status: "ignorado", mensagem: motivo || "Orçamento não encontrado", resposta_vhsys: receita });
    return { ok: true, status: "ignorado", mensagem: motivo };
  }

  // Idempotência
  if (orcamento.pedido_id_gerado) {
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, orcamento_id: orcamento.id, pedido_id: orcamento.pedido_id_gerado, status: "ignorado", mensagem: "Orçamento já convertido em pedido" });
    return { ok: true, status: "ignorado", mensagem: "Já convertido" };
  }

  const dataPgto = String(receita?.data_pagamento_rec ?? receita?.data_pagamento ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const valorPago = Number(receita?.valor_pago_rec ?? receita?.valor_pago ?? 0);

  // Sempre registra a liquidação no orçamento
  await supabase.from("orcamentos").update({
    id_receita_vhsys: idReceita,
    vhsys_liquidado_em: dataPgto,
    vhsys_valor_pago: valorPago,
  }).eq("id", orcamento.id);

  // Só gera pedido + marca como pago quando o contrato estiver assinado
  if ((orcamento as any).status_contrato !== 'assinado') {
    await logEvento({
      origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
      orcamento_id: orcamento.id, status: "pendente",
      mensagem: `VHSys liquidado (R$ ${valorPago.toFixed(2)}) — aguardando contrato assinado para gerar pedido`,
      resposta_vhsys: receita,
    });
    return { ok: true, status: "aguardando_contrato", mensagem: "Aguardando contrato assinado" };
  }

  let pedidoId: string;
  try {
    const r = await criarPedidoDoOrcamento(orcamento.id, dataPgto);
    pedidoId = r.pedidoId;
  } catch (e) {
    const msg = (e as Error).message;
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, orcamento_id: orcamento.id, status: "erro", mensagem: msg, resposta_vhsys: receita });
    return { ok: false, status: "erro", mensagem: msg };
  }

  const { error: upErr } = await supabase
    .from("orcamentos")
    .update({
      status: "pago",
      data_pagamento: dataPgto,
      id_receita_vhsys: idReceita,
      pedido_id_gerado: pedidoId,
    })
    .eq("id", orcamento.id);
  if (upErr) {
    await logEvento({ origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita, orcamento_id: orcamento.id, pedido_id: pedidoId, status: "erro", mensagem: `Pedido criado, mas falha ao atualizar orçamento: ${upErr.message}` });
    return { ok: false, status: "erro", mensagem: upErr.message };
  }

  await logEvento({
    origem, tipo_evento: tipoEvento, id_receita_vhsys: idReceita,
    orcamento_id: orcamento.id, pedido_id: pedidoId,
    status: "sucesso",
    mensagem: `Orçamento ${orcamento.numero_orcamento} convertido em pedido (valor pago R$ ${valorPago.toFixed(2)})`,
    resposta_vhsys: receita,
  });

  return { ok: true, status: "sucesso", orcamento_id: orcamento.id, pedido_id: pedidoId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Aceita: (a) chamada interna com x-internal-secret, OU (b) usuário autenticado (reprocessamento manual da UI)
  const headerSecret = req.headers.get("x-internal-secret");
  let autorizado = !!(WEBHOOK_SECRET && headerSecret === WEBHOOK_SECRET);
  if (!autorizado) {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (jwt) {
      try {
        const { data, error } = await supabase.auth.getUser(jwt);
        if (!error && data?.user) autorizado = true;
      } catch { /* */ }
    }
  }
  if (!autorizado) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const idReceita = Number(body?.id_receita_vhsys ?? body?.id_receita);
    const origem = (body?.origem as Origem) || "manual";
    const tipoEvento = String(body?.tipo_evento || "receita.verificar");

    const r = await processarReceita(idReceita, origem, tipoEvento, body);
    return new Response(JSON.stringify(r), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vhsys-processar-receita error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});