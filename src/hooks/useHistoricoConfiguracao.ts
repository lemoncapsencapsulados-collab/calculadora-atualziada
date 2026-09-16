import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricoConfiguracao {
  id: string;
  configuracao_id: string | null;
  usuario_email: string | null;
  snapshot: Record<string, any>;
  snapshot_anterior: Record<string, any>;
  created_at: string;
}

export function useHistoricoConfiguracao() {
  const queryClient = useQueryClient();

  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico-configuracao-custos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_configuracao_custos' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as HistoricoConfiguracao[];
    },
  });

  const registrarHistorico = useMutation({
    mutationFn: async (params: {
      configuracao_id: string;
      snapshot: Record<string, any>;
      snapshot_anterior: Record<string, any>;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const usuario_email = userRes?.user?.email ?? null;

      const { data, error } = await supabase
        .from('historico_configuracao_custos' as any)
        .insert({
          configuracao_id: params.configuracao_id,
          usuario_email,
          snapshot: params.snapshot,
          snapshot_anterior: params.snapshot_anterior,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as HistoricoConfiguracao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historico-configuracao-custos'] });
    },
  });

  return { historico, isLoading, registrarHistorico };
}
