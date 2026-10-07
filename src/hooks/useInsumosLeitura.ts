import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapFromDB } from '@/lib/materiaPrima';

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

export function useInsumosLeitura() {
  const { data, isLoading, error, refetch } = useQuery({
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
      return (rows || []).map(mapFromDB);
    },
  });

  /**
   * `erro` sai junto de propósito. Sem ele, uma falha de rede devolve lista
   * vazia -- e a tela de edição mostra toda matéria-prima da fórmula como
   * "não encontrada", com custo zero e margem de três dígitos, como se o
   * produto é que estivesse errado.
   */
  return {
    insumos: data ?? [],
    carregando: isLoading,
    erro: error instanceof Error ? error.message : error ? String(error) : null,
    recarregar: refetch,
  };
}
