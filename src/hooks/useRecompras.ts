import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Recompra, RecompraProduto, MetricasRecorrencia } from '@/types/dashboard';
import type { CondicoesPagamento, OrcamentoSnapshot, ItemProducao } from '@/types/orcamento';

interface RecompraInsert {
  nome_cliente: string;
  consultor_responsavel: string;
  data_recompra: string;
  produtos: RecompraProduto[];
  quantidade_total: number;
  valor_total: number;
  observacao?: string;
}

interface CriarRecompraComPedidoInput {
  pedidoOrigem: any;
  consultor: string;
  dataRecompra: string; // YYYY-MM-DD
  produtos: RecompraProduto[];
  condicoes_pagamento?: CondicoesPagamento;
  observacao?: string;
}

const getNextPedNumber = async (): Promise<string> => {
  const { data } = await supabase
    .from('pedidos')
    .select('numero_pedido')
    .like('numero_pedido', 'PED-%');
  let maxNum = 0;
  (data || []).forEach((p: any) => {
    const m = p.numero_pedido.match(/PED-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return `PED-${(maxNum + 1).toString().padStart(3, '0')}`;
};

export function useRecompras() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recompras = [], isLoading } = useQuery({
    queryKey: ['recompras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recompras')
        .select('*')
        .order('data_recompra', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(r => ({
        ...r,
        produtos: (Array.isArray(r.produtos) ? r.produtos : []) as unknown as RecompraProduto[]
      })) as Recompra[];
    }
  });

  const adicionarRecompra = useMutation({
    mutationFn: async (novaRecompra: RecompraInsert) => {
      const { data, error } = await supabase
        .from('recompras')
        .insert([{
          nome_cliente: novaRecompra.nome_cliente,
          consultor_responsavel: novaRecompra.consultor_responsavel,
          data_recompra: novaRecompra.data_recompra,
          produtos: JSON.parse(JSON.stringify(novaRecompra.produtos)),
          quantidade_total: novaRecompra.quantidade_total,
          valor_total: novaRecompra.valor_total,
          observacao: novaRecompra.observacao
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recompras'] });
      toast({
        title: 'Recompra registrada',
        description: 'A venda recorrente foi registrada com sucesso.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao registrar recompra',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Cria uma recompra a partir de um pedido existente E um novo pedido
  // (para que apareça como mais um card na Visão Geral de Pedidos).
  const criarRecompraComPedido = useMutation({
    mutationFn: async (input: CriarRecompraComPedidoInput) => {
      const { pedidoOrigem, consultor, dataRecompra, produtos, condicoes_pagamento, observacao } = input;
      const snapOrigem: any = pedidoOrigem.orcamento_snapshot || {};
      const nomeCliente: string = snapOrigem.nome_cliente
        || snapOrigem.dados_cliente?.nome_completo
        || pedidoOrigem.formula_snapshot?.cliente
        || 'Cliente';

      const valorTotal = produtos.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
      const quantidadeTotal = produtos.reduce((acc, p) => acc + p.quantidade, 0);

      // 1) Insert recompra
      const { data: recompraData, error: errRec } = await supabase
        .from('recompras')
        .insert([{
          nome_cliente: nomeCliente,
          consultor_responsavel: consultor,
          data_recompra: dataRecompra,
          produtos: JSON.parse(JSON.stringify(produtos)),
          quantidade_total: quantidadeTotal,
          valor_total: valorTotal,
          observacao: observacao || null,
        }])
        .select()
        .single();
      if (errRec) throw errRec;

      // 2) Monta itens_producao do snapshot do novo pedido
      const itensOrigem: ItemProducao[] = (snapOrigem.itens_producao || []) as any;
      const itensNovos: ItemProducao[] = produtos.map((p) => {
        const original = itensOrigem.find(it => it.precificacao_id && it.precificacao_id === p.precificacaoId)
          || itensOrigem.find(it => (it.nome_produto || '').toLowerCase() === p.nome.toLowerCase());
        const isPOD = p.modeloNegocio === 'print_on_demand';
        const qtd = isPOD ? 0 : p.quantidade;
        const subtotal = isPOD ? 0 : (p.quantidade * p.valorUnitario);
        return {
          tipo: original?.tipo || 'avulso',
          precificacao_id: original?.precificacao_id || p.precificacaoId,
          nome_produto: p.nome,
          segmento: original?.segmento || '',
          preco_unitario: p.valorUnitario,
          quantidade: qtd,
          subtotal,
          insumos_formula: original?.insumos_formula,
          modelo_negocio: p.modeloNegocio || 'estoque',
          tipo_produto: original?.tipo_produto,
          quantidade_por_pote: original?.quantidade_por_pote,
          unidade_por_pote: original?.unidade_por_pote,
          quantidade_por_dose: original?.quantidade_por_dose,
          unidade_por_dose: original?.unidade_por_dose,
          quantidade_doses: original?.quantidade_doses,
          dose_diaria_sugerida: original?.dose_diaria_sugerida,
          detalhes_producao: original?.detalhes_producao,
          ...(isPOD ? {
            pod_consumo_quantidade: p.podConsumoQuantidade,
            pod_consumo_inicio: p.podConsumoInicio,
            pod_consumo_fim: p.podConsumoFim,
          } : {}),
        };
      });

      const subtotalProducao = itensNovos.reduce((s, i) => s + (i.subtotal || 0), 0);
      const valorTotalSnap = subtotalProducao; // recompras: sem serviços de marca

      const numeroOrcamento = `RECOMPRA-${pedidoOrigem.numero_pedido || snapOrigem.numero_orcamento || ''}-${Date.now().toString().slice(-4)}`;

      const novoSnapshot: OrcamentoSnapshot = {
        id: recompraData.id, // referência simbólica (não há orçamento real)
        numero_orcamento: numeroOrcamento,
        nome_cliente: nomeCliente,
        consultor_responsavel: consultor,
        tipo_orcamento: 'recompra',
        itens_producao: itensNovos,
        servicos_marca: [],
        dados_cliente: snapOrigem.dados_cliente,
        detalhamento_frete: snapOrigem.detalhamento_frete,
        condicoes_pagamento,
        subtotal_producao: subtotalProducao,
        subtotal_servicos: 0,
        valor_total: valorTotalSnap,
        data_pagamento: new Date(dataRecompra).toISOString(),
        observacoes: observacao,
      };

      // 3) Insert novo pedido
      const numeroPedido = await getNextPedNumber();
      const dataIso = new Date(dataRecompra).toISOString();
      const { data: pedidoData, error: errPed } = await supabase
        .from('pedidos')
        .insert([{
          orcamento_id: null,
          orcamento_snapshot: novoSnapshot as any,
          numero_pedido: numeroPedido,
          data_pedido: dataIso,
          data_entrega: dataIso,
          quantidade_produto: quantidadeTotal,
          unidade_produto: 'potes',
          status: 'aguardando_producao',
          formula_id: null,
          formula_snapshot: null,
          observacoes: observacao || null,
        }])
        .select()
        .single();
      if (errPed) throw errPed;

      return { recompra: recompraData, pedido: pedidoData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recompras'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({
        title: 'Recompra registrada',
        description: 'Um novo pedido foi gerado para esta recompra.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao registrar recompra',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const excluirRecompra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recompras')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recompras'] });
      toast({
        title: 'Recompra excluída',
        description: 'O registro foi removido com sucesso.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const calcularMetricas = (faturamentoVendas: number): MetricasRecorrencia => {
    const totalRecompras = recompras.reduce((acc, r) => acc + Number(r.valor_total), 0);
    const clientesUnicos = new Set(recompras.map(r => r.nome_cliente)).size;
    const totalGeral = faturamentoVendas + totalRecompras;
    
    return {
      totalRecompras,
      percentualRecorrente: totalGeral > 0 ? (totalRecompras / totalGeral) * 100 : 0,
      clientesRecorrentes: clientesUnicos,
      ticketMedioRecompra: recompras.length > 0 ? totalRecompras / recompras.length : 0
    };
  };

  const clientesUnicos = Array.from(new Set(recompras.map(r => r.nome_cliente))).sort();
  
  const consultoresUnicos = Array.from(new Set(recompras.map(r => r.consultor_responsavel))).sort();

  return {
    recompras,
    isLoading,
    adicionarRecompra,
    criarRecompraComPedido,
    excluirRecompra,
    calcularMetricas,
    clientesUnicos,
    consultoresUnicos
  };
}
