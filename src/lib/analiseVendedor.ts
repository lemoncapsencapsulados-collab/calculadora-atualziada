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
  // Setups
  setupsVendidos: Array<{ nome: string; quantidade: number; valorTotal: number }>;
  setupMaisVendido: string | null;
  valorMedioSetup: number;
  maiorValorSetup: number;
  // Funil
  qtdOrcamentos: number;
  taxaConversao: number; // 0..1
  valorEmNegociacao: number;
}

const TIPOS = ['Encapsulado', 'Líquido', 'Solúvel', 'Gummy'];

function isVenda(o: any): boolean {
  const status = String(o.status || '').toLowerCase();
  return (
    status === 'pago' ||
    status === 'convertido' ||
    o.pedido_id_gerado != null ||
    o.vhsys_liquidado_em != null
  );
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

  const { data, error } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('consultor_responsavel', vendedor)
    .gte('created_at', inicio)
    .lte('created_at', fim);

  if (error) throw error;
  const orcamentos = (data as any[]) || [];

  const vendas = orcamentos.filter(isVenda);
  const negociacao = orcamentos.filter(isNegociacao);

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
      const segmento = String(it.segmento || 'Outro');
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
    setupsVendidos,
    setupMaisVendido,
    valorMedioSetup,
    maiorValorSetup,
    qtdOrcamentos,
    taxaConversao,
    valorEmNegociacao,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}