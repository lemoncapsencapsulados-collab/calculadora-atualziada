import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conferirSenhaAdmin } from './senhaAdmin';

describe('senha de administrador', () => {
  it('aceita a senha certa', async () => {
    expect(await conferirSenhaAdmin('021200')).toBe(true);
  });

  it('recusa senha errada', async () => {
    expect(await conferirSenhaAdmin('021201')).toBe(false);
    expect(await conferirSenhaAdmin('123456')).toBe(false);
  });

  it('ignora espaço em volta', async () => {
    // Teclado de celular completa com espaço ao colar.
    expect(await conferirSenhaAdmin(' 021200 ')).toBe(true);
  });

  it('recusa vazio', async () => {
    expect(await conferirSenhaAdmin('')).toBe(false);
    expect(await conferirSenhaAdmin('   ')).toBe(false);
    expect(await conferirSenhaAdmin(undefined as unknown as string)).toBe(false);
  });

  it('não guarda a senha em texto no código', () => {
    // O hash existe para a senha não estar legível no bundle. Se alguém trocar
    // por comparação direta, o motivo do hash se perde sem ninguém notar.
    const fonte = readFileSync(new URL('./senhaAdmin.ts', import.meta.url), 'utf8');
    expect(fonte).not.toContain('021200');
  });
});
