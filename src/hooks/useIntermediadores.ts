import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Intermediador {
  id: string;
  nome: string;
  whatsapp: string;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntermediadorInput {
  nome: string;
  whatsapp?: string;
  observacoes?: string | null;
}

export function useIntermediadores(apenasAtivos = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['intermediadores', apenasAtivos],
    queryFn: async () => {
      let q = supabase.from('intermediadores' as any).select('*').order('nome');
      if (apenasAtivos) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Intermediador[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['intermediadores'] });

  const criar = useMutation({
    mutationFn: async (dados: IntermediadorInput) => {
      const { data, error } = await supabase
        .from('intermediadores' as any)
        .insert({
          nome: dados.nome.trim(),
          whatsapp: (dados.whatsapp || '').trim(),
          observacoes: dados.observacoes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Intermediador;
    },
    onSuccess: () => { invalidate(); toast.success('Intermediador cadastrado'); },
    onError: (e: any) => toast.error(e.message || 'Erro ao cadastrar intermediador'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...dados }: IntermediadorInput & { id: string }) => {
      const { error } = await supabase
        .from('intermediadores' as any)
        .update({
          nome: dados.nome.trim(),
          whatsapp: (dados.whatsapp || '').trim(),
          observacoes: dados.observacoes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Intermediador atualizado'); },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar intermediador'),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('intermediadores' as any).update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.ativo ? 'Intermediador ativado' : 'Intermediador desativado'); },
    onError: (e: any) => toast.error(e.message || 'Erro ao alterar situação'),
  });

  return { ...query, criar, atualizar, toggleAtivo };
}
