import { describe, expect, it } from 'vitest';
import {
  baseDoNumero, montarNumeroCliente, numeroAoPagar, numeroContratoDoMes, parseNumeroCliente,
} from './numeroOrcamentoCliente';

describe('número de contrato (ano + mês)', () => {
  it('usa os dois últimos dígitos do ano e o mês com zero à esquerda', () => {
    expect(numeroContratoDoMes(new Date(2026, 8, 14))).toBe('2609');
  });

  it('janeiro vira 01, não 1', () => {
    expect(numeroContratoDoMes(new Date(2027, 0, 3))).toBe('2701');
  });

  it('dezembro fecha o ano corretamente', () => {
    expect(numeroContratoDoMes(new Date(2026, 11, 31))).toBe('2612');
  });
});

describe('base do número', () => {
  it('tira o prefixo ORC', () => {
    expect(baseDoNumero('ORC-400')).toBe('400');
  });

  it('ignora o sufixo do cliente', () => {
    expect(baseDoNumero('400-02')).toBe('400');
    expect(baseDoNumero('ORC-400-02')).toBe('400');
  });
});

describe('montagem do número por cliente', () => {
  it('o primeiro pago fica só com a base', () => {
    expect(montarNumeroCliente('ORC-400', 0)).toBe('400');
  });

  it('os seguintes ganham sufixo de dois dígitos', () => {
    expect(montarNumeroCliente('400', 1)).toBe('400-01');
    expect(montarNumeroCliente('400', 2)).toBe('400-02');
    expect(montarNumeroCliente('400', 10)).toBe('400-10');
  });

  it('ida e volta pelo parse', () => {
    expect(parseNumeroCliente('400-02')).toEqual({ base: '400', posicao: 2 });
    expect(parseNumeroCliente('400')).toEqual({ base: '400', posicao: 0 });
    expect(parseNumeroCliente('ORC-409')).toEqual({ base: '409', posicao: 0 });
  });
});

describe('número atribuído ao pagar', () => {
  it('o primeiro pagamento do cliente vira a base', () => {
    expect(numeroAoPagar('ORC-400', [])).toBe('400');
  });

  it('o segundo pago pendura -01 na base do primeiro', () => {
    const anteriores = [{ numero_orcamento: '400', data_pagamento: '2026-01-10' }];
    // Repare: o número global deste orçamento é 409, mas ele entra como 400-01.
    expect(numeroAoPagar('ORC-409', anteriores)).toBe('400-01');
  });

  it('a base vem do pagamento mais antigo, não da ordem do array', () => {
    const anteriores = [
      { numero_orcamento: '400-01', data_pagamento: '2026-05-01' },
      { numero_orcamento: '400', data_pagamento: '2026-01-01' },
    ];
    expect(numeroAoPagar('ORC-420', anteriores)).toBe('400-02');
  });

  it('o sufixo de um anterior nunca vira base', () => {
    // Se pegasse "400-01" inteiro como base, sairia "400-01-02".
    const anteriores = [
      { numero_orcamento: '400', data_pagamento: '2026-01-01' },
      { numero_orcamento: '400-01', data_pagamento: '2026-02-01' },
    ];
    expect(numeroAoPagar('ORC-430', anteriores)).toBe('400-02');
  });

  it('orçamentos não pagos não ocupam posição', () => {
    // 10 gerados, 2 pagos antes: o terceiro pago é 400-02, não 400-09.
    const anteriores = [
      { numero_orcamento: '400', data_pagamento: '2026-01-01' },
      { numero_orcamento: '400-01', data_pagamento: '2026-03-01' },
    ];
    expect(numeroAoPagar('ORC-455', anteriores)).toBe('400-02');
  });

  it('cai para created_at quando não há data de pagamento', () => {
    const anteriores = [
      { numero_orcamento: '500', created_at: '2026-01-01' },
      { numero_orcamento: '500-01', created_at: '2026-02-01' },
    ];
    expect(numeroAoPagar('ORC-460', anteriores)).toBe('500-02');
  });
});
