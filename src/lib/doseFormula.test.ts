import { describe, expect, it } from 'vitest';
import {
  CAPACIDADE_CAPSULA_GRAMAS,
  custoMpPorPote,
  emGramas,
  excipienteDaDoseEmGramas,
  gramasDaDose,
  numeroDeDoses,
} from './doseFormula';

describe('número de doses do pote', () => {
  it('60 cápsulas, 2 por dose, dá 30 doses', () => {
    expect(numeroDeDoses(60, 2)).toBe(30);
  });

  it('solúvel: 300.000 mg no pote com 10.000 mg por dose dá 30 doses', () => {
    // A calculadora grava solúvel já convertido para mg, então é a mesma conta.
    expect(numeroDeDoses(300_000, 10_000)).toBe(30);
  });

  it('aceita fração', () => {
    expect(numeroDeDoses(30, 4)).toBe(7.5);
  });

  it('nunca devolve menos de uma dose', () => {
    // Um pote que rende menos que uma dose faria o pote custar menos que a dose.
    expect(numeroDeDoses(1, 2)).toBe(1);
  });

  it('cai para 1 quando o cadastro está incompleto', () => {
    expect(numeroDeDoses(0, 2)).toBe(1);
    expect(numeroDeDoses(60, 0)).toBe(1);
    expect(numeroDeDoses(null, null)).toBe(1);
    expect(numeroDeDoses(undefined, undefined)).toBe(1);
    expect(numeroDeDoses(60, NaN)).toBe(1);
  });
});

describe('custo de matéria-prima do pote', () => {
  it('é o custo da dose multiplicado pelas doses', () => {
    // Era o erro: o "Editar produto" gravava 0,3227 num pote de 30 doses.
    expect(custoMpPorPote(0.3227, 30)).toBeCloseTo(9.681, 4);
  });

  it('não engole centavo em fórmula micro-dosada', () => {
    expect(custoMpPorPote(0.000041, 30)).toBeCloseTo(0.00123, 8);
  });

  it('custo zero continua zero', () => {
    expect(custoMpPorPote(0, 30)).toBe(0);
  });

  it('dose sem número de doses vale uma dose', () => {
    expect(custoMpPorPote(5, 0)).toBe(5);
    expect(custoMpPorPote(5, NaN)).toBe(5);
  });
});

describe('conversão para gramas', () => {
  it('converte as unidades de peso', () => {
    expect(emGramas(1, 'kg')).toBe(1000);
    expect(emGramas(2.5, 'g')).toBe(2.5);
    expect(emGramas(500, 'mg')).toBe(0.5);
    expect(emGramas(45, 'mcg')).toBeCloseTo(0.000045, 9);
  });

  it('volume e UI não viram peso', () => {
    // Sem densidade não dá para afirmar; contar como zero é o honesto.
    expect(emGramas(30, 'mL')).toBe(0);
    expect(emGramas(1, 'L')).toBe(0);
    expect(emGramas(400, 'UI')).toBe(0);
    expect(emGramas(2, 'unidade')).toBe(0);
  });

  it('soma o peso da dose inteira', () => {
    expect(
      gramasDaDose([
        { quantidade: 500, unidade: 'mg' },
        { quantidade: 0.2, unidade: 'g' },
        { quantidade: 30, unidade: 'mL' },
      ]),
    ).toBeCloseTo(0.7, 6);
  });
});

describe('excipiente da dose', () => {
  it('completa a cápsula até a capacidade', () => {
    // 2 cápsulas × 0,5 g = 1 g; os insumos ocupam 0,7 g.
    expect(excipienteDaDoseEmGramas('Encapsulados', 2, 0.7)).toBeCloseTo(0.3, 6);
  });

  it('não existe fora de encapsulado', () => {
    for (const tipo of ['Solúvel', 'Gummy', 'Líquido']) {
      expect(excipienteDaDoseEmGramas(tipo, 2, 0.1), tipo).toBe(0);
    }
  });

  it('cápsula cheia não pede excipiente', () => {
    expect(excipienteDaDoseEmGramas('Encapsulados', 2, 1)).toBe(0);
  });

  it('cápsula estourada não devolve negativo', () => {
    // Negativo viraria desconto no custo -- a tela é que avisa do excesso.
    expect(excipienteDaDoseEmGramas('Encapsulados', 2, 1.4)).toBe(0);
  });

  it('a capacidade da cápsula é 0,5 g', () => {
    expect(CAPACIDADE_CAPSULA_GRAMAS).toBe(0.5);
    expect(excipienteDaDoseEmGramas('Encapsulados', 1, 0)).toBe(0.5);
  });
});
