import { describe, expect, it } from 'vitest';
import {
  BONUS_MARGEM_VOLUME_TOPO,
  categoriaDoTipo,
  compararComProximoDegrau,
  escadaDoProduto,
  FAIXAS_VOLUME,
  indiceDaFaixa,
  INDICE_FAIXA_CATALOGO,
  INDICE_FAIXA_TOPO,
  limitesDaFaixa,
  LIMITES_MARGEM,
  precoBaseDaFaixa,
  precoDaFaixa,
  tabelaCemPotes,
  tetoCentavo,
} from './escadaVolume';

/**
 * Os 30 produtos do CATÁLOGO 2026 como estão gravados no banco, com o custo
 * de produção por pote. Servem para provar o bônus de volume no dado real:
 * a regra promete dois pontos de margem, e quem decide se ela cumpriu é o
 * custo de cada produto, não um exemplo escolhido a dedo.
 */
const CATALOGO_2026: [string, string, number, number][] = [
  ['ARTIFLEX GLUCOSAMINA + MSM  COMPLEX', 'Encapsulados', 9.8, 6.367943],
  ['ATENTO COLINA', 'Encapsulados', 10.92, 7.095956],
  ['B-DOZE', 'Encapsulados', 8.04, 5.22788],
  ['BIOPRINCESS', 'Encapsulados', 15.86, 10.310474],
  ['CAFEÍNA', 'Encapsulados', 8.54, 5.549894],
  ['CÁLCIO + D3', 'Encapsulados', 11.92, 7.746738],
  ['CÁLCIO + MAGNÉSIO + D3', 'Encapsulados', 11.85, 7.700521],
  ['COENZIMA Q10', 'Encapsulados', 13.38, 8.694639],
  ['COMPLEXO B', 'Encapsulados', 8.12, 5.278048],
  ['DERMA COMPLEX', 'Encapsulados', 11.97, 7.78308],
  ['FOCUS COLINA Q10', 'Encapsulados', 18.07, 11.748417],
  ['LCM COMPLEX', 'Encapsulados', 12.22, 7.943514],
  ['MAG + INOSITOL', 'Encapsulados', 11.9, 7.737395],
  ['MELATON', 'Encapsulados', 8.07, 5.244821],
  ['METABOLIC COMPLEX 30 CÁPSULAS', 'Encapsulados', 9.51, 6.181695],
  ['METABOLIC COMPLEX 60 CÁPSULAS', 'Encapsulados', 10.45, 6.795667],
  ['MSM D3 COMPLEX', 'Encapsulados', 8.87, 5.765738],
  ['MULTIPLUS', 'Encapsulados', 12.12, 7.880727],
  ['MULTIVITAMÍNICO', 'Encapsulados', 9.44, 6.133187],
  ['NAC 750', 'Encapsulados', 12.27, 7.973393],
  ['VITAL COMPLEX', 'Encapsulados', 10.53, 6.846179],
  ['BELLA GUMMY (30 Unidades)', 'Gummy', 19.5, 11.161232],
  ['CREATINA EM GUMMY (30 Unidades)', 'Gummy', 21.4, 12.385],
  ['DREAM GUMMY (30 Unidades)', 'Gummy', 24.9, 14.249656],
  ['MORO COMPLEX GOTAS', 'Líquido', 11.52, 7.775125],
  ['SERENA', 'Líquido', 9.48, 6.402027],
  ['CREATINA MONOHIDRATADA', 'Solúvel', 23.69, 14.924],
  ['PRÉ-TREINO', 'Solúvel', 56.87, 35.82923],
  ['PRÉ-TREINO COM CREATINA', 'Solúvel', 48.12, 30.313973],
  ['SHOT MATINAL', 'Solúvel', 28.04, 17.667557],
];

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
  // O último degrau saiu da planilha em 23/11/2026, quando passou a carregar
  // dois pontos de margem a mais. Os cinco primeiros seguem valendo como o
  // documento os publicou, e é isso que estes casos protegem.
  it.each(PLANILHA)('%s', (_nome, tipo, preco, esperados) => {
    esperados.slice(0, INDICE_FAIXA_TOPO).forEach((esperado, i) => {
      expect(precoBaseDaFaixa(preco, tipo, i)).toBe(esperado);
      expect(precoDaFaixa(preco, tipo, i)).toBe(esperado);
    });
  });

  it('o topo da planilha virou o preço-base do degrau do bônus', () => {
    // A planilha ainda define de onde o bônus parte; ela só não dá mais a
    // palavra final sobre o preço de 5.000.
    for (const [, tipo, preco, esperados] of PLANILHA) {
      expect(precoBaseDaFaixa(preco, tipo, INDICE_FAIXA_TOPO)).toBe(esperados[INDICE_FAIXA_TOPO]);
    }
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

describe('gomas entram na escada só no topo', () => {
  const CUSTO_GOMA = 11.161232; // BELLA GUMMY

  it('preço único até 4.999 potes', () => {
    for (let i = 0; i < INDICE_FAIXA_TOPO; i++) {
      expect(precoDaFaixa(19.5, 'Gummy', i, CUSTO_GOMA)).toBe(19.5);
    }
  });

  it('mas o pedido grande também ganha os dois pontos', () => {
    // Antes a goma era preço único de ponta a ponta: quem fechava 5.000 potes
    // de gummy pagava o mesmo que quem fechava 100.
    const topo = precoDaFaixa(19.5, 'Gummy', INDICE_FAIXA_TOPO, CUSTO_GOMA);
    expect(topo).toBeLessThan(19.5);
    expect(topo).toBe(18.85);
  });

  it('nos degraus de baixo não há degrau para comparar', () => {
    // Prometer economia de R$ 0,00 queimaria o aviso onde ele tem algo real
    // a dizer.
    expect(compararComProximoDegrau(100, 19.5, 'Gummy', CUSTO_GOMA)).toBeNull();
    expect(compararComProximoDegrau(1000, 19.5, 'Gummy', CUSTO_GOMA)).toBeNull();
  });

  it('e de 2.500 em diante o gancho aponta para o bônus', () => {
    const c = compararComProximoDegrau(2500, 19.5, 'Gummy', CUSTO_GOMA)!;
    expect(c.potesProximo).toBe(5000);
    expect(c.proximoTemBonusDeVolume).toBe(true);
    expect(c.quedaPorPote).toBeCloseTo(0.65, 2);
  });
});

describe('o bônus de margem acima de 4.999 potes', () => {
  it.each(CATALOGO_2026)('%s devolve dois pontos de margem', (_nome, tipo, preco, custo) => {
    const base = precoBaseDaFaixa(preco, tipo, INDICE_FAIXA_TOPO);
    const comBonus = precoDaFaixa(preco, tipo, INDICE_FAIXA_TOPO, custo);
    const margemBase = (1 - custo / base) * 100;
    const margemBonus = (1 - custo / comBonus) * 100;
    const queda = margemBase - margemBonus;

    // Nunca mais de dois pontos: o arredondamento do centavo é para cima, e a
    // sobra fica com a fábrica. Nunca menos de 1,90, que é o pior caso do
    // centavo no produto mais barato do catálogo.
    expect(queda).toBeLessThanOrEqual(BONUS_MARGEM_VOLUME_TOPO * 100);
    expect(queda).toBeGreaterThan(1.9);
    expect(comBonus).toBeLessThan(base);
  });

  it('não mexe em nenhum dos cinco degraus de baixo', () => {
    // A mudança é cirúrgica: se um dia ela escorrer para os outros degraus, o
    // catálogo inteiro muda de preço sem ninguém pedir.
    for (const [, tipo, preco, custo] of CATALOGO_2026) {
      for (let i = 0; i < INDICE_FAIXA_TOPO; i++) {
        expect(precoDaFaixa(preco, tipo, i, custo)).toBe(precoBaseDaFaixa(preco, tipo, i));
      }
    }
  });

  it('sem custo, nunca desconta mais do que a regra exata daria', () => {
    // Sem custo não há como honrar os dois pontos. O desconto medido da linha
    // entra como rede, e tem de errar para o lado da fábrica.
    for (const [, tipo, preco, custo] of CATALOGO_2026) {
      const semCusto = precoDaFaixa(preco, tipo, INDICE_FAIXA_TOPO);
      const comCusto = precoDaFaixa(preco, tipo, INDICE_FAIXA_TOPO, custo);
      expect(semCusto).toBeGreaterThanOrEqual(comCusto);
      expect(semCusto / comCusto).toBeLessThan(1.01);
    }
  });

  it('produto sem dois pontos de sobra não recebe o bônus', () => {
    // Custo acima do preço do degrau: aplicar o bônus aqui venderia mais
    // barato um produto que já não fecha. Fica no preço da escada.
    const base = precoBaseDaFaixa(10, 'Encapsulados', INDICE_FAIXA_TOPO);
    expect(precoDaFaixa(10, 'Encapsulados', INDICE_FAIXA_TOPO, 9.99)).toBe(base);
    // E não se confunde com custo desconhecido, que tem desconto próprio.
    expect(precoDaFaixa(10, 'Encapsulados', INDICE_FAIXA_TOPO)).toBeLessThan(base);
  });

  it('o piso de margem do topo é dois pontos mais baixo', () => {
    for (const categoria of ['Encapsulados', 'Líquidos', 'Solúveis', 'Gummies'] as const) {
      const base = LIMITES_MARGEM[categoria];
      expect(limitesDaFaixa(categoria, INDICE_FAIXA_CATALOGO).minima).toBe(base.minima);
      expect(limitesDaFaixa(categoria, INDICE_FAIXA_TOPO).minima).toBe(base.minima - 2);
      // O teto não muda: o bônus só abre espaço para baixo.
      expect(limitesDaFaixa(categoria, INDICE_FAIXA_TOPO).maxima).toBe(base.maxima);
    }
  });

  it('e nenhum produto do catálogo fica fora dos limites por causa dele', () => {
    for (const [nome, tipo, preco, custo] of CATALOGO_2026) {
      const escada = escadaDoProduto(preco, tipo, custo);
      expect(escada[INDICE_FAIXA_TOPO].bonusDeVolume, nome).toBe(true);
      expect(escada[INDICE_FAIXA_TOPO].foraDaFaixaDeMargem, nome).toBe(false);
    }
  });

  it('a coluna de desconto mostra o desconto real do topo, não o da tabela', () => {
    // No topo a constante publicada (20%) deixou de descrever o preço.
    const escada = escadaDoProduto(10.92, 'Encapsulados', 7.095956);
    expect(escada[INDICE_FAIXA_TOPO].descontoPercentual).toBeGreaterThan(20);
    expect(escada[INDICE_FAIXA_TOPO].descontoPercentual).toBeCloseTo(22.18, 1);
    // Os de baixo seguem a constante, para a tela não exibir 14,97% onde o
    // documento diz 15%.
    expect(escada[1].descontoPercentual).toBe(15);
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
    // O 5.000 não é mais os 18,23% da planilha: o bônus de volume desceu dois
    // pontos de propósito. Se este número voltar para 18,23, o bônus sumiu.
    expect(escada[5].margemPercentual).toBeCloseTo(16.27, 1);
    expect(escada[0].margemPercentual! - escada[5].margemPercentual!).toBeGreaterThan(18);
  });

  it('nenhum degrau estoura os limites da faixa', () => {
    // O topo só passa porque o piso dele é dois pontos mais baixo: com o piso
    // antigo (18%) este produto sairia vermelho seguindo a regra nova.
    expect(escada.some((d) => d.foraDaFaixaDeMargem)).toBe(false);
    expect(escada[5].margemPercentual!).toBeLessThan(LIMITES_MARGEM.Encapsulados.minima);
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
