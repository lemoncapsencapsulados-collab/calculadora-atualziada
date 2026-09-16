import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Precificacao } from '@/types/precificacao';
import { toast } from 'sonner';

export function usePrecificacao() {
  const queryClient = useQueryClient();

  // Buscar todas as precificações
  const { data: precificacoes, isLoading } = useQuery({
    queryKey: ['precificacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precificacoes')
        .select('*, formulas(nome_formula, cliente, tipo_produto)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar precificações de uma fórmula específica
  const buscarPorFormula = (formulaId: string) => {
    return useQuery({
      queryKey: ['precificacoes', formulaId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('precificacoes')
          .select('*')
          .eq('formula_id', formulaId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Precificacao[];
      },
    });
  };

  // Salvar nova precificação
  const salvarPrecificacao = useMutation({
    mutationFn: async (precificacao: Omit<Precificacao, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('precificacoes')
        .insert(precificacao)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      toast.success('Precificação salva com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar precificação: ' + error.message);
    },
  });

  // Atualizar precificação existente
  const atualizarPrecificacao = useMutation({
    mutationFn: async (precificacao: Partial<Precificacao> & { id: string }) => {
      const { id, ...updateData } = precificacao;
      const { data, error } = await supabase
        .from('precificacoes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      toast.success('Precificação atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar precificação: ' + error.message);
    },
  });

  // Deletar precificação
  const deletarPrecificacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('precificacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      toast.success('Precificação deletada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao deletar precificação: ' + error.message);
    },
  });

  return {
    precificacoes,
    isLoading,
    buscarPorFormula,
    salvarPrecificacao,
    atualizarPrecificacao,
    deletarPrecificacao,
  };
}
