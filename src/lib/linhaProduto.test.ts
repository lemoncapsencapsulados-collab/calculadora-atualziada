import { describe, expect, it } from 'vitest';
import {
  CLIENTE_SELECAO,
  DEPARTAMENTO_LABEL,
  departamentoDoCliente,
  ehCatalogo,
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
    expect(new Set(Object.values(DEPARTAMENTO_LABEL)).size).toBe(3);
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
