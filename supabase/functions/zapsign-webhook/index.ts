import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Webhook público chamado pela ZapSign quando há eventos em um documento.
 * Configurar em ZapSign → Configurações → Webhooks com URL:
 *   https://<project>.functions.supabase.co/zapsign-webhook
 *
 * Eventos relevantes: "doc_signed" (todos assinaram), "doc_refused", "doc_deleted".
 * Quando assinado, baixa o PDF assinado, faz upload em pedidos-anexos
 * e cria registro em pedido_anexos (tipo=contrato) se o pedido já existir.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Healthcheck
  if (req.method === "GET") {
    return jsonResp({ ok: true, endpoint: "zapsign-webhook" });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  let payload: any = null;
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch (e: any) {
    return jsonResp({ error: "JSON inválido", details: e?.message }, 400);
  }

  console.log("zapsign-webhook recebido:", JSON.stringify(payload).slice(0, 1000));

  // ZapSign envia o token do documento + um campo "event_type" (ou "status")
  const token: string | undefined =
    payload?.token || payload?.doc_token || payload?.open_id || payload?.document?.token;
  const eventType: string =
    payload?.event_type || payload?.status || payload?.event || "";

  if (!token) {
    return jsonResp({ error: "Payload sem token do documento", payload }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Localiza o contrato cadastrado quando foi criado
  const { data: contrato, error: findErr } = await supabase
    .from("contratos_zapsign")
    .select("*")
    .eq("zapsign_token", token)
    .maybeSingle();

  if (findErr) {
    console.error("Erro buscando contrato:", findErr);
    return jsonResp({ error: "Erro ao buscar contrato", details: findErr.message }, 500);
  }

  if (!contrato) {
    // Aceitamos o webhook mesmo sem registro local (evita reenvios pela ZapSign)
    console.warn("Webhook recebido para token desconhecido:", token);
    return jsonResp({ ok: true, warning: "Token não encontrado em contratos_zapsign" });
  }

  // Só consideramos assinado quando TODOS os signatários concluíram.
  // ZapSign dispara "doc_signed" apenas nesse momento; "signer_signed" é parcial e deve ser ignorado.
  const docStatus = (payload?.status || payload?.document?.status || "").toString().toLowerCase();
  const signers: any[] = Array.isArray(payload?.signers)
    ? payload.signers
    : Array.isArray(payload?.document?.signers)
      ? payload.document.signers
      : [];
  const todosAssinaram = signers.length > 0 && signers.every((s: any) => {
    const st = (s?.status || "").toString().toLowerCase();
    return st === "signed" || !!s?.signed_at || s?.times_viewed_pdf_by_signer != null && s?.signed === true;
  });

  const isSigned =
    eventType === "doc_signed" ||
    docStatus === "signed" ||
    todosAssinaram;

  const isRefused = eventType === "doc_refused" || docStatus === "refused";

  // Atualização de status básica
  const updates: Record<string, any> = {
    webhook_raw: payload,
  };

  if (isRefused) {
    updates.status = "refused";
  }

  let pedidoAnexoCriado = false;

  if (isSigned) {
    updates.status = "signed";
    updates.signed_at = new Date().toISOString();

    // URL do PDF assinado (preferimos signed_file)
    const signedUrl: string | undefined =
      payload?.signed_file || payload?.signed_file_url || payload?.original_file;

    if (signedUrl) {
      try {
        // Baixa o PDF e armazena em storage para garantir disponibilidade
        const pdfResp = await fetch(signedUrl);
        if (pdfResp.ok) {
          const arrayBuffer = await pdfResp.arrayBuffer();
          const pedidoIdPath = contrato.pedido_id || `sem-pedido/${contrato.orcamento_id || "sem-orcamento"}`;
          const fileName = `zapsign_${token.slice(0, 8)}_${Date.now()}.pdf`;
          const storagePath = `${pedidoIdPath}/contrato/${fileName}`;

          const { error: upErr } = await supabase.storage
            .from("pedidos-anexos")
            .upload(storagePath, new Uint8Array(arrayBuffer), {
              contentType: "application/pdf",
              upsert: true,
            });

          if (upErr) {
            console.error("Erro upload PDF assinado:", upErr);
            updates.signed_file_url = signedUrl; // fallback: URL externa da ZapSign
          } else {
            const { data: pub } = supabase.storage
              .from("pedidos-anexos")
              .getPublicUrl(storagePath);
            updates.signed_file_path = storagePath;
            updates.signed_file_url = pub.publicUrl;
          }
        } else {
          console.warn("Falha ao baixar signed_file:", pdfResp.status);
          updates.signed_file_url = signedUrl;
        }
      } catch (e: any) {
        console.error("Erro processando PDF:", e);
        updates.signed_file_url = signedUrl;
      }
    }

    // Se já existe pedido vinculado, cria anexo
    let pedidoId = contrato.pedido_id;
    if (!pedidoId && contrato.orcamento_id) {
      const { data: pedidoMatch } = await supabase
        .from("pedidos")
        .select("id")
        .eq("orcamento_id", contrato.orcamento_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pedidoMatch?.id) {
        pedidoId = pedidoMatch.id;
        updates.pedido_id = pedidoId;
      }
    }

    if (pedidoId && updates.signed_file_url) {
      // Evita duplicar
      const { data: existente } = await supabase
        .from("pedido_anexos")
        .select("id")
        .eq("pedido_id", pedidoId)
        .eq("tipo", "contrato")
        .eq("arquivo_url", updates.signed_file_url)
        .maybeSingle();

      if (!existente) {
        const nomeArquivo = `Contrato assinado - ${contrato.signer_name || "ZapSign"}.pdf`;
        const { error: anexoErr } = await supabase.from("pedido_anexos").insert({
          pedido_id: pedidoId,
          tipo: "contrato",
          arquivo_url: updates.signed_file_url,
          arquivo_nome: nomeArquivo,
        });
        if (anexoErr) {
          console.error("Erro criando pedido_anexo:", anexoErr);
        } else {
          pedidoAnexoCriado = true;
        }
      }
    }
  }

  const { error: updErr } = await supabase
    .from("contratos_zapsign")
    .update(updates)
    .eq("id", contrato.id);

  if (updErr) {
    console.error("Erro atualizando contrato:", updErr);
    return jsonResp({ error: "Erro ao atualizar contrato", details: updErr.message }, 500);
  }

  // Marca status_contrato no orçamento e, se VHSys já tiver liquidado, converte em pedido
  let pedidoCriadoId: string | null = null;
  if (contrato.orcamento_id && (isSigned || isRefused)) {
    const novoStatus = isRefused ? 'recusado' : 'assinado';
    const patch: Record<string, any> = { status_contrato: novoStatus };
    if (isSigned) patch.contrato_assinado_em = new Date().toISOString();
    await supabase.from("orcamentos").update(patch).eq("id", contrato.orcamento_id);

    if (isSigned) {
      const { data: orc } = await supabase
        .from("orcamentos")
        .select("id, vhsys_liquidado_em, pedido_id_gerado, status")
        .eq("id", contrato.orcamento_id)
        .maybeSingle();
      if (orc && orc.vhsys_liquidado_em && !orc.pedido_id_gerado) {
        try {
          pedidoCriadoId = await criarPedidoDeOrcamento(supabase, orc.id, String(orc.vhsys_liquidado_em).slice(0, 10));
          await supabase
            .from("orcamentos")
            .update({ status: 'pago', data_pagamento: orc.vhsys_liquidado_em, pedido_id_gerado: pedidoCriadoId })
            .eq("id", orc.id);
          await supabase.from("vhsys_eventos_log").insert({
            origem: "zapsign", tipo_evento: "contrato_assinado", orcamento_id: orc.id, pedido_id: pedidoCriadoId,
            status: "sucesso", mensagem: "Contrato assinado + VHSys liquidado → pedido criado",
          });
        } catch (e) {
          console.error("Erro criando pedido após assinatura:", e);
        }
      }
    }
  }

  return jsonResp({
    ok: true,
    contrato_id: contrato.id,
    status: updates.status || contrato.status,
    pedido_anexo_criado: pedidoAnexoCriado,
    pedido_criado_id: pedidoCriadoId,
  });
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
async function proximoNumeroPedido(supabase: any): Promise<string> {
  const { data } = await supabase.from("pedidos").select("numero_pedido").like("numero_pedido", "PED-%");
  let max = 0;
  (data || []).forEach((p: any) => {
    const m = String(p.numero_pedido || "").match(/PED-(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return `PED-${(max + 1).toString().padStart(3, "0")}`;
}

async function criarPedidoDeOrcamento(supabase: any, orcId: string, dataPgto: string): Promise<string> {
  const { data: orc, error } = await supabase.from("orcamentos").select("*").eq("id", orcId).limit(1).single();
  if (error || !orc) throw new Error(`Orçamento ${orcId} não encontrado`);
  const { data: existentes } = await supabase.from("pedidos").select("id").eq("orcamento_id", orcId).limit(1);
  if (existentes && existentes.length > 0) return existentes[0].id;
  const snapshot = {
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
    data_pagamento: dataPgto, observacoes: orc.observacoes || undefined,
    updated_at: orc.updated_at || undefined,
  };
  const totalQtd = (orc.itens_producao || []).reduce((s: number, it: any) => s + (Number(it?.quantidade) || 1), 0);
  const numero = await proximoNumeroPedido(supabase);
  const { data: novo, error: err2 } = await supabase.from("pedidos").insert([{
    orcamento_id: orcId, orcamento_snapshot: snapshot as any, numero_pedido: numero,
    data_pedido: new Date().toISOString(), data_entrega: dataPgto || new Date().toISOString(),
    quantidade_produto: totalQtd, unidade_produto: "potes",
    status: "aguardando_producao", formula_id: null, formula_snapshot: null,
    observacoes: orc.observacoes || null,
  }]).select("id").single();
  if (err2) throw new Error(err2.message);
  try {
    await fetch("https://n8n.lemoncaps.com.br/webhook/request-order", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot),
    });
  } catch { /* ignore */ }
  return novo!.id;
}