import { describe, it, expect } from 'vitest';
import { lerConsumo, deveEsperar, atrasoBackoff, ehErroDeThrottle } from './metaGraph.ts';

describe('lerConsumo', () => {
  it('lê o consumo da conta no cabeçalho de uso', () => {
    const h = new Headers({
      'x-business-use-case-usage': JSON.stringify({
        '123': [{ call_count: 42, total_cputime: 7, total_time: 9 }],
      }),
    });
    expect(lerConsumo(h, 'act_123')).toEqual({ chamadas: 42, cpu: 7, tempo: 9 });
  });

  it('aceita o id da conta sem o prefixo act_', () => {
    const h = new Headers({
      'x-business-use-case-usage': JSON.stringify({
        '123': [{ call_count: 10, total_cputime: 1, total_time: 2 }],
      }),
    });
    expect(lerConsumo(h, '123')?.chamadas).toBe(10);
  });

  it('devolve null quando o cabeçalho não existe', () => {
    expect(lerConsumo(new Headers(), 'act_123')).toBeNull();
  });

  it('devolve null quando o cabeçalho é ilegível, sem derrubar a coleta', () => {
    const h = new Headers({ 'x-business-use-case-usage': 'isto-nao-e-json' });
    expect(lerConsumo(h, 'act_123')).toBeNull();
  });

  it('devolve null quando a conta não aparece no cabeçalho', () => {
    const h = new Headers({
      'x-business-use-case-usage': JSON.stringify({
        '999': [{ call_count: 1, total_cputime: 1, total_time: 1 }],
      }),
    });
    expect(lerConsumo(h, 'act_123')).toBeNull();
  });
});

describe('deveEsperar', () => {
  it('manda esperar quando qualquer eixo passa do limite', () => {
    expect(deveEsperar({ chamadas: 85, cpu: 10, tempo: 10 }, 80)).toBe(true);
    expect(deveEsperar({ chamadas: 10, cpu: 90, tempo: 10 }, 80)).toBe(true);
    expect(deveEsperar({ chamadas: 10, cpu: 10, tempo: 95 }, 80)).toBe(true);
  });

  it('deixa passar abaixo do limite', () => {
    expect(deveEsperar({ chamadas: 40, cpu: 20, tempo: 30 }, 80)).toBe(false);
  });

  // Sem leitura, seguir em frente: inventar bloqueio pararia a coleta por um
  // cabeçalho ausente, que é situação normal em resposta de erro.
  it('sem leitura de consumo, deixa passar', () => {
    expect(deveEsperar(null, 80)).toBe(false);
  });
});

describe('atrasoBackoff', () => {
  it('cresce a cada tentativa', () => {
    expect(atrasoBackoff(3)).toBeGreaterThan(atrasoBackoff(1));
  });

  it('tem teto, para não dormir minutos dentro do orçamento de tempo da função', () => {
    expect(atrasoBackoff(20)).toBeLessThanOrEqual(30_000);
  });

  it('nunca é negativo nem zero', () => {
    expect(atrasoBackoff(0)).toBeGreaterThan(0);
  });
});

describe('ehErroDeThrottle', () => {
  it('reconhece os códigos de limite da Graph', () => {
    expect(ehErroDeThrottle({ code: 17 })).toBe(true);
    expect(ehErroDeThrottle({ code: 4 })).toBe(true);
    expect(ehErroDeThrottle({ code: 613 })).toBe(true);
    expect(ehErroDeThrottle({ code: 80004 })).toBe(true);
  });

  it('não confunde erro comum com throttle', () => {
    expect(ehErroDeThrottle({ code: 100 })).toBe(false);
    expect(ehErroDeThrottle(null)).toBe(false);
  });
});
