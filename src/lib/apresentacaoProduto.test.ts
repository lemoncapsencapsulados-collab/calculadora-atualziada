import { describe, expect, it } from 'vitest';
import {
  acharEspecificacao,
  apresentacaoDoProduto,
  apresentacoesDosProdutos,
  tipoDaApresentacao,
} from './apresentacaoProduto';

const produto = (descricao: string, apresentacao: string) => ({ descricao, apresentacao });
const espec = (produto_nome: string, quantidade_por_frasco: string) => ({
  produto_nome,
  quantidade_por_frasco,
});

describe('o tipo sai da apresentação', () => {
  it('separa no traço', () => {
    expect(tipoDaApresentacao('Encapsulados - 60 capsulas')).toBe('Encapsulados');
  });

  it('sem traço, a apresentação inteira é o tipo', () => {
    expect(tipoDaApresentacao('Encapsulados')).toBe('Encapsulados');
  });

  it('não quebra com vazio', () => {
    expect(tipoDaApresentacao('')).toBe('');
    expect(tipoDaApresentacao(undefined)).toBe('');
  });

  it('traço dentro do nome do tipo não confunde', () => {
    // Só " - " com espaços separa; um hífen colado faz parte do nome.
    expect(tipoDaApresentacao('Pó-solúvel - 300 g')).toBe('Pó-solúvel');
  });
});

describe('a quantidade editada manda', () => {
  it('30 na especificação vira 30 na coluna, não 60', () => {
    // O caso real: o documento mostrava "Encapsulados - 60 capsulas" na coluna
    // APRESENTAÇÃO e "30 capsulas" em Quantidade por frasco, logo abaixo --
    // o mesmo papel afirmando duas quantidades para o mesmo produto.
    expect(
      apresentacaoDoProduto(
        produto('Multi', 'Encapsulados - 60 capsulas'),
        espec('Multi', '30 capsulas'),
      ),
    ).toBe('Encapsulados - 30 capsulas');
  });

  it('vale para qualquer forma farmacêutica', () => {
    const casos: [string, string, string][] = [
      ['Gummy - 60 gummies', '30 gummies', 'Gummy - 30 gummies'],
      ['Líquido - 30 ml', '20 ml', 'Líquido - 20 ml'],
      ['Solúvel - 300 g', '150 g', 'Solúvel - 150 g'],
    ];
    for (const [antes, editado, esperado] of casos) {
      expect(apresentacaoDoProduto(produto('X', antes), espec('X', editado))).toBe(esperado);
    }
  });

  it('especificação sem quantidade não apaga o que já havia', () => {
    // Documento antigo, ou campo em branco: imprimir só "Encapsulados"
    // perderia a informação que já estava no papel.
    expect(
      apresentacaoDoProduto(produto('Multi', 'Encapsulados - 60 capsulas'), espec('Multi', '')),
    ).toBe('Encapsulados - 60 capsulas');
    expect(
      apresentacaoDoProduto(produto('Multi', 'Encapsulados - 60 capsulas'), undefined),
    ).toBe('Encapsulados - 60 capsulas');
  });

  it('sem tipo, imprime só a quantidade', () => {
    expect(apresentacaoDoProduto(produto('Multi', ''), espec('Multi', '30 capsulas'))).toBe(
      '30 capsulas',
    );
  });
});

describe('qual especificação pertence a qual produto', () => {
  const especs = [espec('Colágeno', '30 g'), espec('Multi', '30 capsulas')];

  it('casa pelo nome, não pela posição', () => {
    // O produto está em 0 e a especificação dele em 1. Casar por posição
    // trocaria a quantidade de um produto pela do outro.
    expect(acharEspecificacao(especs, produto('Multi', 'Encapsulados - 60 capsulas'), 0)).toBe(
      especs[1],
    );
  });

  it('cai para a posição quando o nome não casa', () => {
    // Produto renomeado no documento: a ordem ainda é a melhor pista.
    expect(acharEspecificacao(especs, produto('Renomeado', 'X'), 1)).toBe(especs[1]);
  });

  it('não quebra sem especificações', () => {
    expect(acharEspecificacao([], produto('Multi', 'X'), 0)).toBeUndefined();
  });

  it('ignora caixa e espaço', () => {
    expect(acharEspecificacao(especs, produto('  multi ', 'X'), 0)).toBe(especs[1]);
  });
});

describe('a tabela inteira', () => {
  it('cada linha pega a sua quantidade', () => {
    const r = apresentacoesDosProdutos(
      [
        produto('Multi', 'Encapsulados - 60 capsulas'),
        produto('Colágeno', 'Solúvel - 300 g'),
      ],
      [espec('Multi', '30 capsulas'), espec('Colágeno', '150 g')],
    );
    expect(r).toEqual(['Encapsulados - 30 capsulas', 'Solúvel - 150 g']);
  });

  it('produto sem especificação mantém o que tinha', () => {
    const r = apresentacoesDosProdutos([produto('Multi', 'Encapsulados - 60 capsulas')], []);
    expect(r).toEqual(['Encapsulados - 60 capsulas']);
  });

  it('listas vazias não quebram', () => {
    expect(apresentacoesDosProdutos([], [])).toEqual([]);
  });
});
