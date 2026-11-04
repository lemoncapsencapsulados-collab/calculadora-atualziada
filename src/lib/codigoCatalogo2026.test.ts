import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conferirCodigoCatalogo2026 } from './codigoCatalogo2026';
import { conferirSenhaAdmin } from './senhaAdmin';

describe('código do CATÁLOGO 2026', () => {
  it('aceita o código certo', async () => {
    expect(await conferirCodigoCatalogo2026('1235')).toBe(true);
  });

  it('recusa código errado', async () => {
    expect(await conferirCodigoCatalogo2026('1234')).toBe(false);
    expect(await conferirCodigoCatalogo2026('12355')).toBe(false);
  });

  it('ignora espaço em volta', async () => {
    // Teclado de celular completa com espaço ao colar.
    expect(await conferirCodigoCatalogo2026(' 1235 ')).toBe(true);
  });

  it('recusa vazio', async () => {
    expect(await conferirCodigoCatalogo2026('')).toBe(false);
    expect(await conferirCodigoCatalogo2026('   ')).toBe(false);
    expect(await conferirCodigoCatalogo2026(undefined as unknown as string)).toBe(false);
  });

  it('não é a senha de administrador', async () => {
    // Trancas diferentes de propósito: montar a curadoria do ano é trabalho
    // comercial, não de quem administra o sistema. Se uma abrisse a outra,
    // não haveria razão para existirem duas.
    expect(await conferirSenhaAdmin('1235')).toBe(false);
    expect(await conferirCodigoCatalogo2026('021200')).toBe(false);
  });

  it('não guarda o código em texto no arquivo', () => {
    // O hash existe para o código não estar legível no bundle. Se alguém
    // trocar por comparação direta, o motivo do hash se perde sem ninguém
    // notar.
    const fonte = readFileSync(new URL('./codigoCatalogo2026.ts', import.meta.url), 'utf8');
    expect(fonte).not.toContain('1235');
  });
});
