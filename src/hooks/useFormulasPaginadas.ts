import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Formula } from '@/types/formula';

interface UseFormulasPaginadasParams {
  page: number;
  pageSize: number;
  searchTerm: string;
}

export function useFormulasPaginadas({ page, pageSize, searchTerm }: UseFormulasPaginadasParams) {
  const trimmed = searchTerm.trim();

  // Count query
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['formulas-count', trimmed],
    queryFn: async () => {
      let query = supabase
        .from('formulas')
        .select('*', { count: 'exact', head: true });

      if (trimmed) {
        query = query.or(`nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Data query
  const { data: formulas = [], isLoading } = useQuery({
    queryKey: ['formulas-paginadas', page, pageSize, trimmed],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('formulas')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (trimmed) {
        query = query.or(`nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map(f => ({
        id: f.id,
        cliente: f.cliente,
        nome_formula: f.nome_formula,
        tipo_produto: f.tipo_produto as 'Encapsulados' | 'Solúvel' | 'Gummy' | 'Líquido',
        quantidade_por_pote: f.quantidade_por_pote,
        unidades_por_dose: f.unidades_por_dose,
        unidade_soluvel: f.unidade_soluvel as 'mg' | 'g' | undefined,
        itens: f.itens as any,
        embalagens: f.embalagens as any,
        total_mp: f.total_mp,
        total_embalagem: f.total_embalagem,
        custo_total: f.custo_total,
        data: new Date(f.created_at!),
      })) as Formula[];
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    formulas,
    totalCount,
    totalPages,
    isLoading,
  };
}
