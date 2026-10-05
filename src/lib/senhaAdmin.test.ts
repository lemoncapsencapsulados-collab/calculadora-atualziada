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

/**
 * Quem apaga coisa em Pedidos tem de conferir a senha por aqui.
 *
 * O diálogo de excluir pedido comparava com uma constante escrita no próprio
 * arquivo, de quatro dígitos -- não os seis da empresa. Quem digitava a certa
 * levava "Senha incorreta" e não conseguia excluir nada -- o bug ficou de pé
 * porque nada no projeto dizia de onde a senha devia vir.
 */
describe('as telas que apagam em Pedidos', () => {
  const telas = [
    '../components/pedidos/ConfirmarExclusaoPedidoDialog.tsx',
    '../components/pedidos/ConfirmarExclusaoPedidoCompraDialog.tsx',
  ];

  for (const tela of telas) {
    const fonte = () => readFileSync(new URL(tela, import.meta.url), 'utf8');

    it(`${tela.split('/').pop()} confere pelo módulo da senha`, () => {
      expect(fonte()).toContain('conferirSenhaAdmin');
    });

    it(`${tela.split('/').pop()} não compara com senha escrita no arquivo`, () => {
      // Pega tanto a senha certa quanto a errada que estava ali: o problema não
      // é o valor, é a comparação direta.
      const src = fonte().replace(/\/\/.*$/gm, '');
      expect(src).not.toMatch(/['"]0212\d*['"]/);
    });
  }
});
