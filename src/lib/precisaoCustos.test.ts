import { describe, expect, it } from 'vitest';
import { calcularPrecificacaoPorPreco } from './precificacaoCalculator';
import { calcularCustoInsumo } from './unitConversion';
import type { FormulaItem, Insumo } from '@/types/formula';

const configuracao = { overhead_unitario: 3 } as any;
const semIndiretos = { maoObraDireta: 0, energia: 0, depreciacao: 0, administrativo: 0 };

/**
 * Micronutrientes custam frações de centavo por dose: vitamina D3 a R$ 900/kg
 * numa dose de 50 mcg dá R$ 0,000045. Arredondar isso para 2 casas zera o
 * custo — foi o que aconteceu com as fórmulas "d3" e "DRENAGEM LINFÁTICA".
 */
const vitaminaD3: Insumo = {
  id: 'd3',
  nome: 'Vitamina D3',
  unidade_compra: 'kg',
  preco_por_unidade_compra: 900,
} as Insumo;

const item = (qtd: number, unidade: FormulaItem['unidade_informada']): FormulaItem => ({
  insumo_id: 'd3',
  nome_insumo_snapshot: 'Vitamina D3',
  qtd_informada: qtd,
  unidade_informada: unidade,
  custo_calculado: 0,
});

describe('custo de insumo em dose micro', () => {
  it('não zera o custo de uma dose em microgramas', () => {
    const custo = calcularCustoInsumo(item(50, 'mcg'), vitaminaD3);
    expect(custo).toBeGreaterThan(0);
    expect(custo).toBeCloseTo(0.000045, 9);
  });

  it('mantém proporção entre doses minúsculas', () => {
    const umaDose = calcularCustoInsumo(item(50, 'mcg'), vitaminaD3);
    const dezDoses = calcularCustoInsumo(item(500, 'mcg'), vitaminaD3);
    expect(dezDoses / umaDose).toBeCloseTo(10, 6);
  });
});

describe('precificação preserva custo abaixo de um centavo', () => {
  it('não zera a matéria-prima de uma fórmula inteiramente micro-dosada', () => {
    // Caso real: fórmula "DRENAGEM LINFÁTICA", 10 insumos somando R$ 0,00317.
    const r = calcularPrecificacaoPorPreco(
      { custoMateriaPrima: 0.0031699794, custoEmbalagem: 0 },
      semIndiretos,
      10,
      configuracao,
    );
    expect(r.custoMateriaPrima).toBeGreaterThan(0);
  });

  it('o custo de produção soma a matéria-prima, por menor que seja', () => {
    const comMp = calcularPrecificacaoPorPreco(
      { custoMateriaPrima: 0.004, custoEmbalagem: 1 },
      semIndiretos,
      10,
      configuracao,
    );
    const semMp = calcularPrecificacaoPorPreco(
      { custoMateriaPrima: 0, custoEmbalagem: 1 },
      semIndiretos,
      10,
      configuracao,
    );
    // Se o arredondamento engolir os 0,004, os dois totais ficam iguais.
    expect(comMp.totalCustosProducao).toBeGreaterThan(semMp.totalCustosProducao);
  });

  it('cabe na precisão de 6 casas da coluna do banco', () => {
    const r = calcularPrecificacaoPorPreco(
      { custoMateriaPrima: 0.0031699794, custoEmbalagem: 0 },
      semIndiretos,
      10,
      configuracao,
    );
    // Arredondado para 6 casas continua diferente de zero.
    expect(Number(r.custoMateriaPrima.toFixed(6))).toBeGreaterThan(0);
  });

  it('valores normais não são distorcidos', () => {
    const r = calcularPrecificacaoPorPreco(
      { custoMateriaPrima: 6.3712, custoEmbalagem: 1.7649 },
      semIndiretos,
      9.7,
      configuracao,
    );
    // Guardados como vieram; quem arredonda para centavos é a exibição.
    expect(r.custoMateriaPrima).toBeCloseTo(6.3712, 6);
    expect(r.custoEmbalagem).toBeCloseTo(1.7649, 6);
    expect(r.totalCustosProducao).toBeCloseTo(6.3712 + 1.7649 + 3, 6);
  });
});
