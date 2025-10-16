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
        formula_id: p.formula_id,
        numero_pedido: p.numero_pedido,
        data_pedido: new Date(p.data_pedido),
        data_entrega: new Date(p.data_entrega),
        quantidade_produto: Number(p.quantidade_produto),
        unidade_produto: p.unidade_produto,
        observacoes: p.observacoes || undefined,
        status: p.status as Pedido['status'],
        formula_snapshot: p.formula_snapshot as any,
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
          formula_id: pedido.formula_id,
          numero_pedido: pedido.numero_pedido,
          data_pedido: pedido.data_pedido.toISOString(),
          data_entrega: pedido.data_entrega.toISOString(),
          quantidade_produto: pedido.quantidade_produto,
          unidade_produto: pedido.unidade_produto,
          observacoes: pedido.observacoes || null,
          status: pedido.status,
          formula_snapshot: pedido.formula_snapshot as any,
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
    updateStatus: updateStatus.mutate,
    deletePedido: deletePedido.mutate,
  };
};
