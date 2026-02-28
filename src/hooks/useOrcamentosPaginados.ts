import { useQuery } from '@tanstack/react-query';
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
}

export function useOrcamentosPaginados({ page, pageSize, searchTerm }: UseOrcamentosPaginadosParams) {
  const trimmed = searchTerm.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['orcamentos-paginados', page, pageSize, trimmed],
    queryFn: async () => {
      // Count
      let countQuery = supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true });

      if (trimmed) {
        countQuery = countQuery.or(
          `nome_cliente.ilike.%${trimmed}%,numero_orcamento.ilike.%${trimmed}%,consultor_responsavel.ilike.%${trimmed}%`
        );
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Data
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
