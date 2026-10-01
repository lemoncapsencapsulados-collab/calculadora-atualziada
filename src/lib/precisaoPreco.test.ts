import { describe, expect, it } from 'vitest';
import { arredondarCusto } from './utils';
import { calcularCustoInsumo, formatarPrecoCompra } from './unitConversion';
import type { FormulaItem, Insumo } from '@/types/formula';

/** `Intl` usa espaço não separável entre "R$" e o número. */
const normalizar = (s: string) => s.replace(/\u00a0/g, ' ');

const insumo = (p: Partial<Insumo>): Insumo => ({
  id: 'i1',
  nome: 'Insumo',
  unidade_compra: 'kg',
  preco_por_unidade_compra: 1000,
  ...p,
});

const item = (qtd: number, unidade: FormulaItem['unidade_informada']): FormulaItem => ({
  insumo_id: 'i1',
  nome_insumo_snapshot: 'Insumo',
  qtd_informada: qtd,
  unidade_informada: unidade,
  custo_calculado: 0,
});

describe('custo não arredonda para zero', () => {
  it('vitamina micro-dosada continua custando alguma coisa', () => {
    // 45 mcg de um insumo de R$ 2.000/kg: R$ 0,00009 por dose. Com duas casas
    // isso vira zero, e a fórmula inteira passa a parecer de graça.
    const custo = calcularCustoInsumo(item(45, 'mcg'), insumo({ preco_por_unidade_compra: 2000 }));
    expect(custo).toBeGreaterThan(0);
    expect(arredondarCusto(custo)).toBeGreaterThan(0);
    expect(arredondarCusto(custo)).toBeCloseTo(0.00009, 10);
  });

  it('guarda dez casas, não seis', () => {
    // Era `toFixed(6)`: tudo abaixo da sexta casa virava zero na gravação.
    expect(arredondarCusto(0.00000000012345)).toBe(0.0000000001);
    expect(arredondarCusto(0.0000000000004)).toBe(0);
  });

  it('o preço real do insumo sobrevive à conta', () => {
    // Colina Bitartarato a R$ 64,163802/kg, 275 mg por dose.
    const custo = calcularCustoInsumo(
      item(275, 'mg'),
      insumo({ preco_por_unidade_compra: 64.163802 }),
    );
    expect(arredondarCusto(custo)).toBeCloseTo(0.0176450456, 10);
  });

  it('com seis casas o custo virava ZERO; com dez, não', () => {
    // 0,5 mcg de um insumo de R$ 150/kg: R$ 0,000000075 por dose. Seis casas
    // arredondam para zero e o insumo some do custo; dez o preservam.
    const porDose = calcularCustoInsumo(
      item(0.5, 'mcg'),
      insumo({ preco_por_unidade_compra: 150 }),
    );
    expect(Number(porDose.toFixed(6))).toBe(0);
    expect(arredondarCusto(porDose)).toBeGreaterThan(0);
  });

  it('o que se perde por dose vira dinheiro no pedido', () => {
    // Pouco por dose; multiplicado pelas doses do pote e pelos potes, não.
    const porDose = calcularCustoInsumo(
      item(5, 'mg'),
      insumo({ preco_por_unidade_compra: 64.163802 }),
    );
    const perdaPorDose = Math.abs(arredondarCusto(porDose) - Number(porDose.toFixed(6)));
    expect(perdaPorDose).toBeGreaterThan(0);
    const doses = 30 * 500; // 30 doses no pote, 500 potes no pedido
    expect(perdaPorDose * doses).toBeGreaterThan(0.001);
  });
});

describe('preço de compra na tela', () => {
  it('mostra as casas que o cadastro tem', () => {
    // Era "R$ 64,16": impossível conferir contra o cadastro.
    expect(formatarPrecoCompra(64.163802)).toContain('64,163802');
  });

  it('não enche de zero o preço redondo', () => {
    expect(normalizar(formatarPrecoCompra(5.2))).toBe('R$ 5,20');
    expect(normalizar(formatarPrecoCompra(12))).toBe('R$ 12,00');
  });

  it('nunca mostra menos de duas casas', () => {
    expect(normalizar(formatarPrecoCompra(0.5))).toBe('R$ 0,50');
  });

  it('mostra o preço minúsculo em vez de zero', () => {
    expect(formatarPrecoCompra(0.0000012)).toContain('0,0000012');
  });

  it('valor inválido não quebra a tela', () => {
    expect(normalizar(formatarPrecoCompra(NaN))).toBe('R$ 0,00');
    expect(normalizar(formatarPrecoCompra(Infinity))).toBe('R$ 0,00');
  });
});
