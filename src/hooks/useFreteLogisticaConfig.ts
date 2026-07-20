import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FreteLogisticaConfig, FRETE_TIPOS_PRODUTO } from '@/types/frete';
import { toast } from 'sonner';

const TABLE = 'frete_logistica_config' as any;

export function useFreteLogisticaConfig() {
  return useQuery({
    queryKey: ['frete-logistica-config'],
    queryFn: async (): Promise<FreteLogisticaConfig[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .order('tipo_produto');
      if (error) throw error;
      return (data || []) as FreteLogisticaConfig[];
    },
  });
}

/** Retorna um mapa { tipo_produto: taxa_manuseio }, com 0 para tipos sem registro. */
export function useTaxaManuseioMap(): Record<string, number> {
  const { data = [] } = useFreteLogisticaConfig();
  const map: Record<string, number> = {};
  for (const t of FRETE_TIPOS_PRODUTO) map[t] = 0;
  for (const c of data) map[c.tipo_produto] = Number(c.taxa_manuseio) || 0;
  return map;
}

export function useUpsertTaxaManuseio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tipo_produto: string; taxa_manuseio: number }) => {
      const { data: existing } = await (supabase as any)
        .from(TABLE)
        .select('id')
        .eq('tipo_produto', payload.tipo_produto)
        .limit(1);
      if (existing && existing[0]) {
        const { error } = await (supabase as any)
          .from(TABLE)
          .update({ taxa_manuseio: payload.taxa_manuseio })
          .eq('id', existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from(TABLE)
          .insert([{ tipo_produto: payload.tipo_produto, taxa_manuseio: payload.taxa_manuseio }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-logistica-config'] });
      toast.success('Taxa de manuseio salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar taxa'),
  });
}