import { describe, expect, it } from 'vitest';
import {
  CLIENTE_CATALOGO_2026,
  CLIENTE_SELECAO,
  DEPARTAMENTO_LABEL,
  departamentoDoCliente,
  ehCatalogo,
  ehCatalogo2026,
  ehSelecao,
  linhaDoCliente,
} from './linhaProduto';

describe('as três prateleiras', () => {
  it('cliente comum é Private Label', () => {
    expect(departamentoDoCliente('Truly Nutrition')).toBe('private_label');
    expect(departamentoDoCliente('')).toBe('private_label');
    expect(departamentoDoCliente(null)).toBe('private_label');
  });

  it('catálogo é White Label, com ou sem acento', () => {
    expect(departamentoDoCliente('Catálogo Lemon')).toBe('white_label');
    expect(departamentoDoCliente('LEMON CAPS - CATALOGO')).toBe('white_label');
  });

  it('a seleção é sua própria prateleira', () => {
    expect(departamentoDoCliente(CLIENTE_SELECAO)).toBe('selecao_lemoncaps');
    expect(departamentoDoCliente('SELEÇÃO LEMONCAPS')).toBe('selecao_lemoncaps');
    expect(departamentoDoCliente('selecao lemon caps')).toBe('selecao_lemoncaps');
  });

  it('seleção e catálogo não se confundem', () => {
    // O nome da seleção não tem a palavra "catálogo" justamente para isso:
    // se tivesse, ela cairia no White Label e a aba nova ficaria vazia.
    expect(ehCatalogo(CLIENTE_SELECAO)).toBe(false);
    expect(ehSelecao('Catálogo Lemon')).toBe(false);
  });

  it('cada prateleira tem rótulo próprio', () => {
    expect(DEPARTAMENTO_LABEL.selecao_lemoncaps).toBe('Seleção LemonCaps');
    // Rótulo repetido faria duas prateleiras parecerem a mesma na tela. O
    // número acompanha quantas existem -- hoje quatro, com o CATÁLOGO 2026.
    const rotulos = Object.values(DEPARTAMENTO_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
    expect(rotulos).toHaveLength(4);
  });
});

describe('linha do produto no orçamento e nos documentos', () => {
  it('a seleção sai como White Label', () => {
    // Comercialmente é o que o catálogo é: fórmula da casa, oferecida a
    // qualquer cliente. A prateleira separada é organização da tela de
    // Precificação, não um terceiro tipo de venda.
    expect(linhaDoCliente(CLIENTE_SELECAO)).toBe('white_label');
  });

  it('catálogo continua White Label e cliente continua Private', () => {
    expect(linhaDoCliente('Catálogo Lemon')).toBe('white_label');
    expect(linhaDoCliente('Truly Nutrition')).toBe('private_label');
  });

  it('só existem duas linhas de venda, mesmo com três prateleiras', () => {
    const linhas = new Set(
      ['Truly', 'Catálogo Lemon', CLIENTE_SELECAO].map((c) => linhaDoCliente(c)),
    );
    expect(linhas).toEqual(new Set(['private_label', 'white_label']));
  });
});

describe('CATÁLOGO 2026', () => {
  it('a fórmula do ano vai para a prateleira do ano', () => {
    expect(departamentoDoCliente('CATÁLOGO 2026')).toBe('catalogo_2026');
    expect(departamentoDoCliente(CLIENTE_CATALOGO_2026)).toBe('catalogo_2026');
  });

  it('NÃO é confundido com o Catálogo Lemon', () => {
    // A armadilha: o nome contém "catálogo", e `ehCatalogo` casa com ele.
    // Perguntar na ordem errada jogaria a prateleira inteira em White Label,
    // e ela sumiria da tela sem erro nenhum.
    expect(ehCatalogo('CATÁLOGO 2026')).toBe(true);
    expect(departamentoDoCliente('CATÁLOGO 2026')).not.toBe('white_label');
  });

  it('o Catálogo Lemon continua em White Label', () => {
    expect(departamentoDoCliente('Catálogo Lemon')).toBe('white_label');
  });

  it('não se confunde com outro ano', () => {
    expect(ehCatalogo2026('Catálogo 2027')).toBe(false);
    expect(departamentoDoCliente('Catálogo 2027')).toBe('white_label');
  });

  it('ignora acento, caixa e espaço entre as palavras', () => {
    for (const nome of ['catalogo 2026', 'CATÁLOGO 2026', 'Catalogo2026', 'catálogo  2026']) {
      expect(ehCatalogo2026(nome), nome).toBe(true);
    }
  });

  it('comercialmente é White Label, como a Seleção', () => {
    // A prateleira é organização interna; o tipo de venda é o mesmo.
    expect(linhaDoCliente('CATÁLOGO 2026')).toBe('white_label');
  });

  it('tem rótulo próprio na tela', () => {
    expect(DEPARTAMENTO_LABEL.catalogo_2026).toBe('CATÁLOGO 2026');
  });
});
