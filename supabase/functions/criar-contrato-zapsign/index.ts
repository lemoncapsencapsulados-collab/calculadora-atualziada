import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface ZapSignDataItem {
  de: string;
  para: string;
}

interface RequestBody {
  signer_name: string;
  signer_email: string;
  signer_phone_country?: string;
  signer_phone_number?: string;
  lang?: string;
  send_automatic_email?: boolean;
  data: ZapSignDataItem[];
  template_id?: string;
  ambiente?: 'producao' | 'sandbox';
  orcamento_id?: string;
  cliente_id?: string;
  pedido_id?: string;
}

function resolveBaseUrl(ambiente?: string, defaultBaseUrl?: string): string {
  if (ambiente === 'sandbox') return 'https://sandbox.api.zapsign.com.br/api/v1';
  if (ambiente === 'producao') return 'https://api.zapsign.com.br/api/v1';
  return (defaultBaseUrl || "https://api.zapsign.com.br/api/v1").replace(/\/+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("ZAPSIGN_API_TOKEN");
  const defaultTemplateId = Deno.env.get("ZAPSIGN_TEMPLATE_ID");
  const defaultBaseUrl = (Deno.env.get("ZAPSIGN_BASE_URL") || "https://api.zapsign.com.br/api/v1").replace(/\/+$/, "");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "ZapSign não configurada no servidor (ZAPSIGN_API_TOKEN ausente)." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // GET /validate-template?template_id=xxx&ambiente=producao
  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const templateId = url.searchParams.get("template_id") || defaultTemplateId;
      const ambiente = url.searchParams.get("ambiente") || undefined;
      if (!templateId) {
        return new Response(
          JSON.stringify({ error: "Informe template_id via query param ou configure ZAPSIGN_TEMPLATE_ID." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const baseUrl = resolveBaseUrl(ambiente, defaultBaseUrl);
      const validateUrl = `${baseUrl}/templates/${templateId}/`;
      const resp = await fetch(validateUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await resp.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
      if (!resp.ok) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: `ZapSign retornou ${resp.status}`,
            status: resp.status,
            template_id: templateId,
            ambiente: ambiente || 'default',
            url: validateUrl,
            details: json ?? text,
            hint: resp.status === 404
              ? "Template não encontrado. Verifique: (1) se o ID está correto, (2) se está usando o token da conta certa, (3) se o ambiente (sandbox/produção) está correto."
              : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          valid: true,
          template_id: templateId,
          ambiente: ambiente || 'default',
          template: json ?? { raw: text },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: any) {
      console.error("criar-contrato-zapsign validate error:", err);
      return new Response(
        JSON.stringify({ error: err?.message || "Erro desconhecido na validação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // POST - criar contrato
  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.signer_name || !body?.signer_email || !Array.isArray(body?.data)) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: signer_name, signer_email e data são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const templateId = body.template_id || defaultTemplateId;
    if (!templateId) {
      return new Response(
        JSON.stringify({ error: "Nenhum template_id informado e ZAPSIGN_TEMPLATE_ID não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = resolveBaseUrl(body.ambiente, defaultBaseUrl);

    const zapPayload = {
      template_id: templateId,
      signer_name: body.signer_name,
      signer_email: body.signer_email,
      signer_phone_country: body.signer_phone_country || "55",
      signer_phone_number: (body.signer_phone_number || "").replace(/\D/g, ""),
      lang: body.lang || "pt-br",
      send_automatic_email: body.send_automatic_email ?? true,
      data: body.data,
    };

    const url = `${baseUrl}/models/create-doc/`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(zapPayload),
    });

    const text = await resp.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          error: `ZapSign retornou ${resp.status}`,
          status: resp.status,
          template_id: templateId,
          ambiente: body.ambiente || 'default',
          url,
          details: json ?? text,
          hint: resp.status === 404
            ? "Template não encontrado. Verifique: (1) se o ID está correto, (2) se está usando o token da conta certa, (3) se o ambiente (sandbox/produção) está correto."
            : undefined,
        }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Registra o contrato para receber o webhook depois
    try {
      const docToken: string | undefined = json?.token;
      const openId: string | undefined = json?.open_id;
      if (docToken) {
        const supaUrl = Deno.env.get("SUPABASE_URL");
        const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supaUrl && serviceRole) {
          const admin = createClient(supaUrl, serviceRole, { auth: { persistSession: false } });
          await admin.from("contratos_zapsign").upsert({
            zapsign_token: docToken,
            zapsign_open_id: openId ?? null,
            template_id: templateId,
            ambiente: body.ambiente || 'producao',
            orcamento_id: body.orcamento_id ?? null,
            cliente_id: body.cliente_id ?? null,
            pedido_id: body.pedido_id ?? null,
            signer_name: body.signer_name,
            signer_email: body.signer_email,
            signer_phone: body.signer_phone_number ?? null,
            status: 'pending',
          }, { onConflict: 'zapsign_token' });

          // Marca o orçamento como "contrato enviado" (em análise)
          if (body.orcamento_id) {
            await admin
              .from("orcamentos")
              .update({
                status_contrato: 'enviado',
                contrato_enviado_em: new Date().toISOString(),
              })
              .eq("id", body.orcamento_id);
          }
        }
      }
    } catch (regErr) {
      console.error("Falha ao registrar contrato_zapsign (não bloqueia envio):", regErr);
    }

    return new Response(JSON.stringify(json ?? { raw: text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("criar-contrato-zapsign error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});