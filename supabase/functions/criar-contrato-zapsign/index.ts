import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("ZAPSIGN_API_TOKEN");
    const defaultTemplateId = Deno.env.get("ZAPSIGN_TEMPLATE_ID");
    const defaultBaseUrl = (Deno.env.get("ZAPSIGN_BASE_URL") || "https://api.zapsign.com.br/api/v1").replace(/\/+$/, "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "ZapSign não configurada no servidor (token ausente)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const baseUrl = body.ambiente === 'sandbox'
      ? 'https://sandbox.api.zapsign.com.br/api/v1'
      : body.ambiente === 'producao'
        ? 'https://api.zapsign.com.br/api/v1'
        : defaultBaseUrl;

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
          details: json ?? text,
        }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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