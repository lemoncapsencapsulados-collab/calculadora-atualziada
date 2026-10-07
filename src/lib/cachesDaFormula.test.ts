import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { CACHES_DA_FORMULA, invalidarCachesDaFormula } from './cachesDaFormula';

/** Um QueryClient com dado fresco em cada cache que depende de fórmula. */
function clienteComTudoFresco() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const chave of CACHES_DA_FORMULA) {
    qc.setQueryData(chave as unknown as string[], ['valor antigo']);
  }
  return qc;
}

describe('invalidar depois de salvar a fórmula', () => {
  it('marca TODOS os caches que dependem de fórmula', () => {
    // O bug era invalidar dois dos cinco: a edição entrava no banco e a lista
    // ao lado seguia com o número velho até alguém recarregar a página.
    const qc = clienteComTudoFresco();
    invalidarCachesDaFormula(qc);

    for (const chave of CACHES_DA_FORMULA) {
      const estado = qc.getQueryState(chave as unknown as string[]);
      expect(estado?.isInvalidated, `cache não invalidado: ${chave.join('/')}`).toBe(true);
    }
  });

  it('não apaga o que está na tela', () => {
    // Invalidar e não remover: removido, a lista pisca em branco enquanto
    // rebusca. Invalidado, o valor antigo fica visível até o novo chegar.
    const qc = clienteComTudoFresco();
    invalidarCachesDaFormula(qc);
    expect(qc.getQueryData(['precificacoes-paginadas'])).toEqual(['valor antigo']);
  });

  it('cobre a lista e a paginação, que são caches diferentes', () => {
    // `['precificacoes']` NÃO casa com `['precificacoes-paginadas']` por
    // prefixo: são strings distintas. Invalidar só a primeira deixava a tela
    // de Precificados -- que é paginada -- exibindo a margem antiga.
    const chaves = CACHES_DA_FORMULA.map((c) => c[0]);
    expect(chaves).toContain('precificacoes');
    expect(chaves).toContain('precificacoes-paginadas');
    expect(chaves).toContain('formulas');
    expect(chaves).toContain('formulas-paginadas');
  });

  it('não quebra quando o cache nunca foi preenchido', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    expect(() => invalidarCachesDaFormula(qc)).not.toThrow();
  });
});
