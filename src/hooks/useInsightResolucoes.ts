import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface InsightResolucao {
  id: string;
  orcamento_id: string;
  numero_orcamento?: string | null;
  cliente?: string | null;
  consultor?: string | null;
  observacao: string;
  resolvido_por?: string | null;
  resolvido_por_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarcarResolvidoInput {
  orcamento_id: string;
  numero_orcamento?: string;
  cliente?: string;
  consultor?: string;
  observacao: string;
}

export function useInsightResolucoes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['insight-resolucoes'],
    queryFn: async (): Promise<Record<string, InsightResolucao>> => {
      const { data, error } = await supabase.from('insight_resolucoes').select('*');
      if (error) throw error;
      const mapa: Record<string, InsightResolucao> = {};
      (data || []).forEach((r: any) => {
        mapa[r.orcamento_id] = r as InsightResolucao;
      });
      return mapa;
    },
  });

  const marcarResolvido = useMutation({
    mutationFn: async (input: MarcarResolvidoInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('insight_resolucoes')
        .upsert(
          {
            orcamento_id: input.orcamento_id,
            numero_orcamento: input.numero_orcamento || null,
            cliente: input.cliente || null,
            consultor: input.consultor || null,
            observacao: input.observacao,
            resolvido_por: userData.user?.id || null,
            resolvido_por_email: userData.user?.email || null,
          },
          { onConflict: 'orcamento_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insight-resolucoes'] });
      toast({ title: 'Orçamento marcado como resolvido' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao resolver', description: e.message, variant: 'destructive' });
    },
  });

  const desfazerResolucao = useMutation({
    mutationFn: async (orcamentoId: string) => {
      const { error } = await supabase
        .from('insight_resolucoes')
        .delete()
        .eq('orcamento_id', orcamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insight-resolucoes'] });
      toast({ title: 'Resolução desfeita' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao desfazer', description: e.message, variant: 'destructive' });
    },
  });

  return {
    resolucoes: query.data || {},
    isLoading: query.isLoading,
    marcarResolvido,
    desfazerResolucao,
  };
}