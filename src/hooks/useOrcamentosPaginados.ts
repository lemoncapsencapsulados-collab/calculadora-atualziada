import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Orcamento, ItemProducao, ServicoMarca, DadosCliente, DetalhamentoFrete, CondicoesPagamento } from '@/types/orcamento';

function parseOrcamento(row: any): Orcamento {
  return {
    ...row,
    itens_producao: (row.itens_producao || []) as ItemProducao[],
    servicos_marca: (row.servicos_marca || []) as ServicoMarca[],
    dados_cliente: (row.dados_cliente || {}) as DadosCliente,
    detalhamento_frete: (row.detalhamento_frete || {}) as DetalhamentoFrete,
    condicoes_pagamento: row.condicoes_pagamento as CondicoesPagamento | undefined,
  };
}

interface UseOrcamentosPaginadosParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  consultorFilter?: string;
  enabled?: boolean;
}

export function useOrcamentosPaginados({ page, pageSize, searchTerm, consultorFilter, enabled = true }: UseOrcamentosPaginadosParams) {
  const trimmed = searchTerm.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['orcamentos-paginados', page, pageSize, trimmed, consultorFilter],
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let countQuery = supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true });

      if (trimmed) {
        countQuery = countQuery.or(
          `nome_cliente.ilike.%${trimmed}%,numero_orcamento.ilike.%${trimmed}%,consultor_responsavel.ilike.%${trimmed}%`
        );
      }
      if (consultorFilter) {
        countQuery = countQuery.eq('consultor_responsavel', consultorFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (trimmed) {
        dataQuery = dataQuery.or(
          `nome_cliente.ilike.%${trimmed}%,numero_orcamento.ilike.%${trimmed}%,consultor_responsavel.ilike.%${trimmed}%`
        );
      }
      if (consultorFilter) {
        dataQuery = dataQuery.eq('consultor_responsavel', consultorFilter);
      }

      const { data: rows, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      const totalCount = count ?? 0;
      return {
        orcamentos: (rows || []).map(parseOrcamento),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
  });

  return {
    orcamentos: data?.orcamentos ?? [],
    totalCount: data?.totalCount ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
  };
}

// Hook for kanban: fetches all orcamentos (up to 200) without pagination
export function useOrcamentosKanban({ searchTerm, consultorFilter, enabled = true }: { searchTerm: string; consultorFilter?: string; enabled?: boolean }) {
  const trimmed = searchTerm.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['orcamentos-kanban', trimmed, consultorFilter],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (trimmed) {
        query = query.or(
          `nome_cliente.ilike.%${trimmed}%,numero_orcamento.ilike.%${trimmed}%,consultor_responsavel.ilike.%${trimmed}%`
        );
      }
      if (consultorFilter) {
        query = query.eq('consultor_responsavel', consultorFilter);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      return (rows || []).map(parseOrcamento);
    },
  });

  return { orcamentos: data ?? [], isLoading };
}

// Hook to get distinct consultors
export function useConsultoresDisponiveis() {
  const { data } = useQuery({
    queryKey: ['consultores-disponiveis'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('orcamentos')
        .select('consultor_responsavel')
        .not('consultor_responsavel', 'is', null)
        .not('consultor_responsavel', 'eq', '');

      if (error) throw error;
      const unique = [...new Set((rows || []).map(r => r.consultor_responsavel).filter(Boolean))] as string[];
      return unique.sort();
    },
  });

  return data ?? [];
}
