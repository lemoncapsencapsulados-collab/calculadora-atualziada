import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContratoModelo {
  id: string;
  nome: string;
  template_id: string;
  ambiente: 'producao' | 'sandbox';
  descricao: string | null;
  is_padrao: boolean;
  created_at: string;
  updated_at: string;
}

export type ContratoModeloInput = Omit<ContratoModelo, 'id' | 'created_at' | 'updated_at'>;

const KEY = ['contrato-modelos'];

export function useContratoModelos() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('contrato_modelos')
        .select('*')
        .order('is_padrao', { ascending: false })
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []) as ContratoModelo[];
    },
  });
}

export function useSalvarContratoModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string; values: ContratoModeloInput }) => {
      const { id, values } = args;
      // If marking as default, clear other defaults first
      if (values.is_padrao) {
        await (supabase as any).from('contrato_modelos').update({ is_padrao: false }).neq('id', id ?? '00000000-0000-0000-0000-000000000000');
      }
      if (id) {
        const { data, error } = await (supabase as any).from('contrato_modelos').update(values).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any).from('contrato_modelos').insert(values).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Modelo salvo!');
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + (e?.message || 'desconhecido')),
  });
}

export function useExcluirContratoModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('contrato_modelos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Modelo excluído.');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + (e?.message || 'desconhecido')),
  });
}