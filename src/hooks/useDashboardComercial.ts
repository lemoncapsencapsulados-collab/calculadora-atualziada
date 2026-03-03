import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  DashboardFiltros,
  KPIsGerais,
  MetricaConsultor,
  PipelineConsultor,
  ProdutoVendido,
  MixVendas,
  InsightDashboard,
  EvolucaoTemporal,
  PerfilCliente,
  DistribuicaoCanal,
  DistribuicaoConsultorStatus
} from '@/types/dashboard';

interface OrcamentoData {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  consultor_responsavel: string | null;
  status: string;
  valor_total: number;
  subtotal_producao: number;
  subtotal_servicos: number;
  created_at: string | null;
  itens_producao: unknown;
  servicos_marca: unknown;
  dados_cliente: unknown;
  data_pagamento: string | null;
  tipo_orcamento: string | null;
}

interface ItemProducao {
  nome?: string;
  nomeFormula?: string;
  quantidade?: number;
  quantidadePote?: number;
  precoVenda?: number;
  valorTotal?: number;
}

export function useDashboardComercial(filtros: DashboardFiltros) {
  const { data: orcamentos = [], isLoading: loadingOrcamentos } = useQuery({
    queryKey: ['orcamentos-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id, numero_orcamento, nome_cliente, consultor_responsavel, status, valor_total, subtotal_producao, subtotal_servicos, created_at, itens_producao, servicos_marca, dados_cliente, data_pagamento, tipo_orcamento')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as OrcamentoData[];
    }
  });

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter(o => {
      // Filtro por consultor
      if (filtros.consultor && o.consultor_responsavel !== filtros.consultor) {
        return false;
      }
      
      // Filtro por período
      if (o.created_at) {
        const dataOrcamento = parseISO(o.created_at);
        if (dataOrcamento < filtros.dataInicio || dataOrcamento > filtros.dataFim) {
          return false;
        }
      }
      
      return true;
    });
  }, [orcamentos, filtros]);

  const consultoresUnicos = useMemo(() => {
    const consultores = new Set<string>();
    orcamentos.forEach(o => {
      if (o.consultor_responsavel) {
        consultores.add(o.consultor_responsavel);
      }
    });
    return Array.from(consultores).sort();
  }, [orcamentos]);

  const kpis = useMemo((): KPIsGerais => {
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    const enviados = orcamentosFiltrados.filter(o => o.status === 'enviado');
    const recusados = orcamentosFiltrados.filter(o => o.status === 'recusado');
    
    const faturamentoTotal = aprovados.reduce((acc, o) => acc + Number(o.valor_total), 0);
    const pipelineNegociacao = enviados.reduce((acc, o) => acc + Number(o.valor_total), 0);
    const novasVendas = aprovados.length;
    const ticketMedio = novasVendas > 0 ? faturamentoTotal / novasVendas : 0;
    
    const totalDecididos = aprovados.length + recusados.length;
    const taxaConversao = totalDecididos > 0 ? (aprovados.length / totalDecididos) * 100 : 0;
    
    return {
      faturamentoTotal,
      novasVendas,
      pipelineNegociacao,
      ticketMedio,
      taxaConversao,
      totalRecusados: recusados.length
    };
  }, [orcamentosFiltrados]);

  const rankingConsultores = useMemo((): MetricaConsultor[] => {
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    const porConsultor = new Map<string, { vendas: number; faturamento: number; clientes: Set<string> }>();
    
    aprovados.forEach(o => {
      const consultor = o.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || { vendas: 0, faturamento: 0, clientes: new Set<string>() };
      atual.vendas += 1;
      atual.faturamento += Number(o.valor_total);
      atual.clientes.add(o.nome_cliente);
      porConsultor.set(consultor, atual);
    });
    
    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({
        consultor,
        vendas: dados.vendas,
        faturamento: dados.faturamento,
        ticketMedio: dados.vendas > 0 ? dados.faturamento / dados.vendas : 0,
        clientesUnicos: dados.clientes.size
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [orcamentosFiltrados]);

  // Métricas por tipo de orçamento (novo produtor vs recompra) por consultor
  const vendasPorTipo = useMemo(() => {
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    const porConsultor = new Map<string, { novo_produtor: { qtd: number; valor: number }; recompra: { qtd: number; valor: number } }>();

    aprovados.forEach(o => {
      const consultor = o.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || {
        novo_produtor: { qtd: 0, valor: 0 },
        recompra: { qtd: 0, valor: 0 },
      };
      const tipo = o.tipo_orcamento === 'recompra' ? 'recompra' : 'novo_produtor';
      atual[tipo].qtd += 1;
      atual[tipo].valor += Number(o.valor_total);
      porConsultor.set(consultor, atual);
    });

    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({ consultor, ...dados }))
      .sort((a, b) => (b.novo_produtor.valor + b.recompra.valor) - (a.novo_produtor.valor + a.recompra.valor));
  }, [orcamentosFiltrados]);

  const pipelineConsultores = useMemo((): PipelineConsultor[] => {
    const enviados = orcamentosFiltrados.filter(o => o.status === 'enviado');
    const porConsultor = new Map<string, { propostas: number; valorTotal: number; diasTotal: number }>();
    const hoje = new Date();
    
    enviados.forEach(o => {
      const consultor = o.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || { propostas: 0, valorTotal: 0, diasTotal: 0 };
      atual.propostas += 1;
      atual.valorTotal += Number(o.valor_total);
      if (o.created_at) {
        atual.diasTotal += differenceInDays(hoje, parseISO(o.created_at));
      }
      porConsultor.set(consultor, atual);
    });
    
    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({
        consultor,
        propostas: dados.propostas,
        valorTotal: dados.valorTotal,
        ticketMedio: dados.propostas > 0 ? dados.valorTotal / dados.propostas : 0,
        diasMedioAberto: dados.propostas > 0 ? Math.round(dados.diasTotal / dados.propostas) : 0
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal);
  }, [orcamentosFiltrados]);

  const produtosMaisVendidos = useMemo((): ProdutoVendido[] => {
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    const produtos = new Map<string, { quantidade: number; faturamento: number }>();
    
    aprovados.forEach(o => {
      const itens = o.itens_producao as ItemProducao[] | null;
      if (Array.isArray(itens)) {
        itens.forEach(item => {
          const nome = item.nome || item.nomeFormula || 'Produto sem nome';
          const atual = produtos.get(nome) || { quantidade: 0, faturamento: 0 };
          atual.quantidade += Number(item.quantidade || item.quantidadePote || 0);
          atual.faturamento += Number(item.valorTotal || item.precoVenda || 0);
          produtos.set(nome, atual);
        });
      }
    });
    
    const totalFaturamento = Array.from(produtos.values()).reduce((acc, p) => acc + p.faturamento, 0);
    
    return Array.from(produtos.entries())
      .map(([nome, dados]) => ({
        nome,
        quantidade: dados.quantidade,
        faturamento: dados.faturamento,
        percentualTotal: totalFaturamento > 0 ? (dados.faturamento / totalFaturamento) * 100 : 0
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 10);
  }, [orcamentosFiltrados]);

  const mixVendas = useMemo((): MixVendas => {
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    const totalProducao = aprovados.reduce((acc, o) => acc + Number(o.subtotal_producao), 0);
    const totalServicos = aprovados.reduce((acc, o) => acc + Number(o.subtotal_servicos), 0);
    const total = totalProducao + totalServicos;
    
    return {
      producao: {
        valor: totalProducao,
        percentual: total > 0 ? (totalProducao / total) * 100 : 0
      },
      servicos: {
        valor: totalServicos,
        percentual: total > 0 ? (totalServicos / total) * 100 : 0
      },
      equilibrado: total > 0 ? Math.abs((totalProducao / total) - 0.5) < 0.2 : true
    };
  }, [orcamentosFiltrados]);

  const insights = useMemo((): InsightDashboard[] => {
    const resultado: InsightDashboard[] = [];
    const hoje = new Date();
    
    // Pipeline parado há mais de 7 dias
    orcamentosFiltrados
      .filter(o => o.status === 'enviado' && o.created_at)
      .forEach(o => {
        const dias = differenceInDays(hoje, parseISO(o.created_at!));
        if (dias > 7) {
          resultado.push({
            tipo: 'alerta',
            mensagem: `${o.consultor_responsavel || 'Sem consultor'} tem R$ ${Number(o.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em pipeline há ${dias} dias (${o.nome_cliente})`,
            consultor: o.consultor_responsavel || undefined,
            valor: Number(o.valor_total)
          });
        }
      });
    
    // Maior venda do período
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    if (aprovados.length > 0) {
      const maiorVenda = aprovados.reduce((max, o) => 
        Number(o.valor_total) > Number(max.valor_total) ? o : max
      );
      resultado.push({
        tipo: 'positivo',
        mensagem: `Maior venda do período: ${maiorVenda.consultor_responsavel || 'Sem consultor'} - R$ ${Number(maiorVenda.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${maiorVenda.nome_cliente})`,
        consultor: maiorVenda.consultor_responsavel || undefined,
        valor: Number(maiorVenda.valor_total)
      });
    }
    
    // Mix desbalanceado
    if (!mixVendas.equilibrado && mixVendas.producao.valor + mixVendas.servicos.valor > 0) {
      resultado.push({
        tipo: 'oportunidade',
        mensagem: `Mix desbalanceado: ${mixVendas.producao.percentual.toFixed(0)}% produção, ${mixVendas.servicos.percentual.toFixed(0)}% serviços`
      });
    }
    
    // Consultores com ticket abaixo da média
    const ticketMedioGeral = kpis.ticketMedio;
    rankingConsultores.forEach(c => {
      if (c.ticketMedio < ticketMedioGeral * 0.8 && c.vendas >= 2) {
        resultado.push({
          tipo: 'atencao',
          mensagem: `${c.consultor} tem ticket médio ${((1 - c.ticketMedio / ticketMedioGeral) * 100).toFixed(0)}% abaixo da média geral`,
          consultor: c.consultor,
          valor: c.ticketMedio
        });
      }
    });
    
    return resultado;
  }, [orcamentosFiltrados, mixVendas, kpis, rankingConsultores]);

  const evolucaoTemporal = useMemo((): EvolucaoTemporal[] => {
    const meses: EvolucaoTemporal[] = [];
    const hoje = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const mesRef = subMonths(hoje, i);
      const inicio = startOfMonth(mesRef);
      const fim = endOfMonth(mesRef);
      
      const orcamentosDoMes = orcamentos.filter(o => {
        if (!o.created_at) return false;
        const data = parseISO(o.created_at);
        return data >= inicio && data <= fim;
      });
      
      const aprovados = orcamentosDoMes.filter(o => o.status === 'aprovado');
      
      meses.push({
        periodo: format(mesRef, 'MMM/yy', { locale: ptBR }),
        faturamento: aprovados.reduce((acc, o) => acc + Number(o.valor_total), 0),
        vendas: aprovados.length,
        recorrencia: 0 // Será preenchido quando tivermos dados de recompras
      });
    }
    
    return meses;
  }, [orcamentos]);

  const distribuicaoCanais = useMemo((): DistribuicaoCanal[] => {
    const aprovados = orcamentosFiltrados.filter(o => o.status === 'aprovado');
    const canais = new Map<string, { clientes: Set<string>; faturamento: number }>();
    
    aprovados.forEach(o => {
      const dados = o.dados_cliente as { locais_fisicos?: boolean; venda_digital?: boolean } | null;
      let canal = 'Não informado';
      
      if (dados) {
        if (dados.locais_fisicos && dados.venda_digital) {
          canal = 'Ambos';
        } else if (dados.locais_fisicos) {
          canal = 'Físico';
        } else if (dados.venda_digital) {
          canal = 'Digital';
        }
      }
      
      const atual = canais.get(canal) || { clientes: new Set<string>(), faturamento: 0 };
      atual.clientes.add(o.nome_cliente);
      atual.faturamento += Number(o.valor_total);
      canais.set(canal, atual);
    });
    
    return Array.from(canais.entries())
      .map(([canal, dados]) => ({
        canal,
        clientes: dados.clientes.size,
        faturamento: dados.faturamento,
        ticketMedio: dados.clientes.size > 0 ? dados.faturamento / dados.clientes.size : 0
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [orcamentosFiltrados]);

  const distribuicaoConsultorStatus = useMemo((): DistribuicaoConsultorStatus[] => {
    const porConsultor = new Map<string, { rascunho: number; enviado: number; aprovado: number; recusado: number }>();

    // Usar TODOS os orçamentos (sem filtro de data) para mostrar contagem completa por consultor
    const orcamentosParaDistribuicao = filtros.consultor 
      ? orcamentos.filter(o => o.consultor_responsavel === filtros.consultor)
      : orcamentos;

    orcamentosParaDistribuicao.forEach(o => {
      const consultor = o.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || { rascunho: 0, enviado: 0, aprovado: 0, recusado: 0 };
      const status = o.status?.toLowerCase() || 'rascunho';
      if (status in atual) {
        (atual as Record<string, number>)[status] += 1;
      }
      porConsultor.set(consultor, atual);
    });

    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({
        consultor,
        ...dados,
        total: dados.rascunho + dados.enviado + dados.aprovado + dados.recusado
      }))
      .sort((a, b) => b.total - a.total);
  }, [orcamentos, filtros.consultor]);

  return {
    orcamentos: orcamentosFiltrados,
    consultoresUnicos,
    kpis,
    rankingConsultores,
    pipelineConsultores,
    produtosMaisVendidos,
    mixVendas,
    insights,
    evolucaoTemporal,
    distribuicaoCanais,
    distribuicaoConsultorStatus,
    vendasPorTipo,
    isLoading: loadingOrcamentos
  };
}
