import { describe, it, expect } from 'vitest';
import { ficaAtiva, type ContaExistente } from './metaReconexao.ts';

const conta = (id: string, ativo: boolean, status: string | null = 'ok'): ContaExistente => ({
  ad_account_id: id,
  ativo,
  last_sync_status: status,
});

describe('ficaAtiva', () => {
  it('reconexão com seleção feita: mantém a escolha de cada conta', () => {
    // O caso real: 1 de 21 ativa e o token vencido (status "erro").
    const existentes = [conta('act_lemon', true, 'erro'), conta('act_cliente', false), conta('act_outra', false)];
    expect(ficaAtiva(existentes, 'act_lemon')).toBe(true);
    expect(ficaAtiva(existentes, 'act_cliente')).toBe(false);
    expect(ficaAtiva(existentes, 'act_outra')).toBe(false);
  });

  it('conta nova que aparece numa reconexão chega desligada', () => {
    expect(ficaAtiva([conta('act_lemon', true)], 'act_nova')).toBe(false);
  });

  it('depois de "desconectar", volta exatamente o que estava ligado', () => {
    const existentes = [
      conta('act_lemon', false, 'desconectado'),
      conta('act_cliente', false, 'ok'),
    ];
    expect(ficaAtiva(existentes, 'act_lemon')).toBe(true);
    expect(ficaAtiva(existentes, 'act_cliente')).toBe(false);
    expect(ficaAtiva(existentes, 'act_nova')).toBe(false);
  });

  it('primeira conexão de todas: ativa tudo, como sempre foi', () => {
    expect(ficaAtiva([], 'act_qualquer')).toBe(true);
  });

  it('nada ativo e nada marcado como desconectado: trata como primeira conexão', () => {
    expect(ficaAtiva([conta('act_a', false, 'ok')], 'act_a')).toBe(true);
  });
});
