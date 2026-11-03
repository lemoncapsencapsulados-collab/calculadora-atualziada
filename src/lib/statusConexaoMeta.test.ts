import { describe, it, expect } from 'vitest';
import { dataDoErroMeta, statusConexaoMeta } from './statusConexaoMeta';

// A mensagem exata que está no banco de produção desde 19/10/2026.
const ERRO_REAL =
  'Error validating access token: Session has expired on Monday, 19-Oct-26 11:36:54 PDT. The current time is Tuesday, 03-Nov-26 04:34:03 PST.';

// Instante em UTC, e não hora local: com hora local o número de dias até o
// vencimento mudava conforme o fuso da máquina que roda o teste.
const HOJE = new Date('2026-11-03T12:00:00Z');

describe('dataDoErroMeta', () => {
  it('tira a data de vencimento do texto da Meta', () => {
    const d = dataDoErroMeta(ERRO_REAL);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9);
    expect(d?.getDate()).toBe(19);
  });

  it('sem data no texto, não inventa', () => {
    expect(dataDoErroMeta('Rate limit reached')).toBeUndefined();
    expect(dataDoErroMeta(null)).toBeUndefined();
  });
});

describe('statusConexaoMeta', () => {
  it('o caso de produção: token vencido vira "expirada", com a data da Meta', () => {
    const s = statusConexaoMeta({ last_sync_status: 'erro', last_sync_error: ERRO_REAL }, HOJE);
    expect(s.estado).toBe('expirada');
    expect(s.data?.getDate()).toBe(19);
  });

  it('vencimento previsto já passou, mesmo sem erro gravado: expirada', () => {
    const s = statusConexaoMeta({ last_sync_status: 'ok', token_expires_at: '2026-10-19T18:36:54Z' }, HOJE);
    expect(s.estado).toBe('expirada');
  });

  it('outro erro (não de token) é "erro", não "expirada" — reconectar não resolveria', () => {
    const s = statusConexaoMeta({ last_sync_status: 'erro', last_sync_error: 'Rate limit reached' }, HOJE);
    expect(s.estado).toBe('erro');
  });

  it('avisa uma semana antes de vencer', () => {
    const s = statusConexaoMeta({ last_sync_status: 'ok', token_expires_at: '2026-11-08T12:00:00Z' }, HOJE);
    expect(s.estado).toBe('expirando');
    expect(s.diasRestantes).toBe(5);
    expect(s.resumo).toBe('conexão vence em 5 dias');
  });

  it('longe do vencimento e sem erro: ok, sem frase', () => {
    expect(statusConexaoMeta({ last_sync_status: 'ok', token_expires_at: '2026-12-30T00:00:00Z' }, HOJE)).toEqual({
      estado: 'ok',
      resumo: '',
    });
  });

  it('sem data de vencimento e sem erro: ok', () => {
    expect(statusConexaoMeta({ last_sync_status: 'conectado' }, HOJE).estado).toBe('ok');
  });
});
