import { describe, expect, it } from 'vitest';
import { FONTE, VERDE_CLARO, VERDE_ESCURO, VERDE_VIVO } from './pedidoCompraPdf';

/**
 * A paleta foi tirada pixel a pixel do modelo impresso do Pedido de Compra
 * (Pedido_de_Compra_TRULY). Se alguém "melhorar" um destes verdes, o documento
 * para de bater com o que o cliente já recebeu -- e ninguém percebe, porque
 * continua bonito. Daí os valores estarem fixados aqui.
 */
describe('paleta do Pedido de Compra', () => {
  it('verde vivo das barras é o #7CB518 do modelo', () => {
    expect(VERDE_VIVO).toEqual([124, 181, 24]);
  });

  it('verde escuro dos títulos é o #4E7A0E do modelo', () => {
    expect(VERDE_ESCURO).toEqual([78, 122, 14]);
  });

  it('verde claro da zebra é o #F1F7E2 do modelo', () => {
    expect(VERDE_CLARO).toEqual([241, 247, 226]);
  });

  it('o documento é serifado, como o modelo', () => {
    expect(FONTE).toBe('times');
  });

  it('os três verdes são distintos e vão do claro ao escuro', () => {
    const luminancia = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(luminancia(VERDE_CLARO)).toBeGreaterThan(luminancia(VERDE_VIVO));
    expect(luminancia(VERDE_VIVO)).toBeGreaterThan(luminancia(VERDE_ESCURO));
  });

  it('o verde das barras é bem mais escuro que a zebra', () => {
    // A falha real aqui não é estética: trocar o verde da barra pelo tom claro
    // deixa texto branco sobre fundo quase branco, e a barra some.
    const luminancia = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(luminancia(VERDE_CLARO) - luminancia(VERDE_VIVO)).toBeGreaterThan(80);
  });

  it('o branco sobre a barra fica em 2,48:1 — a escolha do modelo', () => {
    // Abaixo dos 3:1 da WCAG para texto grande. É assim no modelo impresso, com
    // serifada em negrito, e o documento é feito para papel e PDF, não para
    // leitor de tela. Fica registrado para a decisão ser deliberada se alguém
    // for revisar acessibilidade -- não é descuido.
    const canal = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: number[]) =>
      0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    const contraste = 1.05 / (lum(VERDE_VIVO) + 0.05);
    expect(contraste).toBeCloseTo(2.48, 1);
  });
});
