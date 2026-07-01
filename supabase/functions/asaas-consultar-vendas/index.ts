import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://api.asaas.com/v3';

interface Filtro {
  mes: string; // YYYY-MM
  cliente_nome?: string;
  status?: string; // default RECEIVED
}

function rangeMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { ini: `${y}-${pad(m)}-01`, fim: `${y}-${pad(m)}-${pad(lastDay)}` };
}

async function fetchAsaas(token: string, path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${API_BASE}${path}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const r = await fetch(url, {
    method: 'GET',
    headers: { access_token: token, Accept: 'application/json' },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Asaas ${path} falhou (${r.status}): ${txt.slice(0, 400)}`);
  return JSON.parse(txt);
}

async function buscarPagamentos(token: string, filtro: Filtro): Promise<any[]> {
  const { ini, fim } = rangeMes(filtro.mes);
  const status = (filtro.status || 'RECEIVED').toUpperCase();
  const limit = 100;
  let offset = 0;
  const todos: any[] = [];
  let hasMore = true;
  while (hasMore && offset < 5000) {
    const resp = await fetchAsaas(token, '/payments', {
      status,
      'paymentDate[ge]': ini,
      'paymentDate[le]': fim,
      limit,
      offset,
    });
    const lista: any[] = resp?.data || [];
    todos.push(...lista);
    hasMore = Boolean(resp?.hasMore) && lista.length === limit;
    offset += limit;
    console.log(`[asaas] offset=${offset - limit} recebidos=${lista.length} hasMore=${hasMore}`);
  }
  return todos;
}

function normalizar(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = Deno.env.get('ASAAS_API_KEY');
    if (!token) throw new Error('ASAAS_API_KEY não configurado');

    const body = await req.json().catch(() => ({}));
    const filtro: Filtro = {
      mes: body.mes,
      cliente_nome: body.cliente_nome,
      status: body.status,
    };
    if (!filtro.mes || !/^\d{4}-\d{2}$/.test(filtro.mes)) {
      return new Response(JSON.stringify({ error: 'Parâmetro "mes" obrigatório no formato YYYY-MM' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pagamentos = await buscarPagamentos(token, filtro);
    console.log(`[asaas] total pagamentos=${pagamentos.length}`);

    // Buscar nomes dos clientes (cache por customer id)
    const idsClientes = Array.from(new Set(pagamentos.map((p) => p.customer).filter(Boolean)));
    const nomes = new Map<string, string>();
    // batch em série para não estourar rate limit
    for (const id of idsClientes) {
      try {
        const c = await fetchAsaas(token, `/customers/${id}`, {});
        nomes.set(id, c?.name || '');
      } catch (e) {
        console.log(`[asaas] falha customer ${id}: ${(e as Error).message}`);
        nomes.set(id, '');
      }
    }

    const filtroNome = normalizar(filtro.cliente_nome || '');
    const filtrados = filtroNome
      ? pagamentos.filter((p) => normalizar(nomes.get(p.customer) || '').includes(filtroNome))
      : pagamentos;

    const quantidade = filtrados.length;
    const faturamento = filtrados.reduce((s, p) => s + Number(p.value || 0), 0);
    const liquido = filtrados.reduce((s, p) => s + Number(p.netValue ?? p.value ?? 0), 0);

    const porCliente = new Map<string, { nome: string; quantidade: number; faturamento: number; liquido: number }>();
    for (const p of filtrados) {
      const nome = nomes.get(p.customer) || '(sem nome)';
      const r = porCliente.get(nome) || { nome, quantidade: 0, faturamento: 0, liquido: 0 };
      r.quantidade += 1;
      r.faturamento += Number(p.value || 0);
      r.liquido += Number(p.netValue ?? p.value ?? 0);
      porCliente.set(nome, r);
    }

    const itens = filtrados.map((p) => ({
      id: p.id,
      cliente: nomes.get(p.customer) || '',
      descricao: p.description || '',
      forma: p.billingType,
      data_pagamento: p.paymentDate || p.confirmedDate || null,
      valor: Number(p.value || 0),
      liquido: Number(p.netValue ?? p.value ?? 0),
      status: p.status,
    }));

    return new Response(JSON.stringify({
      mes: filtro.mes,
      filtro_cliente: filtro.cliente_nome || null,
      total_retornado_api: pagamentos.length,
      quantidade_recebida: quantidade,
      faturamento_total: Number(faturamento.toFixed(2)),
      liquido_total: Number(liquido.toFixed(2)),
      por_cliente: Array.from(porCliente.values()).sort((a, b) => b.faturamento - a.faturamento),
      itens,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[asaas-consultar-vendas] erro', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});