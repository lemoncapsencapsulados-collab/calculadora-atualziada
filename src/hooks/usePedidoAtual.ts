import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Mantém a linha do pedido sempre atualizada (realtime), sem exigir recarregar a tela.
 */
export const usePedidoAtual = (pedidoId?: string | null, enabled = true) => {
  const queryClient = useQueryClient();

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido-atual', pedidoId],
    enabled: !!pedidoId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId as string)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!pedidoId || !enabled) return;
    const channel = supabase
      .channel(`pedido-atual-${pedidoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pedido-atual', pedidoId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId, enabled, queryClient]);

  return { pedido, isLoading };
};