import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ClientePayload {
  nome?: string;
  cnpj_cpf?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
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

    const payload: Record<string, string> = {
      nome: body.nome,
      cnpj_cpf: onlyDigits(body.cnpj_cpf),
    };
    if (body.email) payload.email = body.email;
    if (body.telefone) payload.telefone = onlyDigits(body.telefone);
    if (body.cep) payload.cep = onlyDigits(body.cep);
    if (body.logradouro) payload.logradouro = body.logradouro;
    if (body.numero) payload.numero = body.numero;
    if (body.bairro) payload.bairro = body.bairro;
    if (body.cidade) payload.cidade = body.cidade;
    if (body.uf) payload.uf = body.uf.toUpperCase();

    console.log("VhSys request payload", JSON.stringify(payload));

    const vhsysResp = await fetch("https://api.vhsys.com.br/v2/clientes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": accessToken,
        "Secret-Access-Token": secretService,
      },
      body: JSON.stringify(payload),
    });

    const text = await vhsysResp.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("VhSys response", vhsysResp.status, data);

    if (!vhsysResp.ok) {
      // Tenta extrair mensagem de erro útil do payload da VhSys
      const anyData = data as any;
      const message =
        anyData?.error ||
        anyData?.message ||
        anyData?.mensagem ||
        (Array.isArray(anyData?.data) && anyData.data[0]?.error) ||
        (Array.isArray(anyData?.data) && anyData.data[0]?.message) ||
        `Erro ${vhsysResp.status} ao cadastrar cliente no VhSys.`;

      return new Response(
        JSON.stringify({ error: message, details: data, status: vhsysResp.status }),
        { status: vhsysResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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