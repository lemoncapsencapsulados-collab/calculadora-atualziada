import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://api.monetizze.com.br/2.1';

interface Filtro {
  mes: string; // YYYY-MM
  produto_nome?: string;
  produto_codigo?: string;
  status?: number[];
}

async function gerarToken(consumerKey: string): Promise<string> {
  const r = await fetch(`${API_BASE}/token`, {
    method: 'GET',
    headers: { 'X_CONSUMER_KEY': consumerKey, 'Content-Type': 'application/json' },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Token Monetizze falhou (${r.status}): ${txt}`);
  let data: any;
  try { data = JSON.parse(txt); } catch { throw new Error(`Resposta /token inválida: ${txt.slice(0,200)}`); }
  const token = data?.TOKEN || data?.token || data?.Token || data?.access_token;
  if (!token) throw new Error(`Token Monetizze não retornado. Resposta: ${txt.slice(0,300)}`);
  return String(token);
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
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchPagina(token: string, consumerKey: string, filtro: Filtro, page: number): Promise<any[]> {
  const { ini, fim } = rangeMes(filtro.mes);
  const statusList = filtro.status && filtro.status.length ? filtro.status : [2, 6];
  const params = new URLSearchParams();
  params.set('end_date_min', ini);
  params.set('end_date_max', fim);
  statusList.forEach((s) => params.append('status[]', String(s)));
  if (filtro.produto_codigo) params.set('product', filtro.produto_codigo);
  params.set('page', String(page));
  const url = `${API_BASE}/transactions?${params.toString()}`;
  const r = await fetchComTimeout(url, {
    method: 'GET',
    headers: { 'TOKEN': token, 'X_CONSUMER_KEY': consumerKey, 'Content-Type': 'application/json' },
  }, 20000);
  const txt = await r.text();
  if (!r.ok) throw new Error(`Monetizze /transactions falhou (${r.status}): ${txt.slice(0, 500)}`);
  let data: any;
  try { data = JSON.parse(txt); } catch { throw new Error(`Resposta inválida: ${txt.slice(0, 200)}`); }
  const lista: any[] = Array.isArray(data) ? data : (data.dados || data.data || data.transactions || []);
  return lista;
}

async function buscarTransacoes(token: string, consumerKey: string, filtro: Filtro): Promise<any[]> {
  // Página 1 sequencial para descobrir se tem dados
  const primeira = await fetchPagina(token, consumerKey, filtro, 1);
  console.log(`[monetizze] page=1 itens=${primeira.length}`);
  if (primeira[0]) {
    console.log('[monetizze] sample keys:', Object.keys(primeira[0]).join(','));
    console.log('[monetizze] sample:', JSON.stringify(primeira[0]).slice(0, 1500));
  }
  if (primeira.length < 100) return primeira;

  const todas: any[] = [...primeira];
  const concorrencia = 5;
  const maxPages = 30;
  let proxima = 2;
  let acabou = false;

  while (!acabou && proxima <= maxPages) {
    const lote = [] as Promise<{ page: number; lista: any[] }>[];
    for (let i = 0; i < concorrencia && proxima + i <= maxPages; i++) {
      const p = proxima + i;
      lote.push(fetchPagina(token, consumerKey, filtro, p).then((lista) => ({ page: p, lista })));
    }
    const resultados = await Promise.all(lote);
    for (const { page, lista } of resultados) {
      console.log(`[monetizze] page=${page} itens=${lista.length}`);
      todas.push(...lista);
      if (lista.length < 100) acabou = true;
    }
    proxima += concorrencia;
  }
  return todas;
}

function getProdutoNome(t: any): string {
  return (
    t?.produto?.nome ||
    t?.produto?.descricao ||
    t?.product?.name ||
    t?.product_name ||
    t?.nome_produto ||
    ''
  );
}

function getValor(t: any): number {
  const v = t?.venda?.valor ?? t?.valor ?? t?.valor_total ?? t?.amount ?? 0;
  return Number(v) || 0;
}

function getComissao(t: any): number {
  // Monetizze: o valor de comissão da conta consultada vem em venda.valorRecebido
  const direto = t?.venda?.valorRecebido ?? t?.venda?.valor_recebido ?? t?.valorRecebido;
  if (direto !== undefined && direto !== null && direto !== '') {
    const n = Number(direto);
    if (!isNaN(n)) return n;
  }
  // fallback: somar array de comissoes
  if (Array.isArray(t?.comissoes)) {
    const soma = t.comissoes.reduce((s: number, c: any) => s + (Number(c?.valor) || 0), 0);
    if (soma > 0) return soma;
  }
  const c = t?.venda?.comissao ?? t?.comissao ?? t?.commission ?? 0;
  return Number(c) || 0;
}

function getDataFinalizacao(t: any): string | null {
  return t?.venda?.dataFinalizada || t?.venda?.dataFinalizacao || t?.dataFinalizacao || t?.data_finalizacao || t?.end_date || null;
}

function getCodigoVenda(t: any): string {
  return String(t?.venda?.codigo || t?.codigo || t?.transaction || t?.id || '');
}

function getCliente(t: any): string {
  return t?.comprador?.nome || t?.cliente?.nome || t?.buyer?.name || t?.nome_comprador || '';
}

function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const consumerKey = Deno.env.get('MONETIZZE_API_KEY');
    if (!consumerKey) throw new Error('MONETIZZE_API_KEY não configurado');

    const body = await req.json().catch(() => ({}));
    const filtro: Filtro = {
      mes: body.mes,
      produto_nome: body.produto_nome,
      produto_codigo: body.produto_codigo,
      status: body.status,
    };
    if (!filtro.mes || !/^\d{4}-\d{2}$/.test(filtro.mes)) {
      return new Response(JSON.stringify({ error: 'Parâmetro "mes" obrigatório no formato YYYY-MM' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await gerarToken(consumerKey);
    console.log('[monetizze] token ok');
    const transacoes = await buscarTransacoes(token, consumerKey, filtro);
    console.log(`[monetizze] total transacoes=${transacoes.length}`);

    const filtroNome = normalizar(filtro.produto_nome || '');
    const filtradas = filtroNome
      ? transacoes.filter((t) => normalizar(getProdutoNome(t)).includes(filtroNome))
      : transacoes;

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
      codigo: getCodigoVenda(t),
      produto: getProdutoNome(t),
      cliente: getCliente(t),
      data_finalizacao: getDataFinalizacao(t),
      valor: getValor(t),
      comissao: getComissao(t),
    }));

    return new Response(JSON.stringify({
      mes: filtro.mes,
      filtro_produto: filtro.produto_nome || null,
      total_retornado_api: transacoes.length,
      quantidade_vendida: quantidade,
      faturamento_total: Number(faturamento.toFixed(2)),
      comissao_total: Number(comissaoTotal.toFixed(2)),
      por_produto: Array.from(porProduto.values()).sort((a, b) => b.faturamento - a.faturamento),
      itens,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[monetizze-consultar-vendas] erro', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});