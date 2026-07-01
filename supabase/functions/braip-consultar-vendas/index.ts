import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://ev.braip.com/api';

interface Filtro {
  mes: string; // YYYY-MM
  produto_nome?: string;
  produto_codigo?: string;
  status_codes?: number[]; // ex: [2] = Pagamento Aprovado
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
  // Usamos data de pagamento para filtrar as vendas aprovadas do mês
  params.set('trans_payment_date_min', ini);
  params.set('trans_payment_date_max', fim);
  params.set('page', String(page));
  if (filtro.produto_codigo) params.set('product_key', filtro.produto_codigo);
  const statusCodes = filtro.status_codes && filtro.status_codes.length ? filtro.status_codes : [2, 9];
  // status como array: status[]=2&status[]=9
  for (const s of statusCodes) params.append('status[]', String(s));
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
  // Formato paginado: { current_page, data: [...], last_page, ... }
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
  if (primeira.length < 100) return primeira;

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

// Valores da Braip vêm em centavos como string ("19700" = R$ 197,00)
function parseCents(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n / 100 : 0;
}

function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getStatusCode(t: any): number {
  const c = t?.trans_status_code;
  const n = typeof c === 'number' ? c : Number(c);
  return Number.isFinite(n) ? n : 0;
}

function ehAprovada(t: any): boolean {
  // 2 = Pagamento Aprovado, 9 = Parcialmente Pago
  const code = getStatusCode(t);
  if (code === 2 || code === 9) return true;
  const s = normalizar(String(t?.trans_status || ''));
  return s.includes('aprov') || s === 'pago' || s.includes('parcial');
}

function getProdutoNome(t: any): string {
  return t?.product_name || t?.plan_name || '';
}

function getProdutoNomesTodos(t: any): string[] {
  const push = (v: any, arr: string[]) => { if (v) arr.push(String(v)); };
  const out: string[] = [];
  push(t?.product_name, out);
  push(t?.product_key, out);
  push(t?.plan_name, out);
  push(t?.plan_key, out);
  if (Array.isArray(t?.trans_items)) {
    for (const p of t.trans_items) {
      push(p?.plan_name, out);
      push(p?.plan_key, out);
      push(p?.product_key, out);
    }
  }
  return out;
}

function getValor(t: any): number {
  // Preferimos o valor líquido de produto (trans_value), fallback total (com frete)
  const v = t?.trans_value ?? t?.trans_total_value ?? 0;
  return parseCents(v);
}

function getComissao(t: any): number {
  // A resposta traz commissions[]: soma tudo que NÃO é taxa da Braip/Sistema
  const lista: any[] = Array.isArray(t?.commissions) ? t.commissions : [];
  if (!lista.length) return 0;
  let soma = 0;
  for (const c of lista) {
    const tipo = normalizar(String(c?.type || ''));
    const nome = normalizar(String(c?.name || ''));
    if (tipo === 'sistema' || nome === 'braip') continue;
    soma += parseCents(c?.value);
  }
  return soma;
}

function getCliente(t: any): string {
  return t?.client_name || '';
}

function getCodigo(t: any): string {
  return String(t?.trans_key || '');
}

function getData(t: any): string | null {
  return t?.trans_payment_date || t?.trans_updatedate || t?.trans_createdate || null;
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