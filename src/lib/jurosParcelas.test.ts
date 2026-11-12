import { describe, expect, it } from 'vitest';
import {
  calcularComJuros,
  jurosDoCartaoPercentual,
  jurosPadraoPercentual,
  JUROS_PADRAO,
  rotuloJurosCurto,
  rotuloJurosExtenso,
  taxaDoCartao,
} from './jurosParcelas';
import { formatarCondicoesParaContrato } from './formatarPagamento';

describe('a tabela em vigor', () => {
  it('3x tem 5% de juros', () => {
    expect(jurosPadraoPercentual(3)).toBe(5);
  });

  it('1x e 2x continuam sem juros', () => {
    expect(jurosPadraoPercentual(1)).toBe(0);
    expect(jurosPadraoPercentual(2)).toBe(0);
  });

  it('4x, 5x e 6x não mudaram', () => {
    expect(JUROS_PADRAO[4]).toBe(7);
    expect(JUROS_PADRAO[5]).toBe(8);
    expect(JUROS_PADRAO[6]).toBe(9);
  });

  it('parcelamento fora da tabela não inventa juros', () => {
    expect(jurosPadraoPercentual(12)).toBe(0);
  });
});

describe('a taxa que vale para cada cartão', () => {
  it('a gravada vence a tabela', () => {
    expect(taxaDoCartao({ parcelas: 3, juros_percentual: 12 })).toBeCloseTo(0.12);
  });

  it('zero gravado é zero, e não "use o padrão"', () => {
    // O caso que `||` quebraria: alguém tirou os juros de propósito, e a
    // tabela os devolveria no próximo carregamento da tela.
    expect(taxaDoCartao({ parcelas: 3, juros_percentual: 0 })).toBe(0);
  });

  it('cartão gravado antes disso mantém o que foi combinado', () => {
    // Pedido fechado em 3x sem juros não pode virar 3x com 5% porque a
    // tabela mudou: o cliente assinou um total, e a previsão de recebimento
    // e a comissão saem dele.
    expect(taxaDoCartao({ parcelas: 3 })).toBe(0);
    expect(taxaDoCartao({ parcelas: 4 })).toBeCloseTo(0.07);
  });

  it('em percentual, para a tela escrever', () => {
    expect(jurosDoCartaoPercentual({ parcelas: 3, juros_percentual: 5 })).toBe(5);
  });
});

describe('a conta do cartão', () => {
  it('3x de 3.000 com 5% dá 1.050 por parcela', () => {
    const r = calcularComJuros(3000, { parcelas: 3, juros_percentual: 5 });
    expect(r.totalComJuros).toBeCloseTo(3150);
    expect(r.valorParcela).toBeCloseTo(1050);
    expect(r.acrescimo).toBeCloseTo(150);
  });

  it('sem juros, a parcela é a divisão pura', () => {
    const r = calcularComJuros(3000, { parcelas: 2, juros_percentual: 0 });
    expect(r.totalComJuros).toBe(3000);
    expect(r.valorParcela).toBe(1500);
    expect(r.acrescimo).toBe(0);
  });

  it('não divide por zero com parcelamento inválido', () => {
    expect(Number.isFinite(calcularComJuros(100, { parcelas: 0 }).valorParcela)).toBe(true);
  });
});

describe('os rótulos', () => {
  it('curto e extenso falam a mesma taxa', () => {
    expect(rotuloJurosCurto(0.05)).toBe(' (+5%)');
    expect(rotuloJurosExtenso(0.05)).toBe(' (juros de 5%)');
    expect(rotuloJurosCurto(0)).toBe(' (s/ juros)');
    expect(rotuloJurosExtenso(0)).toBe(' (sem juros)');
  });
});

describe('a taxa chega ao documento', () => {
  it('o texto do contrato traz os 5% do cartão em 3x', () => {
    // O ponto de ter uma fonte só: o que a tela mostra e o que o papel diz
    // saem da mesma conta.
    const texto = formatarCondicoesParaContrato(
      {
        metodo_principal: 'cartao_credito',
        cartoes: [{ tipo_valor: 'fixo', valor: 3000, parcelas: 3, juros_percentual: 5 }],
      },
      3000,
    );
    expect(texto).toContain('juros de 5%');
    expect(texto).toContain('1.050,00');
  });

  it('cartão antigo em 3x continua sem juros no papel', () => {
    const texto = formatarCondicoesParaContrato(
      {
        metodo_principal: 'cartao_credito',
        cartoes: [{ tipo_valor: 'fixo', valor: 3000, parcelas: 3 }],
      },
      3000,
    );
    expect(texto).toContain('sem juros');
  });
});
