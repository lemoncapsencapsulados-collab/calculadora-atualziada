import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UsePrecificacoesPaginadasParams {
  page: number;
  pageSize: number;
  searchTerm: string;
}

export function usePrecificacoesPaginadas({ page, pageSize, searchTerm }: UsePrecificacoesPaginadasParams) {
  const trimmed = searchTerm.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['precificacoes-paginadas', page, pageSize, trimmed],
    queryFn: async () => {
      // Count query
      let countQuery = supabase
        .from('precificacoes')
        .select('id, formulas!inner(nome_formula, cliente)', { count: 'exact', head: true });

      if (trimmed) {
        countQuery = countQuery.or(
          `nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`,
          { referencedTable: 'formulas' }
        );
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Data query
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('precificacoes')
        .select('*, formulas!inner(nome_formula, cliente, tipo_produto)')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (trimmed) {
        dataQuery = dataQuery.or(
          `nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`,
          { referencedTable: 'formulas' }
        );
      }

      const { data: rows, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      const totalCount = count ?? 0;
      return {
        precificacoes: rows,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
  });

  return {
    precificacoes: data?.precificacoes ?? [],
    totalCount: data?.totalCount ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
  };
}
