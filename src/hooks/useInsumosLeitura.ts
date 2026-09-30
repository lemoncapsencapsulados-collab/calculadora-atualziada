import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MateriaPrima, UnitType } from '@/types/formula';

/**
 * Lista de matérias-primas só para leitura, com cache.
 *
 * Existe por causa de um custo escondido do `useInsumos`: ele guarda a lista em
 * `useState` e abre uma inscrição de tempo real ao montar. Numa tela de
 * inventário isso é o certo -- mas num diálogo que abre e fecha o tempo todo,
 * cada abertura refazia a busca das centenas de linhas E abria um canal novo.
 * Era o que travava o "Editar produto".
 *
 * Aqui a lista vem uma vez e fica em cache: reabrir o diálogo é instantâneo.
 * Quem precisa cadastrar, editar ou ver mudança de outro usuário na hora
 * continua usando `useInsumos`.
 */

const mapear = (row: Record<string, any>): MateriaPrima => ({
  id: row.id,
  nome: row.nome,
  unidade_compra: row.unidade_compra as UnitType,
  preco_por_unidade_compra: Number(row.preco_por_unidade_compra) || 0,
  densidade: row.densidade ?? undefined,
  observacoes: row.observacoes ?? undefined,
  fornecedor: row.fornecedor ?? undefined,
  categoria: row.categoria ?? undefined,
  updated_at: row.updated_at ?? undefined,
});

export function useInsumosLeitura() {
  const { data, isLoading } = useQuery({
    queryKey: ['materias-primas-leitura'],
    // Preço de insumo não muda de minuto em minuto; e quando muda, quem mudou
    // está na tela de inventário, que tem a lista própria e atualizada.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('materias_primas')
        .select('*')
        .order('nome');
      if (error) throw error;
      return (rows || []).map(mapear);
    },
  });

  return { insumos: data ?? [], carregando: isLoading };
}
