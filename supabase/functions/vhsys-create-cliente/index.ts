import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ClientePayload {
  nome?: string;
  nome_fantasia?: string;
  tipo_pessoa?: "F" | "J" | "pf" | "pj";
  cnpj_cpf?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
}

function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("VHSYS_ACCESS_TOKEN");
    const secretService = Deno.env.get("VHSYS_SECRET_SERVICE");

    if (!accessToken || !secretService) {
      return new Response(
        JSON.stringify({ error: "Credenciais VhSys não configuradas no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as ClientePayload;

    if (!body?.nome || !body?.cnpj_cpf) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: nome e cnpj_cpf." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cnpjCpfDigits = onlyDigits(body.cnpj_cpf);
    // Detecta tipo de pessoa: F (CPF, 11 dígitos) ou J (CNPJ, 14 dígitos)
    let tipoPessoa: "PF" | "PJ" =
      body.tipo_pessoa === "F" || body.tipo_pessoa === "pf"
        ? "PF"
        : body.tipo_pessoa === "J" || body.tipo_pessoa === "pj"
        ? "PJ"
        : cnpjCpfDigits.length === 11
        ? "PF"
        : "PJ";

    const telDigits = onlyDigits(body.telefone);

    // Mapeia para os campos esperados pela VhSys v2
    // (a API exige razao_social como nome principal e tipo_pessoa F/J)
    const payload: Record<string, string> = {
      razao_social: body.nome,
      nome_fantasia: body.nome_fantasia || body.nome,
      tipo_pessoa: tipoPessoa,
      cnpj_cpf: cnpjCpfDigits,
    };
    if (body.email) payload.email = body.email;
    if (telDigits) {
      payload.celular_pessoal = telDigits;
      payload.telefone_pessoal = telDigits;
    }
    if (body.cep) payload.cep = onlyDigits(body.cep);
    if (body.logradouro) payload.endereco = body.logradouro;
    if (body.numero) payload.numero_endereco = body.numero;
    if (body.bairro) payload.bairro = body.bairro;
    if (body.cidade) payload.cidade = body.cidade;
    if (body.uf) payload.uf = body.uf.toUpperCase();
    if (body.inscricao_estadual) payload.inscricao_estadual = body.inscricao_estadual;
    if (body.inscricao_municipal) payload.inscricao_municipal = body.inscricao_municipal;

    console.log("VhSys request payload", JSON.stringify(payload));

    const vhsysResp = await fetch("https://api.vhsys.com.br/v2/clientes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Access-Token": accessToken,
        "Secret-Access-Token": secretService,
        "Secret-Service": secretService,
      },
      body: JSON.stringify(payload),
    });

    const text = await vhsysResp.text();
    const contentType = vhsysResp.headers.get("content-type") || "";
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("VhSys response", vhsysResp.status, data);

    const returnedHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
    const anyData = data as any;
    const apiReturnedLogicalError =
      anyData?.status === "error" ||
      anyData?.code >= 400 ||
      anyData?.data?.status === "error" ||
      anyData?.data?.code >= 400;

    if (!vhsysResp.ok || returnedHtml || apiReturnedLogicalError) {
      // Tenta extrair mensagem de erro útil do payload da VhSys
      const message =
        (returnedHtml ? "VhSys retornou uma página HTML em vez de confirmar o cadastro. Verifique credenciais e formato da requisição." : undefined) ||
        anyData?.data?.error ||
        anyData?.data?.message ||
        anyData?.data?.mensagem ||
        (typeof anyData?.data?.data === "string" ? anyData.data.data : undefined) ||
        anyData?.error ||
        anyData?.message ||
        anyData?.mensagem ||
        (Array.isArray(anyData?.data) && anyData.data[0]?.error) ||
        (Array.isArray(anyData?.data) && anyData.data[0]?.message) ||
        `Erro ${vhsysResp.status} ao cadastrar cliente no VhSys.`;

      return new Response(
        JSON.stringify({ error: message, details: data, status: vhsysResp.status }),
        { status: vhsysResp.ok ? 502 : vhsysResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vhsys-create-cliente error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});