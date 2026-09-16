import { describe, it, expect } from 'vitest';
import { janelas, iso, somarDias, DIAS_POR_JANELA } from './metaJanelas.ts';

describe('somarDias', () => {
  it('anda para frente e para trás', () => {
    expect(iso(somarDias(new Date('2026-08-10T00:00:00Z'), 5))).toBe('2026-08-15');
    expect(iso(somarDias(new Date('2026-08-10T00:00:00Z'), -5))).toBe('2026-08-05');
  });

  it('atravessa virada de mês', () => {
    expect(iso(somarDias(new Date('2026-08-31T00:00:00Z'), 1))).toBe('2026-09-01');
  });
});

describe('janelas', () => {
  it('vai da mais recente para a mais antiga', () => {
    const f = janelas('2026-08-01', '2026-08-31');
    expect(f[0].fim).toBe('2026-08-31');
    expect(f[f.length - 1].inicio).toBe('2026-08-01');
  });

  it('cada fatia tem no máximo o tamanho da janela', () => {
    for (const f of janelas('2026-08-01', '2026-08-31')) {
      const dias =
        (Date.parse(`${f.fim}T00:00:00Z`) - Date.parse(`${f.inicio}T00:00:00Z`)) / 86_400_000 + 1;
      expect(dias).toBeGreaterThan(0);
      expect(dias).toBeLessThanOrEqual(DIAS_POR_JANELA);
    }
  });

  // O erro que este teste existe para pegar: uma lacuna de um dia entre fatias
  // deixaria um buraco permanente na tabela, invisível até alguém somar o mês e
  // comparar com o Gerenciador.
  it('cobre o intervalo inteiro sem lacuna e sem sobreposição', () => {
    const f = janelas('2026-06-15', '2026-08-31').slice().reverse();
    expect(f[0].inicio).toBe('2026-06-15');
    expect(f[f.length - 1].fim).toBe('2026-08-31');
    for (let i = 1; i < f.length; i++) {
      const anterior = Date.parse(`${f[i - 1].fim}T00:00:00Z`);
      const atual = Date.parse(`${f[i].inicio}T00:00:00Z`);
      expect(atual - anterior).toBe(86_400_000);
    }
  });

  it('não passa do início pedido ao fatiar intervalo que não é múltiplo da janela', () => {
    const f = janelas('2026-08-28', '2026-08-31');
    expect(f).toHaveLength(1);
    expect(f[0]).toEqual({ inicio: '2026-08-28', fim: '2026-08-31' });
  });

  it('um único dia gera uma fatia de um dia', () => {
    expect(janelas('2026-08-31', '2026-08-31')).toEqual([
      { inicio: '2026-08-31', fim: '2026-08-31' },
    ]);
  });

  it('intervalo invertido não gera fatia, em vez de laço infinito', () => {
    expect(janelas('2026-09-10', '2026-09-01')).toEqual([]);
  });
});
