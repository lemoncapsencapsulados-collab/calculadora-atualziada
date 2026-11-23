import { describe, expect, it } from 'vitest';
import {
  categoriaDoTipo,
  compararComProximoDegrau,
  escadaDoProduto,
  FAIXAS_VOLUME,
  indiceDaFaixa,
  precoDaFaixa,
  tabelaCemPotes,
  temEscada,
  tetoCentavo,
} from './escadaVolume';

/**
 * Gabarito tirado da planilha "Escada de Preços por Volume · White Label
 * Lemon Caps", aba "Preços por faixa". São os preços que o comercial já
 * aprovou -- se a regra mudar, é aqui que se vê.
 */
const PLANILHA: [string, string, number, number[]][] = [
  ['ARTIFLEX', 'Encapsulados', 9.8, [11.53, 9.8, 9.69, 9.52, 9.34, 9.23]],
  ['BIOPRINCESS', 'Encapsulados', 15.86, [18.66, 15.86, 15.68, 15.4, 15.12, 14.93]],
  ['B-DOZE', 'Encapsulados', 8.04, [9.46, 8.04, 7.95, 7.81, 7.67, 7.57]],
  ['CAFEÍNA', 'Encapsulados', 8.54, [10.05, 8.54, 8.45, 8.3, 8.15, 8.04]],
  ['MAG + INOSITOL', 'Encapsulados', 11.9, [14, 11.9, 11.76, 11.55, 11.34, 11.2]],
  ['MORO COMPLEX GOTAS', 'Líquido', 11.52, [13.56, 11.52, 11.46, 11.4, 11.29, 11.19]],
  ['SERENA', 'Líquido', 9.48, [11.16, 9.48, 9.44, 9.38, 9.3, 9.21]],
  ['CREATINA MONOHIDRATADA', 'Solúvel', 23.69, [27.88, 23.69, 23.49, 23.28, 23.08, 22.87]],
  ['PRÉ-TREINO', 'Solúvel', 56.87, [66.91, 56.87, 56.38, 55.87, 55.37, 54.87]],
  ['SHOT MATINAL', 'Solúvel', 28.04, [32.99, 28.04, 27.8, 27.55, 27.3, 27.06]],
];

describe('a escada reproduz a planilha', () => {
  it.each(PLANILHA)('%s', (_nome, tipo, preco, esperados) => {
    esperados.forEach((esperado, i) => {
      expect(precoDaFaixa(preco, tipo, i)).toBe(esperado);
    });
  });

  it('a faixa do catálogo é o preço gravado, sem recalcular', () => {
    // Recalcular a partir da tabela de 100 empilha dois arredondamentos para
    // cima e o produto sai um centavo acima do preço que foi combinado.
    for (const [, tipo, preco] of PLANILHA) {
      expect(precoDaFaixa(preco, tipo, 1)).toBe(preco);
    }
  });

  it('a tabela de 100 potes é o preço do catálogo sobre 0,85', () => {
    expect(tabelaCemPotes(9.8)).toBe(11.53);
    expect(tabelaCemPotes(8.04)).toBe(9.46);
  });
});

describe('arredondamento para cima no centavo', () => {
  it('não sobe um centavo por erro de ponto flutuante', () => {
    // 9,46 x 100 da' 946.0000000000001 em ponto flutuante. Sem a correcao,
    // cinco dos 180 precos da planilha saíam um centavo acima.
    expect(tetoCentavo(9.46)).toBe(9.46);
    expect(tetoCentavo(8.04)).toBe(8.04);
    expect(tetoCentavo(11.53)).toBe(11.53);
  });

  it('sobe de verdade quando sobra fração', () => {
    expect(tetoCentavo(9.4601)).toBe(9.47);
    expect(tetoCentavo(9.458823529)).toBe(9.46);
  });
});

describe('gomas ficam fora da escada', () => {
  it('preço único em todas as faixas', () => {
    expect(temEscada('Gummy')).toBe(false);
    for (let i = 0; i < 6; i++) {
      expect(precoDaFaixa(19.5, 'Gummy', i)).toBe(19.5);
    }
  });

  it('e não tem degrau para comparar', () => {
    expect(compararComProximoDegrau(100, 19.5, 'Gummy')).toBeNull();
  });
});

describe('em que faixa cai a quantidade', () => {
  it('nos limites de cada degrau', () => {
    expect(indiceDaFaixa(100)).toBe(0);
    expect(indiceDaFaixa(299)).toBe(0);
    expect(indiceDaFaixa(300)).toBe(1);
    expect(indiceDaFaixa(499)).toBe(1);
    expect(indiceDaFaixa(500)).toBe(2);
    expect(indiceDaFaixa(1000)).toBe(3);
    expect(indiceDaFaixa(2500)).toBe(4);
    expect(indiceDaFaixa(5000)).toBe(5);
    expect(indiceDaFaixa(999999)).toBe(5);
  });

  it('abaixo do mínimo vale a faixa de entrada', () => {
    // O mínimo da fábrica é 100 por SKU; quem digita menos ainda paga a
    // tabela de entrada, e não um preço inventado.
    expect(indiceDaFaixa(30)).toBe(0);
    expect(indiceDaFaixa(0)).toBe(0);
  });
});

describe('a categoria vem do tipo que a calculadora grava', () => {
  it('traduz os quatro tipos', () => {
    expect(categoriaDoTipo('Encapsulados')).toBe('Encapsulados');
    expect(categoriaDoTipo('Líquido')).toBe('Líquidos');
    expect(categoriaDoTipo('Solúvel')).toBe('Solúveis');
    expect(categoriaDoTipo('Gummy')).toBe('Gummies');
  });

  it('não depende de acento nem de caixa', () => {
    expect(categoriaDoTipo('liquido')).toBe('Líquidos');
    expect(categoriaDoTipo('SOLUVEL')).toBe('Solúveis');
  });

  it('tipo desconhecido cai em encapsulados', () => {
    expect(categoriaDoTipo(null)).toBe('Encapsulados');
    expect(categoriaDoTipo('qualquer coisa')).toBe('Encapsulados');
  });
});

describe('a escada inteira de um produto', () => {
  const escada = escadaDoProduto(10.92, 'Encapsulados', 8.406216);

  it('tem os seis degraus, do mais caro ao mais barato', () => {
    expect(escada).toHaveLength(6);
    const precos = escada.map((d) => d.precoPote);
    expect(precos).toEqual([...precos].sort((a, b) => b - a));
  });

  it('calcula a margem de cada degrau', () => {
    // Planilha: ATENTO COLINA vai de 34,58% em 100 potes a 18,23% em 5.000.
    expect(escada[0].margemPercentual).toBeCloseTo(34.58, 1);
    expect(escada[5].margemPercentual).toBeCloseTo(18.23, 1);
  });

  it('nenhum degrau estoura os limites da categoria', () => {
    expect(escada.some((d) => d.foraDaFaixaDeMargem)).toBe(false);
  });

  it('sem custo, mostra preço e omite margem', () => {
    const semCusto = escadaDoProduto(10.92, 'Encapsulados');
    expect(semCusto[0].precoPote).toBe(12.85);
    expect(semCusto[0].margemPercentual).toBeNull();
  });
});

describe('a conta do próximo degrau', () => {
  // ATENTO COLINA: 100 potes a 12,85; 300 potes a 10,92.
  const c = compararComProximoDegrau(100, 10.92, 'Encapsulados')!;

  it('sabe que está abaixo do preço de catálogo', () => {
    expect(c.abaixoDoCatalogo).toBe(true);
    expect(c.precoAtual).toBe(12.85);
    expect(c.precoProximo).toBe(10.92);
  });

  it('mostra o que ele perde no volume que já está levando', () => {
    // 100 potes pagando R$ 1,93 a mais em cada um.
    expect(c.quedaPorPote).toBeCloseTo(1.93, 2);
    expect(c.perdaNoVolumeAtual).toBeCloseTo(193, 2);
  });

  it('mostra quanto custa subir e o que vem junto', () => {
    expect(c.totalAtual).toBeCloseTo(1285, 2);
    expect(c.totalProximo).toBeCloseTo(3276, 2);
    expect(c.desembolsoExtra).toBeCloseTo(1991, 2);
    expect(c.potesExtras).toBe(200);
  });

  it('mostra a economia no volume da faixa de cima', () => {
    // 300 potes custariam 3.855 na faixa de entrada e saem por 3.276.
    expect(c.totalProximoAoPrecoAtual).toBeCloseTo(3855, 2);
    expect(c.economiaNoProximoVolume).toBeCloseTo(579, 2);
  });

  it('o desconto bate com a planilha', () => {
    expect(c.quedaPercentual).toBeCloseTo(15.02, 1);
  });
});

describe('o gancho existe em todos os degraus, não só abaixo de 300', () => {
  it.each([
    [100, 300],
    [300, 500],
    [500, 1000],
    [1000, 2500],
    [2500, 5000],
  ])('de %i potes aponta para %i', (potes, esperado) => {
    const c = compararComProximoDegrau(potes, 10.92, 'Encapsulados')!;
    expect(c.potesProximo).toBe(esperado);
    expect(c.quedaPorPote).toBeGreaterThan(0);
  });

  it('só abaixo de 300 é "está perdendo dinheiro"', () => {
    expect(compararComProximoDegrau(299, 10.92, 'Encapsulados')!.abaixoDoCatalogo).toBe(true);
    expect(compararComProximoDegrau(300, 10.92, 'Encapsulados')!.abaixoDoCatalogo).toBe(false);
  });

  it('na última faixa não há degrau acima', () => {
    expect(compararComProximoDegrau(5000, 10.92, 'Encapsulados')).toBeNull();
    expect(compararComProximoDegrau(90000, 10.92, 'Encapsulados')).toBeNull();
  });

  it('sem quantidade não inventa comparação', () => {
    expect(compararComProximoDegrau(0, 10.92, 'Encapsulados')).toBeNull();
  });
});

describe('a faixa é por SKU, e as faixas cobrem a reta toda', () => {
  it('não há buraco entre um degrau e o seguinte', () => {
    for (let i = 0; i < FAIXAS_VOLUME.length - 1; i++) {
      expect(FAIXAS_VOLUME[i].ate! + 1).toBe(FAIXAS_VOLUME[i + 1].de);
    }
    expect(FAIXAS_VOLUME[FAIXAS_VOLUME.length - 1].ate).toBeNull();
  });
});
