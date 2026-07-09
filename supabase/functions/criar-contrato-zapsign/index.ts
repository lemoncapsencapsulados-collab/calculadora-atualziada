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

function titleCasePt(value: string): string {
  const lowerWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => lowerWords.has(word) && index > 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function onlyDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

function formatBRL(value: unknown): string {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInsumo(insumo: any): string {
  if (!insumo?.nome) return '';
  const nome = String(insumo.nome).trim().toLowerCase() === 'amido de milho' ? 'Excipiente' : String(insumo.nome).trim();
  const qtd = insumo.quantidade != null ? String(insumo.quantidade).replace('.', ',') : '';
  const unidade = insumo.unidade || '';
  return [nome, [qtd, unidade].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
}

function formatCondicoesPagamento(condicoes: any, valorTotal: number): string {
  if (!condicoes) return '';
  const fmt = (v: number) => formatBRL(v);
  const lines: string[] = [];
  const metodo = condicoes.metodo_principal;
  const valorParcela = (p: any) => p?.tipo_valor === 'percentual' ? (Number(p.valor || 0) / 100) * valorTotal : Number(p?.valor || 0);
  if (metodo === 'pix_boleto') {
    lines.push('Método: Pix / Boleto');
    (condicoes.parcelas_pix_boleto || []).forEach((p: any, i: number) => lines.push(`Parcela ${i + 1}: R$ ${fmt(valorParcela(p))}${p?.data_vencimento ? ` - vencimento ${p.data_vencimento}` : ''}`));
  } else if (metodo === 'cartao_credito') {
    lines.push('Método: Cartão de Crédito');
    (condicoes.cartoes || []).forEach((c: any, i: number) => {
      const total = valorParcela(c);
      const parcelas = Number(c?.parcelas || 1);
      lines.push(`Cartão ${i + 1}: ${parcelas}x de R$ ${fmt(total / parcelas)} - Total R$ ${fmt(total)}${c?.data_primeira_parcela ? ` - primeira parcela ${c.data_primeira_parcela}` : ''}`);
    });
  } else if (metodo === 'misto') {
    lines.push('Método: Misto');
    (condicoes.misto_parcelas_pix_boleto || []).forEach((p: any, i: number) => lines.push(`Pix/Boleto ${i + 1}: R$ ${fmt(valorParcela(p))}${p?.data_vencimento ? ` - vencimento ${p.data_vencimento}` : ''}`));
    (condicoes.misto_cartoes || []).forEach((c: any, i: number) => {
      const total = valorParcela(c);
      const parcelas = Number(c?.parcelas || 1);
      lines.push(`Cartão ${i + 1}: ${parcelas}x de R$ ${fmt(total / parcelas)} - Total R$ ${fmt(total)}${c?.data_primeira_parcela ? ` - primeira parcela ${c.data_primeira_parcela}` : ''}`);
    });
  } else {
    if (condicoes.valor_entrada) lines.push(`Entrada: R$ ${fmt(Number(condicoes.valor_entrada || 0))}`);
    if (condicoes.valor_termino) lines.push(`Término: R$ ${fmt(Number(condicoes.valor_termino || 0))}`);
  }
  return lines.join('; ');
}

function firstNonEmptyReplacement(data: ZapSignDataItem[], keys: string[]): string {
  for (const key of keys) {
    const found = data.find((item) => item.de === key && String(item.para || '').trim());
    if (found) return String(found.para || '');
  }
  return '';
}

function mergeReplacement(data: ZapSignDataItem[], keys: string[], fallbackValue: string): string {
  // Preserva o que foi editado manualmente no modal "Enviar para ZapSign".
  // O resumo salvo entra apenas como fallback para campos vazios/ausentes.
  const val = firstNonEmptyReplacement(data, keys) || fallbackValue || '';
  const byKey = new Map(data.map((item, idx) => [item.de, idx]));
  for (const key of keys) {
    const idx = byKey.get(key);
    if (idx !== undefined) data[idx] = { de: key, para: val };
    else data.push({ de: key, para: val });
  }
  return val;
}

function applyResumoToData(data: ZapSignDataItem[], resumo: any, orcamento?: any): { signer_name?: string; signer_email?: string; signer_phone_number?: string } {
  const dc = resumo?.dados_cliente || {};
  const isPJ = dc.tipo_pessoa ? dc.tipo_pessoa === 'pj' : !!(dc.cnpj || dc.razao_social);
  const rep = isPJ ? (dc.responsavel_pj || {}) : ((Array.isArray(dc.pessoas_fisicas) && dc.pessoas_fisicas[0]) || {});
  const contratante = isPJ ? titleCasePt(dc.razao_social || resumo?.nome_cliente || '') : titleCasePt(rep.nome || resumo?.nome_cliente || '');
  const documento = isPJ ? (dc.cnpj || '') : (rep.cpf || dc.cpf || '');
  const endereco = isPJ
    ? [
        [dc.endereco_cnpj || dc.logradouro, dc.numero_cnpj || dc.numero].filter(Boolean).join(', '),
        dc.bairro_cnpj || dc.bairro,
        dc.cidade && dc.estado ? `${dc.cidade} - ${dc.estado}` : (dc.cidade || dc.estado),
        dc.cep_cnpj || dc.cep ? `CEP ${String(dc.cep_cnpj || dc.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
      ].filter(Boolean).join(' - ')
    : [
        [rep.endereco || rep.logradouro, rep.numero].filter(Boolean).join(', '),
        rep.bairro,
        rep.cidade && rep.estado ? `${rep.cidade} - ${rep.estado}` : (rep.cidade || rep.estado),
        rep.cep ? `CEP ${String(rep.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
      ].filter(Boolean).join(' - ');
  const enderecoRepresentante = [
    [rep.endereco || rep.logradouro, rep.numero].filter(Boolean).join(', '),
    rep.bairro,
    rep.cidade && rep.estado ? `${rep.cidade} - ${rep.estado}` : (rep.cidade || rep.estado),
    rep.cep ? `CEP ${String(rep.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
  ].filter(Boolean).join(' - ');
  const signerName = titleCasePt(rep.nome || contratante || resumo?.nome_cliente || '');
  const signerEmail = rep.email || dc.email || '';
  const signerPhone = onlyDigits(rep.telefone || dc.telefone || '');
  const itens = Array.isArray(orcamento?.itens_producao) ? orcamento.itens_producao : [];
  const item = itens[0] || null;
  const detalhes = resumo?.detalhes_producao?.[0] || resumo?.detalhes_producao?.['0'] || item?.detalhes_producao || {};
  const valorSetup = Number(orcamento?.subtotal_servicos || 0);
  const valorProducao = Number(orcamento?.subtotal_producao || 0);
  const valorTotal = Number(orcamento?.valor_total || 0);
  const produtoValorTotal = item ? Number(item.subtotal || Number(item.preco_unitario || 0) * Number(item.quantidade || 0)) : 0;
  const produtoApresentacao = item?.quantidade_por_pote ? `${item.quantidade_por_pote} ${item.unidade_por_pote || ''} por frasco`.trim() : '';
  const insumos = Array.isArray(item?.insumos_formula) ? item.insumos_formula : [];

  const signerNameFinal = mergeReplacement(data, ['{{NOME_REPRESENTANTE}}', '{{NOME REPRESENTANTE}}', '{{REPRESENTANTE_LEGAL}}', '{{REPRESENTANTE LEGAL}}'], signerName);
  const signerEmailFinal = mergeReplacement(data, ['{{EMAIL_SIGNATARIO}}', '{{EMAIL SIGNATARIO}}', '{{EMAIL_REPRESENTANTE}}', '{{EMAIL REPRESENTANTE}}'], signerEmail);
  const signerPhoneFinal = mergeReplacement(data, ['{{TELEFONE_SIGNATARIO}}', '{{TELEFONE SIGNATARIO}}', '{{TELEFONE_REPRESENTANTE}}', '{{TELEFONE REPRESENTANTE}}'], signerPhone);
  mergeReplacement(data, ['{{RAZAO_SOCIAL_CONTRATANTE}}', '{{RAZÃO_SOCIAL_CONTRATANTE}}', '{{RAZAO SOCIAL CONTRATANTE}}', '{{RAZÃO SOCIAL CONTRATANTE}}', '{{NOME_CONTRATANTE}}', '{{NOME CONTRATANTE}}'], contratante);
  mergeReplacement(data, ['{{CNPJ_CONTRATANTE}}', '{{CPF_CNPJ_CONTRATANTE}}', '{{CNPJ CONTRATANTE}}', '{{CPF/CNPJ CONTRATANTE}}'], documento);
  mergeReplacement(data, ['{{ENDERECO_CONTRATANTE}}', '{{ENDEREÇO_CONTRATANTE}}', '{{ENDERECO CONTRATANTE}}', '{{ENDEREÇO CONTRATANTE}}'], endereco);
  mergeReplacement(data, ['{{EMAIL_CONTRATANTE}}', '{{E-MAIL_CONTRATANTE}}', '{{EMAIL CONTRATANTE}}'], dc.email || signerEmailFinal);
  mergeReplacement(data, ['{{TELEFONE_CONTRATANTE}}', '{{TELEFONE CONTRATANTE}}'], dc.telefone || signerPhoneFinal);
  mergeReplacement(data, ['{{CPF_REPRESENTANTE}}', '{{CPF REPRESENTANTE}}'], rep.cpf || '');
  mergeReplacement(data, ['{{ENDERECO_REPRESENTANTE}}', '{{ENDEREÇO_REPRESENTANTE}}', '{{ENDERECO REPRESENTANTE}}', '{{ENDEREÇO REPRESENTANTE}}'], enderecoRepresentante);
  mergeReplacement(data, ['{{NUMERO_ORCAMENTO}}', '{{NÚMERO_ORÇAMENTO}}', '{{NUMERO ORCAMENTO}}', '{{NÚMERO ORÇAMENTO}}', '{{NUMERO_CONTRATO}}', '{{NÚMERO_CONTRATO}}', '{{NUMERO CONTRATO}}', '{{Nº_CONTRATO}}', '{{N_CONTRATO}}'], resumo?.numero_orcamento || orcamento?.numero_orcamento || '');
  mergeReplacement(data, ['{{PRODUTO_DESCRICAO}}', '{{PRODUTO_DESCRIÇÃO}}', '{{PRODUTO DESCRICAO}}', '{{PRODUTO}}'], item ? `${item.nome_produto || ''}${item.segmento ? ` (${item.segmento})` : ''}` : '');
  mergeReplacement(data, ['{{PRODUTO_APRESENTACAO}}', '{{PRODUTO_APRESENTAÇÃO}}'], produtoApresentacao);
  mergeReplacement(data, ['{{PRODUTO_PRECO}}', '{{PRODUTO_PREÇO}}', '{{PRODUTO_PRECO_UNIT}}', '{{PRODUTO_PREÇO_UNIT}}'], item ? formatBRL(item.preco_unitario) : '');
  mergeReplacement(data, ['{{PRODUTO_QUANTIDADE}}'], item ? String(item.quantidade || '') : '');
  mergeReplacement(data, ['{{PRODUTO_VALOR_TOTAL}}'], item ? formatBRL(produtoValorTotal) : '');
  mergeReplacement(data, ['{{VALOR_SETUP}}'], formatBRL(valorSetup));
  mergeReplacement(data, ['{{VALOR_PRODUCAO}}', '{{VALOR_PRODUÇÃO}}'], formatBRL(valorProducao));
  mergeReplacement(data, ['{{VALOR_TOTAL_PROJETO}}', '{{VALOR_TOTAL_PEDIDO}}', '{{VALOR_TOTAL}}', '{{VALOR TOTAL}}'], formatBRL(valorTotal));
  mergeReplacement(data, ['{{CONDICAO_PAGAMENTO}}', '{{CONDIÇÃO_PAGAMENTO}}', '{{CONDICAO PAGAMENTO}}', '{{CONDIÇÃO PAGAMENTO}}'], formatCondicoesPagamento(resumo?.condicoes_pagamento || orcamento?.condicoes_pagamento, valorTotal));
  mergeReplacement(data, ['{{PRAZO_PRODUCAO}}', '{{PRAZO_PRODUÇÃO}}'], '30 dias corridos após aprovação final dos rótulos');
  mergeReplacement(data, ['{{PRAZO_ROTULOS}}', '{{PRAZO_RÓTULOS}}'], '15 dias úteis');
  mergeReplacement(data, ['{{ANEXO_PRODUTO_NOME}}'], item?.nome_produto || '');
  mergeReplacement(data, ['{{ANEXO_QTD_FRASCO}}'], produtoApresentacao);
  mergeReplacement(data, ['{{ANEXO_DOSE_DIARIA}}'], item?.dose_diaria_sugerida || '');
  mergeReplacement(data, ['{{ANEXO_ATIVO_1}}'], formatInsumo(insumos[0]));
  mergeReplacement(data, ['{{ANEXO_ATIVO_2}}'], formatInsumo(insumos[1]));
  mergeReplacement(data, ['{{ANEXO_COR_POTE}}'], detalhes?.cor_pote || '');
  mergeReplacement(data, ['{{ANEXO_COR_TAMPA}}'], detalhes?.cor_tampa || '');
  mergeReplacement(data, ['{{ANEXO_COR_GUMMY}}'], detalhes?.cor_gummy || detalhes?.cor_soluvel || detalhes?.cor_liquido || '');
  mergeReplacement(data, ['{{ANEXO_SABOR_GUMMY}}'], detalhes?.sabor_gummy || detalhes?.sabor_soluvel || detalhes?.sabor_liquido || '');
  mergeReplacement(data, ['{{ANEXO_QUANTIDADE}}'], item ? String(item.quantidade || '') : '');
  mergeReplacement(data, ['{{ANEXO_PRECO_UNITARIO}}'], item ? formatBRL(item.preco_unitario) : '');

  return { signer_name: signerNameFinal, signer_email: signerEmailFinal, signer_phone_number: signerPhoneFinal };
}

async function getTemplateInfo(baseUrl: string, templateId: string, token: string): Promise<any | null> {
  const resp = await fetch(`${baseUrl}/templates/${templateId}/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await resp.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  if (!resp.ok) {
    throw new Error(`ZapSign retornou ${resp.status} ao validar o modelo${json?.detail ? `: ${json.detail}` : ''}`);
  }
  return json;
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
      const templateType = String(json?.template_type || '').toLowerCase();
      return new Response(
        JSON.stringify({
          valid: true,
          template_id: templateId,
          ambiente: ambiente || 'default',
          supports_dynamic_data: templateType === 'docx',
          warning: templateType && templateType !== 'docx'
            ? "Este modelo é PDF. Pela API da ZapSign, substituição de variáveis via modelo funciona apenas em Modelo DOCX dinâmico."
            : undefined,
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

    const payloadData = [...body.data];
    let signerOverride: { signer_name?: string; signer_email?: string; signer_phone_number?: string } = {};

    const templateInfo = await getTemplateInfo(baseUrl, templateId, token);
    const templateType = String(templateInfo?.template_type || '').toLowerCase();
    if (templateType && templateType !== 'docx') {
      return new Response(
        JSON.stringify({
          error: "Modelo ZapSign incompatível para preenchimento automático.",
          details: "O modelo cadastrado na ZapSign é PDF. Conforme a API da ZapSign, o endpoint /models/create-doc/ substitui variáveis apenas em Modelos DOCX dinâmicos. Cadastre um modelo DOCX com variáveis como {{NUMERO_CONTRATO}}, {{NOME_CONTRATANTE}}, {{CNPJ_CONTRATANTE}} etc.",
          template_id: templateId,
          template_type: templateInfo?.template_type,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supaUrlForResumo = Deno.env.get("SUPABASE_URL");
    const serviceRoleForResumo = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (body.orcamento_id && supaUrlForResumo && serviceRoleForResumo) {
      try {
        const adminResumo = createClient(supaUrlForResumo, serviceRoleForResumo, { auth: { persistSession: false } });
        const { data: resumo, error: resumoError } = await adminResumo
          .from("resumos_contrato")
          .select("numero_orcamento, nome_cliente, dados_cliente, detalhamento_frete, condicoes_pagamento, detalhes_producao")
          .eq("orcamento_id", body.orcamento_id)
          .limit(1)
          .maybeSingle();
        if (resumoError) {
          console.error("[criar-contrato-zapsign] falha ao carregar resumo:", resumoError);
        } else if (resumo) {
          const { data: orcamentoResumo } = await adminResumo
            .from("orcamentos")
            .select("numero_orcamento, itens_producao, subtotal_servicos, subtotal_producao, valor_total, condicoes_pagamento")
            .eq("id", body.orcamento_id)
            .limit(1)
            .maybeSingle();
          signerOverride = applyResumoToData(payloadData, resumo, orcamentoResumo);
          console.log("[criar-contrato-zapsign] dados do resumo aplicados:", resumo.numero_orcamento);
        }
      } catch (e) {
        console.error("[criar-contrato-zapsign] erro ao aplicar resumo:", e);
      }
    }

    const signerNameFinal = signerOverride.signer_name || body.signer_name;
    const signerEmailFinal = signerOverride.signer_email || body.signer_email;
    const signerPhoneFinal = signerOverride.signer_phone_number || body.signer_phone_number || "";

    const extras = (body.extra_signers || []).filter((s) => s && s.name && s.email);
    console.log("[criar-contrato-zapsign] extras recebidos:", JSON.stringify(extras));

    // Busca email_envio/nome_envio configurado no modelo de contrato e adiciona como cópia
    try {
      const supaUrl0 = Deno.env.get("SUPABASE_URL");
      const serviceRole0 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supaUrl0 && serviceRole0) {
        const admin0 = createClient(supaUrl0, serviceRole0, { auth: { persistSession: false } });
        const { data: modelo } = await admin0
          .from("contrato_modelos")
          .select("email_envio, nome_envio")
          .eq("template_id", templateId)
          .limit(1)
          .maybeSingle();
        const emailCopia = (modelo?.email_envio || "").trim();
        if (emailCopia) {
          const ja = new Set<string>([
            (signerEmailFinal || "").toLowerCase().trim(),
            ...extras.map((s) => (s.email || "").toLowerCase().trim()),
          ]);
          if (!ja.has(emailCopia.toLowerCase())) {
            extras.push({
              name: (modelo?.nome_envio || "Cópia").trim(),
              email: emailCopia,
              phone_country: "55",
              phone_number: "",
            });
            console.log("[criar-contrato-zapsign] cópia do modelo adicionada:", emailCopia);
          }
        }
      }
    } catch (e) {
      console.error("[criar-contrato-zapsign] falha ao carregar cópia do modelo:", e);
    }

    const zapPayload: Record<string, unknown> = {
      template_id: templateId,
      signer_name: signerNameFinal,
      signer_email: signerEmailFinal,
      signer_phone_country: body.signer_phone_country || "55",
      signer_phone_number: signerPhoneFinal.replace(/\D/g, ""),
      lang: body.lang || "pt-br",
      send_automatic_email: body.send_automatic_email ?? true,
      data: payloadData,
      external_id: body.orcamento_id || body.pedido_id || undefined,
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

    // Adiciona signatários extras via endpoint dedicado (templates create-doc não aceita signers array).
    const docToken: string | undefined = json?.token;
    if (docToken && extras.length > 0) {
      const addSignerUrl = `${baseUrl}/docs/${docToken}/add-signer/`;
      const addedSigners: any[] = [];
      for (const s of extras) {
        console.log("[criar-contrato-zapsign] add-signer ->", s.email, "doc:", docToken);
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
          console.log("[criar-contrato-zapsign] add-signer resp:", addResp.status, addText?.slice(0, 500));
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
            template_id: templateId,
            ambiente: body.ambiente || 'producao',
            orcamento_id: body.orcamento_id ?? null,
            cliente_id: body.cliente_id ?? null,
            pedido_id: body.pedido_id ?? null,
            signer_name: signerNameFinal,
            signer_email: signerEmailFinal,
            signer_phone: signerPhoneFinal || null,
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