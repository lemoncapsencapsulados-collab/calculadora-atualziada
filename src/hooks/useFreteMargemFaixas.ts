import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FreteMargemFaixa } from '@/types/frete';
import { toast } from 'sonner';

const TABLE = 'frete_margem_faixas' as any;

export function useFreteMargemFaixas() {
  return useQuery({
    queryKey: ['frete-margem-faixas'],
    queryFn: async (): Promise<FreteMargemFaixa[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .order('envios_min', { ascending: true });
      if (error) throw error;
      return (data || []) as FreteMargemFaixa[];
    },
  });
}

export function useUpsertMargemFaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; envios_min: number; envios_max: number | null; margem_percentual: number; ativo?: boolean }) => {
      if (payload.id) {
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .update({
            envios_min: payload.envios_min,
            envios_max: payload.envios_max,
            margem_percentual: payload.margem_percentual,
            ativo: payload.ativo ?? true,
          })
          .eq('id', payload.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert([{
          envios_min: payload.envios_min,
          envios_max: payload.envios_max,
          margem_percentual: payload.margem_percentual,
          ativo: payload.ativo ?? true,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-margem-faixas'] });
      toast.success('Faixa de margem salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar faixa'),
  });
}

export function useDeleteMargemFaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-margem-faixas'] });
      toast.success('Faixa removida');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
  });
}