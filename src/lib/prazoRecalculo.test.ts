import { describe, expect, it } from 'vitest';
import {
  PRAZO_RECALCULO_DIAS,
  avisoPrazo,
  situacaoPrazo,
  tomDoPrazo,
} from './prazoRecalculo';

const dia = (d: number, h = 12) => new Date(2026, 8, d, h, 0, 0);

describe('janela de 5 dias', () => {
  it('o prazo combinado é de 5 dias corridos', () => {
    expect(PRAZO_RECALCULO_DIAS).toBe(5);
  });

  it('no dia da criação restam os 5 dias', () => {
    const s = situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(10));
    expect(s.diasRestantes).toBe(5);
    expect(s.vencido).toBe(false);
  });

  it('conta por data virada, não por 24 horas', () => {
    // Feito às 23h de segunda vence junto com o feito às 8h da mesma segunda:
    // é assim que o consultor conta ao falar com o cliente.
    const tarde = situacaoPrazo({ status: 'criado', criadoEm: dia(10, 23) }, dia(13, 8));
    const cedo = situacaoPrazo({ status: 'criado', criadoEm: dia(10, 8) }, dia(13, 8));
    expect(tarde.diasRestantes).toBe(cedo.diasRestantes);
    expect(tarde.diasRestantes).toBe(2);
  });

  it('o quinto dia ainda vale; o sexto já venceu', () => {
    expect(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(15)).vencido).toBe(false);
    expect(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(15)).diasRestantes).toBe(0);
    expect(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(16)).vencido).toBe(true);
    expect(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(16)).diasRestantes).toBe(-1);
  });

  it('o recálculo reinicia a janela', () => {
    // O preço novo também foi combinado, então também vale 5 dias.
    const s = situacaoPrazo(
      { status: 'criado', criadoEm: dia(1), recalculadoEm: dia(14) },
      dia(15),
    );
    expect(s.diasRestantes).toBe(4);
    expect(s.vencido).toBe(false);
  });
});

describe('quem não entra na conta', () => {
  for (const status of ['aprovado', 'pago', 'cancelado', 'recusado']) {
    it(`"${status}" tem preço travado`, () => {
      // Reprecificar um pedido pago mudaria valor que já virou nota fiscal.
      const s = situacaoPrazo({ status, criadoEm: dia(1) }, dia(30));
      expect(s.travado).toBe(true);
      expect(s.vencido).toBe(false);
      expect(avisoPrazo(s, 'orcamento')).toBeNull();
    });
  }

  it('não se importa com maiúscula no status', () => {
    expect(situacaoPrazo({ status: 'PAGO', criadoEm: dia(1) }, dia(30)).travado).toBe(true);
  });

  it('sem data de criação não inventa prazo', () => {
    const s = situacaoPrazo({ status: 'criado', criadoEm: null }, dia(10));
    expect(s.contaDe).toBeNull();
    expect(avisoPrazo(s, 'orcamento')).toBeNull();
    expect(tomDoPrazo(s)).toBe('neutro');
  });

  it('data inválida não vira NaN na tela', () => {
    const s = situacaoPrazo({ status: 'criado', criadoEm: 'quebrado' }, dia(10));
    expect(s.contaDe).toBeNull();
    expect(Number.isNaN(s.diasRestantes)).toBe(false);
  });
});

describe('o que aparece na tela', () => {
  it('diz qual documento recalcular', () => {
    const venceu = situacaoPrazo({ status: 'criado', criadoEm: dia(1) }, dia(10));
    expect(avisoPrazo(venceu, 'pedido')).toContain('recalcule o Pedido de Compra');
    expect(avisoPrazo(venceu, 'orcamento')).toContain('recalcule o Orçamento');
  });

  it('conta há quantos dias venceu', () => {
    const s = situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(17));
    expect(avisoPrazo(s, 'orcamento')).toContain('vencido há 2 dias');
  });

  it('avisa no último dia', () => {
    const s = situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(15));
    expect(avisoPrazo(s, 'orcamento')).toContain('Último dia');
  });

  it('singular e plural dos dias restantes', () => {
    expect(avisoPrazo(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(14)), 'orcamento'))
      .toBe('1 dia para o preço vencer');
    expect(avisoPrazo(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(13)), 'orcamento'))
      .toBe('2 dias para o preço vencer');
  });

  it('vermelho só quando venceu, âmbar na véspera', () => {
    expect(tomDoPrazo(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(12)))).toBe('neutro');
    expect(tomDoPrazo(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(14)))).toBe('atencao');
    expect(tomDoPrazo(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(15)))).toBe('atencao');
    expect(tomDoPrazo(situacaoPrazo({ status: 'criado', criadoEm: dia(10) }, dia(16)))).toBe('vencido');
  });

  it('quem já fechou não recebe aviso nenhum', () => {
    expect(tomDoPrazo(situacaoPrazo({ status: 'pago', criadoEm: dia(1) }, dia(30)))).toBe('neutro');
  });
});
