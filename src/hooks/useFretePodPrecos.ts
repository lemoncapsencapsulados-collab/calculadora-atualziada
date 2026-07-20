import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FretePodPreco, FretePodPrecoHistorico } from '@/types/frete';
import { toast } from 'sonner';

const TABLE = 'frete_pod_precos' as any;
const HIST = 'frete_pod_precos_historico' as any;

export function useFretePodPrecos() {
  return useQuery({
    queryKey: ['frete-pod-precos'],
    queryFn: async (): Promise<FretePodPreco[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('ativo', true)
        .order('tipo_produto', { ascending: true })
        .order('plano', { ascending: true });
      if (error) throw error;
      return (data || []) as FretePodPreco[];
    },
  });
}

export function useFretePodPrecosHistorico() {
  return useQuery({
    queryKey: ['frete-pod-precos-historico'],
    queryFn: async (): Promise<FretePodPrecoHistorico[]> => {
      const { data, error } = await (supabase as any)
        .from(HIST)
        .select('*')
        .order('alterado_em', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as FretePodPrecoHistorico[];
    },
  });
}

export async function fetchPodPrecoAtivo(tipo_produto: string, plano: number): Promise<number | null> {
  const { data, error } = await (supabase as any)
    .from('frete_pod_precos')
    .select('preco')
    .eq('tipo_produto', tipo_produto)
    .eq('plano', plano)
    .eq('ativo', true)
    .limit(1);
  if (error || !data || !data[0]) return null;
  return Number(data[0].preco);
}

export function useUpsertPodPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; tipo_produto: string; plano: number; preco: number; faixa_peso?: string | null; vigencia_inicio?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      let precoAnterior: number | null = null;
      let precoRow: any = null;

      if (payload.id) {
        const { data: existing } = await (supabase as any).from(TABLE).select('preco').eq('id', payload.id).limit(1).single();
        precoAnterior = existing ? Number(existing.preco) : null;
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .update({
            preco: payload.preco,
            faixa_peso: payload.faixa_peso ?? null,
            vigencia_inicio: payload.vigencia_inicio ?? new Date().toISOString().slice(0, 10),
          })
          .eq('id', payload.id)
          .select()
          .single();
        if (error) throw error;
        precoRow = data;
      } else {
        // Desativa preço ativo anterior para o mesmo tipo/plano se existir
        const { data: existingRows } = await (supabase as any)
          .from(TABLE)
          .select('id, preco')
          .eq('tipo_produto', payload.tipo_produto)
          .eq('plano', payload.plano)
          .eq('ativo', true)
          .limit(1);
        if (existingRows && existingRows[0]) {
          precoAnterior = Number(existingRows[0].preco);
          await (supabase as any).from(TABLE).update({ ativo: false }).eq('id', existingRows[0].id);
        }
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .insert([{
            tipo_produto: payload.tipo_produto,
            plano: payload.plano,
            preco: payload.preco,
            faixa_peso: payload.faixa_peso ?? null,
            vigencia_inicio: payload.vigencia_inicio ?? new Date().toISOString().slice(0, 10),
            ativo: true,
          }])
          .select()
          .single();
        if (error) throw error;
        precoRow = data;
      }

      if (precoRow && (precoAnterior === null || Number(precoAnterior) !== Number(payload.preco))) {
        await (supabase as any).from(HIST).insert([{
          preco_id: precoRow.id,
          tipo_produto: payload.tipo_produto,
          plano: payload.plano,
          preco_anterior: precoAnterior,
          preco_novo: payload.preco,
          alterado_por: user?.id ?? null,
          alterado_por_email: user?.email ?? null,
        }]);
      }

      return precoRow as FretePodPreco;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-pod-precos'] });
      qc.invalidateQueries({ queryKey: ['frete-pod-precos-historico'] });
      toast.success('Preço salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar preço'),
  });
}

export function useDesativarPodPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frete-pod-precos'] });
      toast.success('Preço desativado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao desativar'),
  });
}