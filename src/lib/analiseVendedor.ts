import { startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface AnaliseVendedor {
  vendedor: string;
  mes: Date;
  // Vendas
  qtdVendas: number;
  receitaTotal: number;
  ticketMedio: number;
  totalPotes: number;
  potesPorTipo: Record<string, number>;
  maiorVolumePotesVenda: number;
  produtosVendidos: Array<{ nome: string; qtdPotes: number; receita: number; vezes: number }>;
  // Recompras vs Novo Produtor
  qtdVendasRecompras: number;
  qtdVendasNovosProdutores: number;
  receitaRecompras: number;
  receitaNovosProdutores: number;
  taxaConversaoNovoProdutor: number; // 0..1
  // Setups
  setupsVendidos: Array<{ nome: string; quantidade: number; valorTotal: number }>;
  setupMaisVendido: string | null;
  valorMedioSetup: number;
  maiorValorSetup: number;
  vendasPorSetup: Record<string, Array<{ pedidoId: string; numeroPedido: string | number | null; cliente: string; data: string; valor: number }>>;
  avisosServicosMarca: Array<{ pedidoId: string; numeroPedido: string | number | null; cliente: string; motivo: string }>;
  // Funil
  qtdOrcamentos: number;
  taxaConversao: number; // 0..1
  valorEmNegociacao: number;
  // Monetizze (comissão real do consultor)
  monetizzeConsultas: Array<{
    id: string;
    createdAt: string;
    mes: string;
    filtroProduto: string | null;
    quantidadeVendida: number;
    faturamentoTotal: number;
    comissaoTotal: number;
    percentual: number;
    valorConsultor: number;
    observacao: string | null;
  }>;
  monetizzeTotalReceber: number;
  monetizzeComissaoBruta: number;
  // Braip (comissão real do consultor)
  braipConsultas: Array<{
    id: string;
    createdAt: string;
    mes: string;
    filtroProduto: string | null;
    quantidadeVendida: number;
    faturamentoTotal: number;
    comissaoTotal: number;
    percentual: number;
    valorConsultor: number;
    observacao: string | null;
  }>;
  braipTotalReceber: number;
  braipComissaoBruta: number;
}

const TIPOS = ['Encapsulado', 'Líquido', 'Solúvel', 'Gummy'];

function normalizarSegmento(raw: string): string {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!s) return 'Outro';
  if (s.startsWith('encaps') || s.includes('capsul')) return 'Encapsulado';
  if (s.startsWith('liquid')) return 'Líquido';
  if (s.startsWith('solu')) return 'Solúvel';
  if (s.startsWith('gumm') || s.startsWith('goma')) return 'Gummy';
  return 'Outro';
}

function isNegociacao(o: any): boolean {
  const status = String(o.status || '').toLowerCase();
  return status === 'rascunho' || status === 'enviado' || status === 'em_negociacao';
}

export async function carregarAnaliseVendedor(
  vendedor: string,
  mes: Date
): Promise<AnaliseVendedor> {
  const inicio = startOfMonth(mes).toISOString();
  const fim = endOfMonth(mes).toISOString();

  // 1) Orçamentos do mês (para funil + negociação)
  const { data: orcData, error: orcError } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('consultor_responsavel', vendedor)
    .gte('created_at', inicio)
    .lte('created_at', fim);

  if (orcError) throw orcError;
  const orcamentos = (orcData as any[]) || [];
  const negociacao = orcamentos.filter(isNegociacao);

  // 2) Pedidos do mês (vendas reais) — filtra pelo consultor dentro do snapshot
  const { data: pedData, error: pedError } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, data_pedido, orcamento_id, orcamento_snapshot')
    .filter('orcamento_snapshot->>consultor_responsavel', 'eq', vendedor)
    .gte('data_pedido', inicio)
    .lte('data_pedido', fim);

  if (pedError) throw pedError;
  const pedidos = (pedData as any[]) || [];

  // Para cada pedido, extrai o "snapshot de venda" (snapshot ou fallback no orçamento atual)
  const orcamentosPorId = new Map<string, any>(orcamentos.map((o) => [o.id, o]));
  const avisosServicosMarca: AnaliseVendedor['avisosServicosMarca'] = [];
  const vendas = pedidos.map((p) => {
    const snap = p.orcamento_snapshot || {};
    const fallback = p.orcamento_id ? orcamentosPorId.get(p.orcamento_id) : null;
    const snapServicos = Array.isArray(snap.servicos_marca) ? snap.servicos_marca : [];
    const fbServicos = Array.isArray(fallback?.servicos_marca) ? fallback.servicos_marca : [];
    const cliente = String(snap.cliente_nome || fallback?.cliente_nome || '—');
    // Validação: snapshot vazio mas orçamento tem serviços de marca
    if (snapServicos.length === 0 && fbServicos.length > 0) {
      avisosServicosMarca.push({
        pedidoId: p.id,
        numeroPedido: p.numero_pedido,
        cliente,
        motivo: 'Snapshot do pedido sem serviços de marca; usados dados atuais do orçamento como fallback.',
      });
    }
    return {
      pedidoId: p.id,
      numeroPedido: p.numero_pedido,
      cliente,
      data: p.data_pedido,
      tipo_orcamento: String(snap.tipo_orcamento || fallback?.tipo_orcamento || ''),
      itens_producao:
        Array.isArray(snap.itens_producao) && snap.itens_producao.length > 0
          ? snap.itens_producao
          : fallback?.itens_producao || [],
      servicos_marca: snapServicos.length > 0 ? snapServicos : fbServicos,
      valor_total: Number(snap.valor_total) || Number(fallback?.valor_total) || 0,
    };
  });

  // Produtos / potes
  const potesPorTipo: Record<string, number> = Object.fromEntries(TIPOS.map((t) => [t, 0]));
  let totalPotes = 0;
  let maiorVolumePotesVenda = 0;
  const produtosMap = new Map<string, { nome: string; qtdPotes: number; receita: number; vezes: number }>();

  for (const v of vendas) {
    const itens: any[] = Array.isArray(v.itens_producao) ? v.itens_producao : [];
    let potesDessaVenda = 0;
    for (const it of itens) {
      const qtd = Number(it.quantidade) || 0;
      const segmento = normalizarSegmento(it.segmento);
      potesDessaVenda += qtd;
      totalPotes += qtd;
      if (potesPorTipo[segmento] != null) potesPorTipo[segmento] += qtd;
      else potesPorTipo[segmento] = (potesPorTipo[segmento] || 0) + qtd;
      const nome = String(it.nome_produto || 'Sem nome');
      const ent = produtosMap.get(nome) || { nome, qtdPotes: 0, receita: 0, vezes: 0 };
      ent.qtdPotes += qtd;
      ent.receita += Number(it.subtotal) || (qtd * (Number(it.preco_unitario) || 0));
      ent.vezes += 1;
      produtosMap.set(nome, ent);
    }
    if (potesDessaVenda > maiorVolumePotesVenda) maiorVolumePotesVenda = potesDessaVenda;
  }

  // Setups (servicos_marca[] das vendas)
  const setupMap = new Map<string, { nome: string; quantidade: number; valorTotal: number }>();
  const vendasPorSetup: AnaliseVendedor['vendasPorSetup'] = {};
  let maiorValorSetup = 0;
  let somaSetupValores = 0;
  let qtdSetup = 0;
  for (const v of vendas) {
    const servicos: any[] = Array.isArray(v.servicos_marca) ? v.servicos_marca : [];
    for (const s of servicos) {
      const nome = String(s.nome_plano || s.nome || 'Setup').trim();
      const valor = Number(s.valor) || 0;
      const ent = setupMap.get(nome) || { nome, quantidade: 0, valorTotal: 0 };
      ent.quantidade += 1;
      ent.valorTotal += valor;
      setupMap.set(nome, ent);
      (vendasPorSetup[nome] ||= []).push({
        pedidoId: v.pedidoId,
        numeroPedido: v.numeroPedido,
        cliente: v.cliente,
        data: v.data,
        valor,
      });
      somaSetupValores += valor;
      qtdSetup += 1;
      if (valor > maiorValorSetup) maiorValorSetup = valor;
    }
  }
  const setupsVendidos = Array.from(setupMap.values()).sort((a, b) => b.quantidade - a.quantidade);
  const setupMaisVendido = setupsVendidos[0]?.nome || null;
  const valorMedioSetup = qtdSetup > 0 ? somaSetupValores / qtdSetup : 0;

  const receitaTotal = vendas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
  const qtdVendas = vendas.length;
  const ticketMedio = qtdVendas > 0 ? receitaTotal / qtdVendas : 0;
  const qtdOrcamentos = orcamentos.length;
  const taxaConversao = qtdOrcamentos > 0 ? qtdVendas / qtdOrcamentos : 0;
  const valorEmNegociacao = negociacao.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);

  // Split recompras vs novos produtores
  const vendasRecompras = vendas.filter((v) => v.tipo_orcamento === 'recompra' || v.tipo_orcamento === 'recompra_pod');
  const qtdVendasRecompras = vendasRecompras.length;
  const receitaRecompras = vendasRecompras.reduce((s, v) => s + (Number(v.valor_total) || 0), 0);
  const qtdVendasNovosProdutores = qtdVendas - qtdVendasRecompras;
  const receitaNovosProdutores = receitaTotal - receitaRecompras;
  const taxaConversaoNovoProdutor = qtdOrcamentos > 0 ? qtdVendasNovosProdutores / qtdOrcamentos : 0;

  // 3) Monetizze — consultas salvas vinculadas a este consultor (pelo nome) no mês
  const mesStr = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;
  const { data: mtzData } = await supabase
    .from('monetizze_consultas_salvas' as any)
    .select('*')
    .eq('consultor_nome', vendedor)
    .eq('mes', mesStr)
    .order('created_at', { ascending: false });
  const monetizzeConsultas = ((mtzData as any[]) || []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    mes: r.mes,
    filtroProduto: r.filtro_produto_nome || r.filtro_produto_codigo || null,
    quantidadeVendida: Number(r.quantidade_vendida) || 0,
    faturamentoTotal: Number(r.faturamento_total) || 0,
    comissaoTotal: Number(r.comissao_total) || 0,
    percentual: Number(r.percentual) || 0,
    valorConsultor: Number(r.valor_consultor) || 0,
    observacao: r.observacao || null,
  }));
  const monetizzeTotalReceber = monetizzeConsultas.reduce((s, c) => s + c.valorConsultor, 0);
  const monetizzeComissaoBruta = monetizzeConsultas.reduce((s, c) => s + c.comissaoTotal, 0);

  // 4) Braip — consultas salvas vinculadas a este consultor (pelo nome) no mês
  const { data: brpData } = await supabase
    .from('braip_consultas_salvas' as any)
    .select('*')
    .eq('consultor_nome', vendedor)
    .eq('mes', mesStr)
    .order('created_at', { ascending: false });
  const braipConsultas = ((brpData as any[]) || []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    mes: r.mes,
    filtroProduto: r.filtro_produto_nome || r.filtro_produto_codigo || null,
    quantidadeVendida: Number(r.quantidade_vendida) || 0,
    faturamentoTotal: Number(r.faturamento_total) || 0,
    comissaoTotal: Number(r.comissao_total) || 0,
    percentual: Number(r.percentual) || 0,
    valorConsultor: Number(r.valor_consultor) || 0,
    observacao: r.observacao || null,
  }));
  const braipTotalReceber = braipConsultas.reduce((s, c) => s + c.valorConsultor, 0);
  const braipComissaoBruta = braipConsultas.reduce((s, c) => s + c.comissaoTotal, 0);

  return {
    vendedor,
    mes,
    qtdVendas,
    receitaTotal,
    ticketMedio,
    totalPotes,
    potesPorTipo,
    maiorVolumePotesVenda,
    produtosVendidos: Array.from(produtosMap.values()).sort((a, b) => b.qtdPotes - a.qtdPotes),
    qtdVendasRecompras,
    qtdVendasNovosProdutores,
    receitaRecompras,
    receitaNovosProdutores,
    taxaConversaoNovoProdutor,
    setupsVendidos,
    setupMaisVendido,
    valorMedioSetup,
    maiorValorSetup,
    vendasPorSetup,
    avisosServicosMarca,
    qtdOrcamentos,
    taxaConversao,
    valorEmNegociacao,
    monetizzeConsultas,
    monetizzeTotalReceber,
    monetizzeComissaoBruta,
    braipConsultas,
    braipTotalReceber,
    braipComissaoBruta,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const TIME_VENDAS_ID = '__TIME_VENDAS__';
export const TIME_VENDAS_LABEL = 'Time de Vendas';

export async function carregarAnaliseTimeVendas(
  mes: Date,
  vendedores: string[]
): Promise<AnaliseVendedor> {
  const partes = await Promise.all(vendedores.map((v) => carregarAnaliseVendedor(v, mes)));

  const potesPorTipo: Record<string, number> = {};
  const produtosMap = new Map<string, { nome: string; qtdPotes: number; receita: number; vezes: number }>();
  const setupMap = new Map<string, { nome: string; quantidade: number; valorTotal: number }>();
  const vendasPorSetup: AnaliseVendedor['vendasPorSetup'] = {};
  const avisos: AnaliseVendedor['avisosServicosMarca'] = [];
  const monetizzeConsultas: AnaliseVendedor['monetizzeConsultas'] = [];
  const braipConsultas: AnaliseVendedor['braipConsultas'] = [];

  let qtdVendas = 0;
  let receitaTotal = 0;
  let totalPotes = 0;
  let maiorVolumePotesVenda = 0;
  let qtdOrcamentos = 0;
  let valorEmNegociacao = 0;
  let qtdVendasRecompras = 0;
  let receitaRecompras = 0;
  let monetizzeTotalReceber = 0;
  let monetizzeComissaoBruta = 0;
  let braipTotalReceber = 0;
  let braipComissaoBruta = 0;
  let somaSetupValores = 0;
  let qtdSetup = 0;
  let maiorValorSetup = 0;

  for (const a of partes) {
    qtdVendas += a.qtdVendas;
    receitaTotal += a.receitaTotal;
    totalPotes += a.totalPotes;
    if (a.maiorVolumePotesVenda > maiorVolumePotesVenda) maiorVolumePotesVenda = a.maiorVolumePotesVenda;
    qtdOrcamentos += a.qtdOrcamentos;
    valorEmNegociacao += a.valorEmNegociacao;
    qtdVendasRecompras += a.qtdVendasRecompras;
    receitaRecompras += a.receitaRecompras;
    monetizzeTotalReceber += a.monetizzeTotalReceber;
    monetizzeComissaoBruta += a.monetizzeComissaoBruta;
    braipTotalReceber += a.braipTotalReceber;
    braipComissaoBruta += a.braipComissaoBruta;

    for (const [t, q] of Object.entries(a.potesPorTipo)) {
      potesPorTipo[t] = (potesPorTipo[t] || 0) + q;
    }
    for (const p of a.produtosVendidos) {
      const ent = produtosMap.get(p.nome) || { nome: p.nome, qtdPotes: 0, receita: 0, vezes: 0 };
      ent.qtdPotes += p.qtdPotes;
      ent.receita += p.receita;
      ent.vezes += p.vezes;
      produtosMap.set(p.nome, ent);
    }
    for (const s of a.setupsVendidos) {
      const ent = setupMap.get(s.nome) || { nome: s.nome, quantidade: 0, valorTotal: 0 };
      ent.quantidade += s.quantidade;
      ent.valorTotal += s.valorTotal;
      setupMap.set(s.nome, ent);
      somaSetupValores += s.valorTotal;
      qtdSetup += s.quantidade;
    }
    for (const [setup, arr] of Object.entries(a.vendasPorSetup)) {
      (vendasPorSetup[setup] ||= []).push(...arr);
      for (const v of arr) {
        if (v.valor > maiorValorSetup) maiorValorSetup = v.valor;
      }
    }
    avisos.push(...a.avisosServicosMarca);
    monetizzeConsultas.push(...a.monetizzeConsultas);
    braipConsultas.push(...a.braipConsultas);
  }

  const setupsVendidos = Array.from(setupMap.values()).sort((a, b) => b.quantidade - a.quantidade);

  return {
    vendedor: TIME_VENDAS_LABEL,
    mes,
    qtdVendas,
    receitaTotal,
    ticketMedio: qtdVendas > 0 ? receitaTotal / qtdVendas : 0,
    totalPotes,
    potesPorTipo,
    maiorVolumePotesVenda,
    produtosVendidos: Array.from(produtosMap.values()).sort((a, b) => b.qtdPotes - a.qtdPotes),
    qtdVendasRecompras,
    qtdVendasNovosProdutores: qtdVendas - qtdVendasRecompras,
    receitaRecompras,
    receitaNovosProdutores: receitaTotal - receitaRecompras,
    taxaConversaoNovoProdutor: qtdOrcamentos > 0 ? (qtdVendas - qtdVendasRecompras) / qtdOrcamentos : 0,
    setupsVendidos,
    setupMaisVendido: setupsVendidos[0]?.nome || null,
    valorMedioSetup: qtdSetup > 0 ? somaSetupValores / qtdSetup : 0,
    maiorValorSetup,
    vendasPorSetup,
    avisosServicosMarca: avisos,
    qtdOrcamentos,
    taxaConversao: qtdOrcamentos > 0 ? qtdVendas / qtdOrcamentos : 0,
    valorEmNegociacao,
    monetizzeConsultas,
    monetizzeTotalReceber,
    monetizzeComissaoBruta,
    braipConsultas,
    braipTotalReceber,
    braipComissaoBruta,
  };
}

function escapeCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[";,\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function gerarCSVAnalise(a: AnaliseVendedor): string {
  const linhas: string[] = [];
  const mesISO = `${a.mes.getFullYear()}-${String(a.mes.getMonth() + 1).padStart(2, '0')}`;
  linhas.push(`Análise do Vendedor;${a.vendedor};Período;${mesISO}`);
  linhas.push('');
  linhas.push('=== Resumo ===');
  linhas.push('Métrica;Valor');
  const resumo: [string, string | number][] = [
    ['Vendas realizadas', a.qtdVendas],
    ['Orçamentos gerados', a.qtdOrcamentos],
    ['Taxa de conversão (com recompras)', `${(a.taxaConversao * 100).toFixed(1)}%`],
    ['Taxa de conversão (novos produtores)', `${(a.taxaConversaoNovoProdutor * 100).toFixed(1)}%`],
    ['Vendas de recompras', a.qtdVendasRecompras],
    ['Receita de recompras', formatBRL(a.receitaRecompras)],
    ['Vendas Novo Produtor', a.qtdVendasNovosProdutores],
    ['Receita Novo Produtor', formatBRL(a.receitaNovosProdutores)],
    ['Receita total', formatBRL(a.receitaTotal)],
    ['Ticket médio', formatBRL(a.ticketMedio)],
    ['Valor em negociação', formatBRL(a.valorEmNegociacao)],
    ['Total de potes', a.totalPotes],
    ['Maior volume em uma venda (potes)', a.maiorVolumePotesVenda],
  ];
  for (const [k, v] of resumo) linhas.push(`${escapeCsv(k)};${escapeCsv(v)}`);
  linhas.push('');
  linhas.push('=== Potes por tipo ===');
  linhas.push('Tipo;Potes');
  for (const [t, q] of Object.entries(a.potesPorTipo)) linhas.push(`${escapeCsv(t)};${q}`);
  linhas.push('');
  linhas.push('=== Setups vendidos ===');
  linhas.push('Setup;Quantidade;Valor total');
  for (const s of a.setupsVendidos) {
    linhas.push(`${escapeCsv(s.nome)};${s.quantidade};${escapeCsv(formatBRL(s.valorTotal))}`);
  }
  linhas.push('');
  linhas.push('=== Produtos vendidos ===');
  linhas.push('Produto;Nº de vendas;Potes;Receita');
  for (const p of a.produtosVendidos) {
    linhas.push(`${escapeCsv(p.nome)};${p.vezes};${p.qtdPotes};${escapeCsv(formatBRL(p.receita))}`);
  }
  linhas.push('');
  linhas.push('=== Pedidos por setup ===');
  linhas.push('Setup;Pedido;Cliente;Data;Valor');
  for (const [setup, vendas] of Object.entries(a.vendasPorSetup)) {
    for (const v of vendas) {
      linhas.push(
        `${escapeCsv(setup)};${escapeCsv(v.numeroPedido ?? v.pedidoId)};${escapeCsv(v.cliente)};${escapeCsv(v.data?.slice(0, 10) || '')};${escapeCsv(formatBRL(v.valor))}`
      );
    }
  }
  if (a.avisosServicosMarca.length > 0) {
    linhas.push('');
    linhas.push('=== Avisos de Serviços de Marca ===');
    linhas.push('Pedido;Cliente;Motivo');
    for (const w of a.avisosServicosMarca) {
      linhas.push(`${escapeCsv(w.numeroPedido ?? w.pedidoId)};${escapeCsv(w.cliente)};${escapeCsv(w.motivo)}`);
    }
  }
  return '\uFEFF' + linhas.join('\n');
}