import { describe, expect, it } from 'vitest';
import {
  autorizacaoDaMudanca,
  autorizacaoDaPrateleira,
  autorizacaoDoDestino,
} from './autorizacaoPrateleira';
import { CLIENTE_CATALOGO_2026, CLIENTE_SELECAO } from './linhaProduto';

const CODIGO = '1235';
const SENHA = '021200';

describe('a tranca de cada prateleira', () => {
  it('CATÁLOGO 2026 abre com o código, não com a senha', async () => {
    const a = autorizacaoDaPrateleira(CLIENTE_CATALOGO_2026);
    expect(await a.conferir(CODIGO)).toBe(true);
    expect(await a.conferir(SENHA)).toBe(false);
    expect(a.rotuloCampo).toBe('Código');
  });

  it('Catálogo Lemon e Seleção seguem na senha de administrador', async () => {
    for (const cliente of ['Catálogo Lemon', CLIENTE_SELECAO]) {
      const a = autorizacaoDaPrateleira(cliente);
      expect(await a.conferir(SENHA), cliente).toBe(true);
      expect(await a.conferir(CODIGO), cliente).toBe(false);
    }
  });

  it('a frase diz de qual prateleira a fórmula é', () => {
    expect(autorizacaoDaPrateleira(CLIENTE_CATALOGO_2026).nomeDaPrateleira).toBe('CATÁLOGO 2026');
    expect(autorizacaoDaPrateleira('Catálogo Lemon').nomeDaPrateleira).toBe('Catálogo Lemon');
  });
});

describe('mudar de lista', () => {
  it('ENTRAR no CATÁLOGO 2026 pede o código', async () => {
    expect(await autorizacaoDoDestino('catalogo_2026').conferir(CODIGO)).toBe(true);
  });

  it('SAIR do CATÁLOGO 2026 também pede o código', async () => {
    // Tirar uma fórmula da curadoria é decisão de quem a montou. Sem isto,
    // a senha de administrador esvaziaria a prateleira sem passar por ela.
    const a = autorizacaoDaMudanca(CLIENTE_CATALOGO_2026, 'white_label');
    expect(await a.conferir(CODIGO)).toBe(true);
    expect(await a.conferir(SENHA)).toBe(false);
  });

  it('entre as outras prateleiras, segue a senha', async () => {
    const a = autorizacaoDaMudanca('Catálogo Lemon', 'selecao_lemoncaps');
    expect(await a.conferir(SENHA)).toBe(true);
    expect(await a.conferir(CODIGO)).toBe(false);
  });

  it('de Private Label para o 2026 pede o código', async () => {
    expect(await autorizacaoDaMudanca('Produtora X', 'catalogo_2026').conferir(CODIGO)).toBe(true);
  });
});
