import { describe, expect, it } from 'vitest';
import { mapFromDB } from '@/lib/materiaPrima';

/**
 * Uma linha de `materias_primas` como o banco devolve.
 *
 * Os nomes aqui são os nomes REAIS das colunas. O preço é `preco_compra`, não
 * `preco_por_unidade_compra` -- esse é o nome do campo depois de convertido. Ler
 * o nome errado não quebra nada em TypeScript: devolve `undefined`, vira zero, e
 * a fórmula inteira passa a custar R$ 0,00 sem nenhum erro aparecer. Foi o que
 * aconteceu, e por isso este teste existe.
 */
const linhaDoBanco = {
  id: 'abc',
  nome: 'Vitamina B6 - Cloridrato de Piridoxina 99%',
  unidade_compra: 'kg',
  preco_compra: '1250.50',
  densidade: '0.8',
  fornecedor: 'Fornecedor X',
  categoria: 'Vitaminas',
  observacoes: 'lote novo',
  updated_at: '2026-10-01T10:00:00Z',
};

describe('conversão da matéria-prima vinda do banco', () => {
  it('lê o preço da coluna certa', () => {
    expect(mapFromDB(linhaDoBanco).preco_por_unidade_compra).toBe(1250.5);
  });

  it('o preço nunca chega como texto', () => {
    // O Postgres devolve numeric como string; usar direto na conta daria
    // concatenação em vez de soma.
    expect(typeof mapFromDB(linhaDoBanco).preco_por_unidade_compra).toBe('number');
  });

  it('preço zero não vira NaN', () => {
    expect(mapFromDB({ ...linhaDoBanco, preco_compra: 0 }).preco_por_unidade_compra).toBe(0);
  });

  it('traz os campos que a calculadora usa', () => {
    const mp = mapFromDB(linhaDoBanco);
    expect(mp.id).toBe('abc');
    expect(mp.nome).toContain('Vitamina B6');
    expect(mp.unidade_compra).toBe('kg');
    expect(mp.densidade).toBe(0.8);
  });

  it('campos vazios viram undefined, não string vazia', () => {
    const mp = mapFromDB({ ...linhaDoBanco, densidade: null, fornecedor: '', categoria: null });
    expect(mp.densidade).toBeUndefined();
    expect(mp.fornecedor).toBeUndefined();
    expect(mp.categoria).toBeUndefined();
  });

  it('não existe campo com o nome que a cópia errada usava', () => {
    // Se alguém voltar a ler `preco_por_unidade_compra` da linha crua, o valor
    // some de novo. O banco não tem essa coluna.
    expect('preco_por_unidade_compra' in linhaDoBanco).toBe(false);
  });
});
