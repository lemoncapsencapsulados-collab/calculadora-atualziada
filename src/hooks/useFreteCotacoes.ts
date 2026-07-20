import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FreteCotacao, FreteCotacaoInsert } from '@/types/frete';
import { toast } from 'sonner';

const TABLE = 'frete_cotacoes' as any;

export function useFreteCotacoes() {
  return useQuery({
    queryKey: ['frete-cotacoes'],
    queryFn: async (): Promise<FreteCotacao[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('ativa', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FreteCotacao[];
    },
  });
}

export function useFreteCotacaoByOrcamento(orcamentoId?: string | null) {
  return useQuery({
    queryKey: ['frete-cotacao', orcamentoId],
    enabled: !!orcamentoId,
    queryFn: async (): Promise<FreteCotacao | null> => {
      if (!orcamentoId) return null;
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .eq('ativa', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data[0]) ? (data[0] as FreteCotacao) : null;
    },
  });
}

export async function fetchFreteCotacaoByOrcamento(orcamentoId: string): Promise<FreteCotacao | null> {
  const { data, error } = await (supabase as any)
    .from('frete_cotacoes')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[frete] erro ao buscar cotação', error);
    return null;
  }
  return (data && data[0]) ? (data[0] as FreteCotacao) : null;
}

export function useCreateFreteCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cotacao, substituir }: { cotacao: FreteCotacaoInsert; substituir?: boolean }) => {
      if (substituir) {
        const { error: updErr } = await (supabase as any)
          .from(TABLE)
          .update({ ativa: false })
          .eq('orcamento_id', cotacao.orcamento_id)
          .eq('ativa', true);
        if (updErr) throw updErr;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert([cotacao])
        .select()
        .single();
      if (error) throw error;
      return data as FreteCotacao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-cotacoes'] });
      qc.invalidateQueries({ queryKey: ['frete-cotacao'] });
      toast.success('Cotação de frete criada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar cotação'),
  });
}

export function useUpdateFreteCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FreteCotacao> }) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as FreteCotacao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-cotacoes'] });
      qc.invalidateQueries({ queryKey: ['frete-cotacao'] });
      toast.success('Cotação atualizada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });
}

export function useDeleteFreteCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-cotacoes'] });
      qc.invalidateQueries({ queryKey: ['frete-cotacao'] });
      toast.success('Cotação excluída');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });
}