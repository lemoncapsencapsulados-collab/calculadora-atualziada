import { describe, expect, it } from 'vitest';
import {
  ALIQUOTA_IMPOSTO, calcularPrecificacaoPorPreco, precoParaMargem,
} from './precificacaoCalculator';

const configuracao = { overhead_unitario: 3 } as any;
const semIndiretos = { maoObraDireta: 0, energia: 0, depreciacao: 0, administrativo: 0 };

/** Margem que sai de um preço, pelo mesmo caminho que a tela usa. */
function margemDoPreco(custoMp: number, custoEmb: number, preco: number): number {
  return calcularPrecificacaoPorPreco(
    { custoMateriaPrima: custoMp, custoEmbalagem: custoEmb },
    semIndiretos,
    preco,
    configuracao,
  ).margemLucroPercentual;
}

describe('preço que preserva a margem', () => {
  it('devolve um preço que recalcula exatamente na margem pedida', () => {
    // Custo de produção = 10 MP + 2 embalagem + 3 overhead = 15.
    const preco = precoParaMargem(15, 30)!;
    expect(margemDoPreco(10, 2, preco)).toBeCloseTo(30, 1);
  });

  it('funciona em várias margens', () => {
    [10, 22.3, 40, 50].forEach((alvo) => {
      const preco = precoParaMargem(15, alvo)!;
      expect(margemDoPreco(10, 2, preco)).toBeCloseTo(alvo, 1);
    });
  });

  it('encarecer a matéria-prima sobe o preço para segurar a margem', () => {
    const antes = precoParaMargem(15, 30)!;
    const depois = precoParaMargem(20, 30)!;
    expect(depois).toBeGreaterThan(antes);
    // E a margem continua a mesma, que é o ponto da sugestão.
    expect(margemDoPreco(15, 2, depois)).toBeCloseTo(30, 1);
  });

  it('baratear a matéria-prima baixa o preço', () => {
    expect(precoParaMargem(10, 30)!).toBeLessThan(precoParaMargem(15, 30)!);
  });

  it('recusa margem inalcançável', () => {
    // Acima de (1 - alíquota) não existe preço finito que satisfaça.
    const limite = (1 - ALIQUOTA_IMPOSTO) * 100;
    expect(precoParaMargem(15, limite)).toBeNull();
    expect(precoParaMargem(15, limite + 5)).toBeNull();
  });

  it('recusa custo inválido', () => {
    expect(precoParaMargem(0, 30)).toBeNull();
    expect(precoParaMargem(-5, 30)).toBeNull();
    expect(precoParaMargem(NaN, 30)).toBeNull();
  });
});
