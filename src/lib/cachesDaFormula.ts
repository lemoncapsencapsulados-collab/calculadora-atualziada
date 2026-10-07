import type { QueryClient } from '@tanstack/react-query';

/**
 * Tudo que fica velho quando uma fórmula muda.
 *
 * Mudar matéria-prima muda o custo; mudar o custo muda a margem; e a margem
 * aparece na lista de precificações, na contagem, na paginação e na lista de
 * fórmulas. Quem salvava invalidava dois desses cinco, então a edição entrava
 * no banco e a tela ao lado seguia mostrando o número antigo até alguém
 * recarregar a página.
 *
 * A lista mora aqui, e não espalhada em cada `onSalvo`, porque o erro não é
 * esquecer de invalidar -- é invalidar quase tudo. Cache novo que dependa de
 * fórmula entra nesta lista e passa a ser atualizado em todos os pontos de
 * gravação de uma vez.
 */
export const CACHES_DA_FORMULA: readonly (readonly [string])[] = [
  ['formulas'],
  ['formulas-paginadas'],
  ['formulas-count'],
  ['precificacoes'],
  ['precificacoes-paginadas'],
] as const;

/**
 * Marca como velho tudo que depende de fórmula, para o React Query rebuscar.
 *
 * Invalidar, e não remover: remover apaga o que está na tela e faz a lista
 * piscar em branco enquanto rebusca. Invalidado, o dado antigo continua
 * visível até o novo chegar.
 */
export function invalidarCachesDaFormula(queryClient: QueryClient): void {
  for (const chave of CACHES_DA_FORMULA) {
    queryClient.invalidateQueries({ queryKey: chave as unknown as string[] });
  }
}
