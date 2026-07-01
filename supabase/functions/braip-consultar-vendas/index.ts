import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://ev.braip.com/api';

interface Filtro {
  mes: string; // YYYY-MM
  produto_nome?: string;
  produto_codigo?: string;
  status?: string[]; // ex: ['approved','paid']
}

function rangeMes(mes: string): { ini: string; fim: string } {
  const [y, m] = mes.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    ini: `${y}-${pad(m)}-01 00:00:00`,
    fim: `${y}-${pad(m)}-${pad(lastDay)} 23:59:59`,
  };
}

async function fetchComTimeout(url: string, opts: RequestInit, ms = 25000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

async function fetchPagina(token: string, filtro: Filtro, page: number): Promise<any[]> {
  const { ini, fim } = rangeMes(filtro.mes);
  const params = new URLSearchParams();
  params.set('date_min', ini);
  params.set('date_max', fim);
  params.set('page', String(page));
  if (filtro.produto_codigo) params.set('product_key', filtro.produto_codigo);
  const url = `${API_BASE}/vendas?${params.toString()}`;
  const r = await fetchComTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }, 25000);
  const txt = await r.text();
  if (!r.ok) throw new Error(`Braip /vendas falhou (${r.status}): ${txt.slice(0, 500)}`);
  let data: any;
  try { data = JSON.parse(txt); } catch { throw new Error(`Resposta inválida: ${txt.slice(0, 200)}`); }
  const lista: any[] =
    Array.isArray(data) ? data :
    (data?.data || data?.vendas || data?.transactions || data?.items || []);
  return lista;
}

async function buscarTransacoes(token: string, filtro: Filtro): Promise<any[]> {
  const primeira = await fetchPagina(token, filtro, 1);
  console.log(`[braip] page=1 itens=${primeira.length}`);
  if (primeira[0]) {
    console.log('[braip] keys:', Object.keys(primeira[0]).join(','));
    console.log('[braip] sample:', JSON.stringify(primeira[0]).slice(0, 1500));
  }
  if (primeira.length < 50) return primeira;

  const todas = [...primeira];
  const maxPages = 40;
  const concorrencia = 4;
  let proxima = 2;
  let acabou = false;
  while (!acabou && proxima <= maxPages) {
    const lote: Promise<{ page: number; lista: any[] }>[] = [];
    for (let i = 0; i < concorrencia && proxima + i <= maxPages; i++) {
      const p = proxima + i;
      lote.push(fetchPagina(token, filtro, p).then((lista) => ({ page: p, lista })));
    }
    const resultados = await Promise.all(lote);
    for (const { page, lista } of resultados) {
      console.log(`[braip] page=${page} itens=${lista.length}`);
      todas.push(...lista);
      if (lista.length < 50) acabou = true;
    }
    proxima += concorrencia;
  }
  return todas;
}

function parseMoney(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getStatus(t: any): string {
  return String(t?.status?.descricao || t?.status?.nome || t?.status || t?.situacao || '').toLowerCase();
}

function ehAprovada(t: any): boolean {
  const s = normalizar(getStatus(t));
  return (
    s.includes('aprov') ||
    s.includes('paid') ||
    s.includes('pago') ||
    s.includes('complet') ||
    s.includes('finaliz')
  );
}

function getProdutoNome(t: any): string {
  return (
    t?.produto?.nome ||
    t?.produto?.titulo ||
    t?.product?.name ||
    t?.product_name ||
    t?.nome_produto ||
    t?.oferta?.nome ||
    ''
  );
}

function getProdutoNomesTodos(t: any): string[] {
  const push = (v: any, arr: string[]) => { if (v) arr.push(String(v)); };
  const out: string[] = [];
  push(t?.produto?.nome, out);
  push(t?.produto?.titulo, out);
  push(t?.produto?.codigo, out);
  push(t?.produto?.key, out);
  push(t?.product?.name, out);
  push(t?.product_name, out);
  push(t?.nome_produto, out);
  push(t?.oferta?.nome, out);
  push(t?.oferta?.codigo, out);
  if (Array.isArray(t?.produtos)) for (const p of t.produtos) { push(p?.nome, out); push(p?.codigo, out); }
  if (Array.isArray(t?.itens)) for (const p of t.itens) { push(p?.nome, out); push(p?.produto?.nome, out); }
  return out;
}

function getValor(t: any): number {
  const v = t?.valor_total ?? t?.valor ?? t?.venda?.valor ?? t?.amount ?? t?.total ?? 0;
  return parseMoney(v);
}

function getComissao(t: any): number {
  const v =
    t?.valor_comissao ??
    t?.comissao ??
    t?.valor_comissionado ??
    t?.commission ??
    t?.participacao?.valor ??
    0;
  return parseMoney(v);
}

function getCliente(t: any): string {
  return t?.cliente?.nome || t?.comprador?.nome || t?.customer?.name || t?.buyer?.name || '';
}

function getCodigo(t: any): string {
  return String(t?.codigo || t?.transaction_key || t?.transaction || t?.id || '');
}

function getData(t: any): string | null {
  return t?.data_finalizacao || t?.data_pagamento || t?.paid_at || t?.data || t?.created_at || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = Deno.env.get('BRAIP_API_KEY');
    if (!token) throw new Error('BRAIP_API_KEY não configurado');

    const body = await req.json().catch(() => ({}));
    const filtro: Filtro = {
      mes: body.mes,
      produto_nome: body.produto_nome,
      produto_codigo: body.produto_codigo,
    };
    if (!filtro.mes || !/^\d{4}-\d{2}$/.test(filtro.mes)) {
      return new Response(JSON.stringify({ error: 'Parâmetro "mes" obrigatório no formato YYYY-MM' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transacoes = await buscarTransacoes(token, filtro);
    console.log(`[braip] total transacoes retornadas=${transacoes.length}`);

    const aprovadas = transacoes.filter(ehAprovada);
    console.log(`[braip] aprovadas=${aprovadas.length}`);

    const filtroNome = normalizar(filtro.produto_nome || '');
    const filtradas = filtroNome
      ? aprovadas.filter((t) => getProdutoNomesTodos(t).some((n) => normalizar(n).includes(filtroNome)))
      : aprovadas;

    const quantidade = filtradas.length;
    const faturamento = filtradas.reduce((s, t) => s + getValor(t), 0);
    const comissaoTotal = filtradas.reduce((s, t) => s + getComissao(t), 0);

    const porProduto = new Map<string, { nome: string; quantidade: number; faturamento: number; comissao: number }>();
    filtradas.forEach((t) => {
      const nome = getProdutoNome(t) || '(sem nome)';
      const r = porProduto.get(nome) || { nome, quantidade: 0, faturamento: 0, comissao: 0 };
      r.quantidade += 1;
      r.faturamento += getValor(t);
      r.comissao += getComissao(t);
      porProduto.set(nome, r);
    });

    const itens = filtradas.map((t) => ({
      codigo: getCodigo(t),
      produto: getProdutoNome(t),
      cliente: getCliente(t),
      data_finalizacao: getData(t),
      valor: getValor(t),
      comissao: getComissao(t),
    }));

    return new Response(JSON.stringify({
      mes: filtro.mes,
      filtro_produto: filtro.produto_nome || null,
      total_retornado_api: transacoes.length,
      total_aprovadas: aprovadas.length,
      quantidade_vendida: quantidade,
      faturamento_total: Number(faturamento.toFixed(2)),
      comissao_total: Number(comissaoTotal.toFixed(2)),
      por_produto: Array.from(porProduto.values()).sort((a, b) => b.faturamento - a.faturamento),
      itens,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[braip-consultar-vendas] erro', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});