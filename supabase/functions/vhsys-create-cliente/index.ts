import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.24.1/mod.ts";

const ClientePayloadSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  nome_fantasia: z.string().trim().max(255).optional(),
  tipo_pessoa: z.enum(["F", "J", "pf", "pj", "PF", "PJ"]).optional(),
  cnpj_cpf: z.string().trim().min(11).max(18),
  email: z.string().trim().email().max(255).optional(),
  telefone: z.string().trim().max(20).optional(),
  cep: z.string().trim().max(10).optional(),
  logradouro: z.string().trim().max(255).optional(),
  numero: z.string().trim().max(7).optional(),
  bairro: z.string().trim().max(45).optional(),
  complemento: z.string().trim().max(45).optional(),
  cidade: z.string().trim().max(255).optional(),
  uf: z.string().trim().max(2).optional(),
  contato: z.string().trim().max(255).optional(),
  inscricao_estadual: z.string().trim().max(45).optional(),
  inscricao_municipal: z.string().trim().max(45).optional(),
});

type ClientePayload = z.infer<typeof ClientePayloadSchema>;

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

    const parsed = ClientePayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos para cadastro do cliente.", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = parsed.data;

    const cnpjCpfDigits = onlyDigits(body.cnpj_cpf);
    let tipoPessoa: "PF" | "PJ" =
      body.tipo_pessoa === "F" || body.tipo_pessoa === "pf" || body.tipo_pessoa === "PF"
        ? "PF"
        : body.tipo_pessoa === "J" || body.tipo_pessoa === "pj" || body.tipo_pessoa === "PJ"
        ? "PJ"
        : cnpjCpfDigits.length === 11
        ? "PF"
        : "PJ";

    const telDigits = onlyDigits(body.telefone);

    const payload: Record<string, string> = {
      razao_cliente: body.nome,
      tipo_pessoa: tipoPessoa,
      tipo_cadastro: "Cliente",
      cnpj_cliente: cnpjCpfDigits,
      fantasia_cliente: body.nome_fantasia || body.nome,
      situacao_cliente: "Ativo",
    };
    if (body.email) payload.email_cliente = body.email;
    if (telDigits) {
      payload.celular_cliente = telDigits;
      payload.fone_cliente = telDigits;
    }
    if (body.cep) payload.cep_cliente = body.cep;
    if (body.logradouro) payload.endereco_cliente = body.logradouro;
    if (body.numero) payload.numero_cliente = body.numero;
    if (body.bairro) payload.bairro_cliente = body.bairro;
    if (body.complemento) payload.complemento_cliente = body.complemento;
    if (body.cidade) payload.cidade_cliente = body.cidade;
    if (body.uf) payload.uf_cliente = body.uf.toUpperCase();
    if (body.contato) payload.contato_cliente = body.contato;
    if (body.inscricao_estadual) payload.insc_estadual_cliente = body.inscricao_estadual;
    if (body.inscricao_municipal) payload.insc_municipal_cliente = body.inscricao_municipal;

    console.log("VhSys request payload", JSON.stringify(payload));

    const vhsysResp = await fetch("https://api.vhsys.com.br/v2/clientes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "access-token": accessToken,
        "secret-access-token": secretService,
        "User-Agent": "LovableApp/1.0",
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