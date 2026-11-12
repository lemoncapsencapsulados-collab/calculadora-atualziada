import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conferirCodigoJuros } from './codigoJuros';
import { conferirSenhaAdmin } from './senhaAdmin';

describe('código para editar os juros', () => {
  it('aceita o código certo', async () => {
    expect(await conferirCodigoJuros('1235')).toBe(true);
  });

  it('recusa código errado', async () => {
    expect(await conferirCodigoJuros('1234')).toBe(false);
    expect(await conferirCodigoJuros('12355')).toBe(false);
  });

  it('ignora espaço em volta', async () => {
    // Teclado de celular completa com espaço ao colar.
    expect(await conferirCodigoJuros(' 1235 ')).toBe(true);
  });

  it('recusa vazio', async () => {
    expect(await conferirCodigoJuros('')).toBe(false);
    expect(await conferirCodigoJuros('   ')).toBe(false);
    expect(await conferirCodigoJuros(undefined as unknown as string)).toBe(false);
  });

  it('não é a senha de administrador', async () => {
    expect(await conferirSenhaAdmin('1235')).toBe(false);
  });

  it('não guarda o código em texto no arquivo', () => {
    // O hash existe para o código não estar legível no bundle. Se alguém
    // trocar por comparação direta, o motivo do hash se perde sem ninguém
    // notar.
    const fonte = readFileSync(new URL('./codigoJuros.ts', import.meta.url), 'utf8');
    expect(fonte).not.toContain('1235');
  });
});
