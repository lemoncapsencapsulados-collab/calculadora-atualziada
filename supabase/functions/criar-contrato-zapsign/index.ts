import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface ZapSignDataItem {
  de: string;
  para: string;
}

interface RequestBody {
  /** "template" (padrão) usa template_id; "documento_avulso" envia base64_docx */
  mode?: 'template' | 'documento_avulso';
  file_name?: string;
  docx_base64?: string;
  signer_name: string;
  signer_email: string;
  signer_phone_country?: string;
  signer_phone_number?: string;
  lang?: string;
  send_automatic_email?: boolean;
  data?: ZapSignDataItem[];
  template_id?: string;
  ambiente?: 'producao' | 'sandbox';
  orcamento_id?: string;
  cliente_id?: string;
  pedido_id?: string;
  extra_signers?: Array<{
    name: string;
    email: string;
    phone_country?: string;
    phone_number?: string;
  }>;
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
    const mode = body.mode || 'template';

    if (!body?.signer_name || !body?.signer_email) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: signer_name e signer_email são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === 'template' && !Array.isArray(body?.data)) {
      return new Response(
        JSON.stringify({ error: "Modo template requer 'data' (array de substituições)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === 'documento_avulso' && !body.docx_base64) {
      return new Response(
        JSON.stringify({ error: "Modo documento_avulso requer 'docx_base64'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const templateId = body.template_id || defaultTemplateId;
    if (mode === 'template' && !templateId) {
      return new Response(
        JSON.stringify({ error: "Nenhum template_id informado e ZAPSIGN_TEMPLATE_ID não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = resolveBaseUrl(body.ambiente, defaultBaseUrl);

    const extras = (body.extra_signers || []).filter((s) => s && s.name && s.email);

    const isAvulso = mode === 'documento_avulso';
    const zapPayload: Record<string, unknown> = isAvulso
      ? {
          name: (body.file_name || 'Contrato').replace(/\.docx$/i, ''),
          base64_docx: body.docx_base64,
          signers: [
            {
              name: body.signer_name,
              email: body.signer_email,
              phone_country: body.signer_phone_country || '55',
              phone_number: (body.signer_phone_number || '').replace(/\D/g, ''),
              auth_mode: 'assinaturaTela',
              send_automatic_email: body.send_automatic_email ?? true,
              lock_email: true,
            },
          ],
          lang: body.lang || 'pt-br',
          disable_signer_emails: false,
        }
      : {
          template_id: templateId,
          signer_name: body.signer_name,
          signer_email: body.signer_email,
          signer_phone_country: body.signer_phone_country || "55",
          signer_phone_number: (body.signer_phone_number || "").replace(/\D/g, ""),
          lang: body.lang || "pt-br",
          send_automatic_email: body.send_automatic_email ?? true,
          data: body.data,
        };

    const url = isAvulso ? `${baseUrl}/docs/` : `${baseUrl}/models/create-doc/`;
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
          template_id: templateId ?? null,
          mode,
          ambiente: body.ambiente || 'default',
          url,
          details: json ?? text,
          hint: resp.status === 404
            ? (isAvulso ? "Endpoint /docs/ não encontrado. Verifique base URL." : "Template não encontrado. Verifique ID, token e ambiente.")
            : undefined,
        }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Adiciona signatários extras via endpoint dedicado.
    // No modo avulso já enviamos o primeiro signatário em signers[]; os extras seguem pelo add-signer.
    const docToken: string | undefined = json?.token;
    if (docToken && extras.length > 0) {
      const addSignerUrl = `${baseUrl}/docs/${docToken}/add-signer/`;
      const addedSigners: any[] = [];
      for (const s of extras) {
        try {
          const addResp = await fetch(addSignerUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: s.name,
              email: s.email,
              phone_country: s.phone_country || "55",
              phone_number: (s.phone_number || "").replace(/\D/g, ""),
              auth_mode: "assinaturaTela",
              send_automatic_email: body.send_automatic_email ?? true,
              lock_email: true,
            }),
          });
          const addText = await addResp.text();
          let addJson: any = null;
          try { addJson = addText ? JSON.parse(addText) : null; } catch { /* */ }
          if (!addResp.ok) {
            console.error("add-signer falhou:", addResp.status, addJson ?? addText);
            addedSigners.push({ error: true, status: addResp.status, details: addJson ?? addText, signer: s });
          } else {
            addedSigners.push(addJson);
          }
        } catch (e) {
          console.error("add-signer exception:", e);
        }
      }
      (json as any).extra_signers_added = addedSigners;
    }

    // Registra o contrato para receber o webhook depois
    try {
      const openId: string | undefined = json?.open_id;
      if (docToken) {
        const supaUrl = Deno.env.get("SUPABASE_URL");
        const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supaUrl && serviceRole) {
          const admin = createClient(supaUrl, serviceRole, { auth: { persistSession: false } });
          await admin.from("contratos_zapsign").upsert({
            zapsign_token: docToken,
            zapsign_open_id: openId ?? null,
            template_id: templateId ?? null,
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