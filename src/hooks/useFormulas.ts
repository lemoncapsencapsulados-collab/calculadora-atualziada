import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Formula } from '@/types/formula';
import { toast } from 'sonner';

export function useFormulas() {
  const queryClient = useQueryClient();

  // Buscar todas as fórmulas
  const { data: formulas = [], isLoading } = useQuery({
    queryKey: ['formulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formulas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.map(f => ({
        id: f.id,
        cliente: f.cliente,
        nome_formula: f.nome_formula,
        tipo_produto: f.tipo_produto as 'Encapsulados' | 'Pó' | 'Gummy' | 'Líquido',
        qtd_capsulas: f.qtd_capsulas,
        unidades_por_dose: f.unidades_por_dose,
        unidade_po: f.unidade_po as 'mg' | 'g' | undefined,
        itens: f.itens as any,
        embalagens: f.embalagens as any,
        total_mp: f.total_mp,
        total_embalagem: f.total_embalagem,
        custo_total: f.custo_total,
        data: new Date(f.created_at),
      })) as Formula[];
    },
  });

  // Adicionar fórmula
  const addFormula = useMutation({
    mutationFn: async (formula: Omit<Formula, 'id' | 'data'>) => {
      const { data, error } = await supabase
        .from('formulas')
        .insert([{
          cliente: formula.cliente,
          nome_formula: formula.nome_formula,
          tipo_produto: formula.tipo_produto,
          qtd_capsulas: formula.qtd_capsulas,
          unidades_por_dose: formula.unidades_por_dose,
          unidade_po: formula.unidade_po,
          itens: formula.itens as any,
          embalagens: formula.embalagens as any,
          total_mp: formula.total_mp,
          total_embalagem: formula.total_embalagem,
          custo_total: formula.custo_total,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Fórmula salva com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar fórmula:', error);
      toast.error('Erro ao salvar fórmula');
    },
  });

  // Deletar fórmula
  const deleteFormula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('formulas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Fórmula excluída com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir fórmula:', error);
      toast.error('Erro ao excluir fórmula');
    },
  });

  // Atualizar fórmula
  const updateFormula = useMutation({
    mutationFn: async (formula: Formula) => {
      const { error } = await supabase
        .from('formulas')
        .update({
          cliente: formula.cliente,
          nome_formula: formula.nome_formula,
          tipo_produto: formula.tipo_produto,
          qtd_capsulas: formula.qtd_capsulas,
          unidades_por_dose: formula.unidades_por_dose,
          unidade_po: formula.unidade_po,
          itens: formula.itens as any,
          embalagens: formula.embalagens as any,
          total_mp: formula.total_mp,
          total_embalagem: formula.total_embalagem,
          custo_total: formula.custo_total,
        })
        .eq('id', formula.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      toast.success('Fórmula atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar fórmula:', error);
      toast.error('Erro ao atualizar fórmula');
    },
  });

  return {
    formulas,
    loading: isLoading,
    addFormula: addFormula.mutate,
    deleteFormula: deleteFormula.mutate,
    updateFormula: updateFormula.mutate,
  };
}
