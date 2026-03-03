import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pedido } from '@/types/formula';

export const usePedidos = () => {
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('data_pedido', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(p => ({
        id: p.id,
        formula_id: p.formula_id || undefined,
        orcamento_id: (p as any).orcamento_id || undefined,
        numero_pedido: p.numero_pedido,
        data_pedido: new Date(p.data_pedido),
        data_entrega: new Date(p.data_entrega),
        quantidade_produto: Number(p.quantidade_produto),
        unidade_produto: p.unidade_produto,
        observacoes: p.observacoes || undefined,
        status: p.status as Pedido['status'],
        formula_snapshot: p.formula_snapshot as any || undefined,
        orcamento_snapshot: (p as any).orcamento_snapshot as any || undefined,
        created_at: new Date(p.created_at),
        updated_at: new Date(p.updated_at),
      })) as Pedido[];
    },
  });

  const createPedido = useMutation({
    mutationFn: async (pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('pedidos')
        .insert([{
          formula_id: pedido.formula_id || null,
          numero_pedido: pedido.numero_pedido,
          data_pedido: pedido.data_pedido.toISOString(),
          data_entrega: pedido.data_entrega.toISOString(),
          quantidade_produto: pedido.quantidade_produto,
          unidade_produto: pedido.unidade_produto,
          observacoes: pedido.observacoes || null,
          status: pedido.status,
          formula_snapshot: pedido.formula_snapshot as any || null,
          orcamento_id: (pedido as any).orcamento_id || null,
          orcamento_snapshot: (pedido as any).orcamento_snapshot || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido de produção criado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao criar pedido de produção');
    },
  });

  const createPedidoFromOrcamento = useMutation({
    mutationFn: async (orcamento: any) => {
      // Get next pedido number
      const { data: existingPedidos } = await supabase
        .from('pedidos')
        .select('numero_pedido')
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNum = 'PED-001';
      if (existingPedidos && existingPedidos.length > 0) {
        const match = existingPedidos[0].numero_pedido.match(/PED-(\d+)/);
        if (match) {
          nextNum = `PED-${(parseInt(match[1], 10) + 1).toString().padStart(3, '0')}`;
        }
      }

      const snapshot = {
        id: orcamento.id,
        numero_orcamento: orcamento.numero_orcamento,
        nome_cliente: orcamento.nome_cliente,
        consultor_responsavel: orcamento.consultor_responsavel,
        tipo_orcamento: orcamento.tipo_orcamento,
        itens_producao: orcamento.itens_producao,
        servicos_marca: orcamento.servicos_marca,
        dados_cliente: orcamento.dados_cliente,
        detalhamento_frete: orcamento.detalhamento_frete,
        condicoes_pagamento: orcamento.condicoes_pagamento,
        subtotal_producao: orcamento.subtotal_producao,
        subtotal_servicos: orcamento.subtotal_servicos,
        valor_total: orcamento.valor_total,
        data_pagamento: orcamento.data_pagamento,
        observacoes: orcamento.observacoes,
      };

      const totalQtd = (orcamento.itens_producao || []).reduce((sum: number, item: any) => sum + (item.quantidade || 1), 0);

      const { data, error } = await supabase
        .from('pedidos')
        .insert([{
          orcamento_id: orcamento.id,
          orcamento_snapshot: snapshot as any,
          numero_pedido: nextNum,
          data_pedido: new Date().toISOString(),
          data_entrega: orcamento.data_pagamento || new Date().toISOString(),
          quantidade_produto: totalQtd,
          unidade_produto: 'potes',
          status: 'aguardando_producao',
          formula_id: null,
          formula_snapshot: null,
          observacoes: orcamento.observacoes || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido criado automaticamente a partir do orçamento aprovado!');
    },
    onError: (error) => {
      console.error('Erro ao criar pedido do orçamento:', error);
      toast.error('Erro ao criar pedido a partir do orçamento');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Pedido['status'] }) => {
      const { data, error } = await supabase
        .from('pedidos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Status do pedido atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const deletePedido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido excluído com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir pedido');
    },
  });

  return {
    pedidos,
    loading: isLoading,
    createPedido: createPedido.mutateAsync,
    createPedidoFromOrcamento: createPedidoFromOrcamento.mutateAsync,
    updateStatus: updateStatus.mutate,
    deletePedido: deletePedido.mutate,
  };
};
