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
  DistribuicaoCanal,
  DistribuicaoConsultorStatus
} from '@/types/dashboard';

interface PedidoData {
  id: string;
  numero_pedido: string;
  status: string;
  created_at: string | null;
  data_pedido: string;
  orcamento_snapshot: any;
}

interface ItemProducao {
  nome?: string;
  nome_produto?: string;
  nomeFormula?: string;
  quantidade?: number;
  quantidadePote?: number;
  precoVenda?: number;
  valorTotal?: number;
  subtotal?: number;
  modelo_negocio?: string;
}

export function useDashboardComercial(filtros: DashboardFiltros) {
  const { data: pedidos = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ['pedidos-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, status, created_at, data_pedido, orcamento_snapshot')
        .not('orcamento_snapshot', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as PedidoData[];
    }
  });

  // Helper to extract snapshot fields
  const getSnap = (p: PedidoData) => p.orcamento_snapshot || {};

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      const snap = getSnap(p);
      if (filtros.consultor && snap.consultor_responsavel !== filtros.consultor) return false;
      const dataPgto = snap.data_pagamento;
      if (dataPgto) {
        const d = parseISO(dataPgto);
        if (d < filtros.dataInicio || d > filtros.dataFim) return false;
      } else {
        return false;
      }
      return true;
    });
  }, [pedidos, filtros]);

  const consultoresUnicos = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => {
      const c = getSnap(p).consultor_responsavel;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  const kpis = useMemo((): KPIsGerais => {
    const faturamentoTotal = pedidosFiltrados.reduce((acc, p) => acc + Number(getSnap(p).valor_total || 0), 0);
    const novasVendas = pedidosFiltrados.length;
    const ticketMedio = novasVendas > 0 ? faturamentoTotal / novasVendas : 0;
    const emProducao = pedidosFiltrados.filter(p => p.status === 'aguardando_producao');
    const pipelineNegociacao = emProducao.reduce((acc, p) => acc + Number(getSnap(p).valor_total || 0), 0);

    return {
      faturamentoTotal,
      novasVendas,
      pipelineNegociacao,
      ticketMedio,
      taxaConversao: 100, // all pedidos are from paid orcamentos
      totalRecusados: 0
    };
  }, [pedidosFiltrados]);

  const rankingConsultores = useMemo((): MetricaConsultor[] => {
    const porConsultor = new Map<string, { vendas: number; faturamento: number; clientes: Set<string> }>();
    
    pedidosFiltrados.forEach(p => {
      const snap = getSnap(p);
      const consultor = snap.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || { vendas: 0, faturamento: 0, clientes: new Set<string>() };
      atual.vendas += 1;
      atual.faturamento += Number(snap.valor_total || 0);
      atual.clientes.add(snap.nome_cliente || '');
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
  }, [pedidosFiltrados]);

  const vendasPorTipo = useMemo(() => {
    const porConsultor = new Map<string, { novo_produtor: { qtd: number; valor: number }; recompra: { qtd: number; valor: number } }>();

    pedidosFiltrados.forEach(p => {
      const snap = getSnap(p);
      const consultor = snap.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || {
        novo_produtor: { qtd: 0, valor: 0 },
        recompra: { qtd: 0, valor: 0 },
      };
      const tipo = snap.tipo_orcamento === 'recompra' ? 'recompra' : 'novo_produtor';
      atual[tipo].qtd += 1;
      atual[tipo].valor += Number(snap.valor_total || 0);
      porConsultor.set(consultor, atual);
    });

    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({ consultor, ...dados }))
      .sort((a, b) => (b.novo_produtor.valor + b.recompra.valor) - (a.novo_produtor.valor + a.recompra.valor));
  }, [pedidosFiltrados]);

  const pipelineConsultores = useMemo((): PipelineConsultor[] => {
    const emProducao = pedidosFiltrados.filter(p => p.status === 'aguardando_producao');
    const porConsultor = new Map<string, { propostas: number; valorTotal: number; diasTotal: number }>();
    const hoje = new Date();
    
    emProducao.forEach(p => {
      const snap = getSnap(p);
      const consultor = snap.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || { propostas: 0, valorTotal: 0, diasTotal: 0 };
      atual.propostas += 1;
      atual.valorTotal += Number(snap.valor_total || 0);
      if (p.created_at) {
        atual.diasTotal += differenceInDays(hoje, parseISO(p.created_at));
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
  }, [pedidosFiltrados]);

  const produtosMaisVendidos = useMemo((): ProdutoVendido[] => {
    const produtos = new Map<string, { quantidade: number; faturamento: number }>();
    
    pedidosFiltrados.forEach(p => {
      const snap = getSnap(p);
      const itens = snap.itens_producao as ItemProducao[] | null;
      if (Array.isArray(itens)) {
        itens.forEach(item => {
          const nome = item.nome_produto || item.nome || item.nomeFormula || 'Produto sem nome';
          const atual = produtos.get(nome) || { quantidade: 0, faturamento: 0 };
          atual.quantidade += Number(item.quantidade || item.quantidadePote || 0);
          atual.faturamento += Number(item.subtotal || item.valorTotal || item.precoVenda || 0);
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
  }, [pedidosFiltrados]);

  const mixVendas = useMemo((): MixVendas => {
    const totalProducao = pedidosFiltrados.reduce((acc, p) => acc + Number(getSnap(p).subtotal_producao || 0), 0);
    const totalServicos = pedidosFiltrados.reduce((acc, p) => acc + Number(getSnap(p).subtotal_servicos || 0), 0);
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
  }, [pedidosFiltrados]);

  const insights = useMemo((): InsightDashboard[] => {
    const resultado: InsightDashboard[] = [];
    const hoje = new Date();
    
    // Alert for pedidos stuck in production
    pedidosFiltrados
      .filter(p => p.status === 'aguardando_producao' && p.created_at)
      .forEach(p => {
        const snap = getSnap(p);
        const dias = differenceInDays(hoje, parseISO(p.created_at!));
        if (dias > 7) {
          resultado.push({
            tipo: 'alerta',
            mensagem: `${snap.consultor_responsavel || 'Sem consultor'} tem R$ ${Number(snap.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aguardando produção há ${dias} dias (${snap.nome_cliente})`,
            consultor: snap.consultor_responsavel || undefined,
            valor: Number(snap.valor_total || 0)
          });
        }
      });
    
    // Biggest sale
    if (pedidosFiltrados.length > 0) {
      const maior = pedidosFiltrados.reduce((max, p) => {
        const vMax = Number(getSnap(max).valor_total || 0);
        const vP = Number(getSnap(p).valor_total || 0);
        return vP > vMax ? p : max;
      });
      const snapMaior = getSnap(maior);
      resultado.push({
        tipo: 'positivo',
        mensagem: `Maior venda do período: ${snapMaior.consultor_responsavel || 'Sem consultor'} - R$ ${Number(snapMaior.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${snapMaior.nome_cliente})`,
        consultor: snapMaior.consultor_responsavel || undefined,
        valor: Number(snapMaior.valor_total || 0)
      });
    }
    
    if (!mixVendas.equilibrado && mixVendas.producao.valor + mixVendas.servicos.valor > 0) {
      resultado.push({
        tipo: 'oportunidade',
        mensagem: `Mix desbalanceado: ${mixVendas.producao.percentual.toFixed(0)}% produção, ${mixVendas.servicos.percentual.toFixed(0)}% serviços`
      });
    }
    
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
  }, [pedidosFiltrados, mixVendas, kpis, rankingConsultores]);

  const evolucaoTemporal = useMemo((): EvolucaoTemporal[] => {
    const meses: EvolucaoTemporal[] = [];
    const hoje = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const mesRef = subMonths(hoje, i);
      const inicio = startOfMonth(mesRef);
      const fim = endOfMonth(mesRef);
      
      const pedidosDoMes = pedidos.filter(p => {
        const dataPgto = getSnap(p).data_pagamento;
        if (!dataPgto) return false;
        const data = parseISO(dataPgto);
        return data >= inicio && data <= fim;
      });
      
      meses.push({
        periodo: format(mesRef, 'MMM/yy', { locale: ptBR }),
        faturamento: pedidosDoMes.reduce((acc, p) => acc + Number(getSnap(p).valor_total || 0), 0),
        vendas: pedidosDoMes.length,
        recorrencia: 0
      });
    }
    
    return meses;
  }, [pedidos]);

  const distribuicaoCanais = useMemo((): DistribuicaoCanal[] => {
    const canais = new Map<string, { clientes: Set<string>; faturamento: number }>();
    
    pedidosFiltrados.forEach(p => {
      const snap = getSnap(p);
      const dados = snap.dados_cliente as { locais_fisicos?: boolean; venda_digital?: boolean; forma_venda?: string } | null;
      let canal = 'Não informado';
      
      if (dados) {
        if (dados.forma_venda === 'ambas' || (dados.locais_fisicos && dados.venda_digital)) {
          canal = 'Ambos';
        } else if (dados.forma_venda === 'locais_fisicos' || dados.locais_fisicos) {
          canal = 'Físico';
        } else if (dados.forma_venda === 'venda_digital' || dados.venda_digital) {
          canal = 'Digital';
        }
      }
      
      const atual = canais.get(canal) || { clientes: new Set<string>(), faturamento: 0 };
      atual.clientes.add(snap.nome_cliente || '');
      atual.faturamento += Number(snap.valor_total || 0);
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
  }, [pedidosFiltrados]);

  const clientesPorModelo = useMemo(() => {
    const porConsultor = new Map<string, { estoque: { qtd: number; valor: number }; pod: { qtd: number; valor: number } }>();

    pedidosFiltrados.forEach(p => {
      const snap = getSnap(p);
      const consultor = snap.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || {
        estoque: { qtd: 0, valor: 0 },
        pod: { qtd: 0, valor: 0 },
      };
      const itens = snap.itens_producao as any[] | null;
      const temPod = Array.isArray(itens) && itens.some((i: any) => i.modelo_negocio === 'print_on_demand');
      const tipo = temPod ? 'pod' : 'estoque';
      atual[tipo].qtd += 1;
      atual[tipo].valor += Number(snap.valor_total || 0);
      porConsultor.set(consultor, atual);
    });

    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({ consultor, ...dados }))
      .sort((a, b) => (b.estoque.valor + b.pod.valor) - (a.estoque.valor + a.pod.valor));
  }, [pedidosFiltrados]);

  const distribuicaoConsultorStatus = useMemo((): DistribuicaoConsultorStatus[] => {
    const porConsultor = new Map<string, { aguardando_producao: number; no_estoque: number; enviado: number; concluido: number }>();

    const pedidosParaDistribuicao = filtros.consultor 
      ? pedidos.filter(p => getSnap(p).consultor_responsavel === filtros.consultor)
      : pedidos;

    pedidosParaDistribuicao.forEach(p => {
      const snap = getSnap(p);
      const consultor = snap.consultor_responsavel || 'Sem Consultor';
      const atual = porConsultor.get(consultor) || { aguardando_producao: 0, no_estoque: 0, enviado: 0, concluido: 0 };
      const status = p.status?.toLowerCase() || 'aguardando_producao';
      if (status in atual) {
        (atual as Record<string, number>)[status] += 1;
      }
      porConsultor.set(consultor, atual);
    });

    return Array.from(porConsultor.entries())
      .map(([consultor, dados]) => ({
        consultor,
        ...dados,
        total: dados.aguardando_producao + dados.no_estoque + dados.enviado + dados.concluido
      }))
      .sort((a, b) => b.total - a.total);
  }, [pedidos, filtros.consultor]);

  return {
    orcamentos: pedidosFiltrados,
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
    clientesPorModelo,
    isLoading: loadingPedidos
  };
}
