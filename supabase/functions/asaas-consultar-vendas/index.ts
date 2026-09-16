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

function labelForma(bt: string): string {
  const m: Record<string, string> = {
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    PIX: 'Pix',
    TRANSFER: 'Transferência',
    DEPOSIT: 'Depósito',
    UNDEFINED: 'Indefinido',
  };
  return m[bt] || bt || '—';
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

    // Buscar clientes (cache por customer id) — nome, email, cpfCnpj
    const idsClientes = Array.from(new Set(pagamentos.map((p) => p.customer).filter(Boolean)));
    const clientesCache = new Map<string, { name: string; email?: string; cpfCnpj?: string }>();
    for (const id of idsClientes) {
      try {
        const c = await fetchAsaas(token, `/customers/${id}`, {});
        clientesCache.set(id, { name: c?.name || '', email: c?.email, cpfCnpj: c?.cpfCnpj });
      } catch (e) {
        console.log(`[asaas] falha customer ${id}: ${(e as Error).message}`);
        clientesCache.set(id, { name: '' });
      }
    }
    const nomes = new Map<string, string>(Array.from(clientesCache.entries()).map(([k, v]) => [k, v.name]));

    // Cache de parcelamentos para descobrir total quando não vier no payload
    const installmentCache = new Map<string, { installmentCount?: number; value?: number }>();
    const idsInstallments = Array.from(new Set(
      pagamentos
        .filter((p) => p.installment && (p.installmentCount == null))
        .map((p) => p.installment as string)
    ));
    for (const id of idsInstallments) {
      try {
        const inst = await fetchAsaas(token, `/installments/${id}`, {});
        installmentCache.set(id, { installmentCount: inst?.installmentCount, value: inst?.value });
      } catch (e) {
        console.log(`[asaas] falha installment ${id}: ${(e as Error).message}`);
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

    const itens = filtrados.map((p) => {
      const cli = clientesCache.get(p.customer) || { name: '' };
      const instInfo = p.installment ? installmentCache.get(p.installment) : undefined;
      const installmentCount = p.installmentCount ?? instInfo?.installmentCount ?? null;
      return {
        id: p.id,
        cliente: cli.name,
        cliente_email: cli.email || null,
        cliente_cpf_cnpj: cli.cpfCnpj || null,
        descricao: p.description || '',
        forma: p.billingType,
        forma_label: labelForma(p.billingType),
        data_pagamento: p.paymentDate || p.confirmedDate || null,
        data_credito: p.creditDate || null,
        data_confirmacao: p.confirmedDate || null,
        data_pagamento_cliente: p.clientPaymentDate || null,
        vencimento: p.dueDate || null,
        vencimento_original: p.originalDueDate || null,
        valor: Number(p.value || 0),
        liquido: Number(p.netValue ?? p.value ?? 0),
        desconto: Number(p.discount?.value || 0),
        multa: Number(p.fine?.value || 0),
        juros: Number(p.interest?.value || 0),
        status: p.status,
        installment_id: p.installment || null,
        installment_numero: p.installmentNumber ?? null,
        installment_total: installmentCount,
        subscription_id: p.subscription || null,
        invoice_number: p.invoiceNumber || null,
        invoice_url: p.invoiceUrl || null,
        bank_slip_url: p.bankSlipUrl || null,
        transaction_receipt_url: p.transactionReceiptUrl || null,
        nosso_numero: p.nossoNumero || null,
        external_reference: p.externalReference || null,
        cartao_bandeira: p.creditCard?.creditCardBrand || null,
        cartao_final: p.creditCard?.creditCardNumber || null,
      };
    });

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