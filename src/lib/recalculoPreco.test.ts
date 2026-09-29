import { describe, expect, it } from 'vitest';
import {
  type CustosItem,
  type PrecificacaoAtual,
  motivosDaMudanca,
  recalcularItens,
} from './recalculoPreco';

const custos = (p: Partial<CustosItem> = {}): CustosItem => ({
  materia_prima: 10,
  embalagem: 3,
  impostos: 2,
  indiretos: 3,
  margem_percentual: 40,
  ...p,
});

const prec = (id: string, preco: number, c: Partial<CustosItem> = {}): PrecificacaoAtual => {
  const k = custos(c);
  return {
    id,
    preco_venda: preco,
    custo_materia_prima: k.materia_prima,
    custo_embalagem: k.embalagem,
    total_impostos: k.impostos,
    custo_mao_obra_direta: k.indiretos,
    margem_lucro_percentual: k.margem_percentual,
  };
};

describe('o que mudou no preço', () => {
  it('traz o preço de hoje da precificação', () => {
    const r = recalcularItens(
      [{ nome_produto: 'Creatina', precificacao_id: 'p1', preco_unitario: 20, quantidade: 500 }],
      [prec('p1', 24)],
    );
    expect(r.mudancas).toHaveLength(1);
    expect(r.mudancas[0].precoAntes).toBe(20);
    expect(r.mudancas[0].precoDepois).toBe(24);
    expect(r.mudancas[0].diferenca).toBe(4);
    expect(r.totalAntes).toBe(10000);
    expect(r.totalDepois).toBe(12000);
    expect(r.diferencaTotal).toBe(2000);
  });

  it('preço igual não vira mudança', () => {
    const r = recalcularItens(
      [{ nome_produto: 'X', precificacao_id: 'p1', preco_unitario: 20, quantidade: 1 }],
      [prec('p1', 20)],
    );
    expect(r.semMudanca).toBe(true);
    expect(r.diferencaTotal).toBe(0);
  });

  it('centavo de arredondamento não conta como mudança', () => {
    const r = recalcularItens(
      [{ nome_produto: 'X', precificacao_id: 'p1', preco_unitario: 20, quantidade: 1 }],
      [prec('p1', 20.001)],
    );
    expect(r.semMudanca).toBe(true);
  });

  it('preço que caiu também aparece', () => {
    const r = recalcularItens(
      [{ nome_produto: 'X', precificacao_id: 'p1', preco_unitario: 30, quantidade: 2 }],
      [prec('p1', 25)],
    );
    expect(r.mudancas[0].diferenca).toBe(-5);
    expect(r.diferencaTotal).toBe(-10);
  });
});

describe('item que não se recalcula', () => {
  it('item avulso mantém o preço digitado', () => {
    // Não veio de precificação nenhuma; mexer nele seria inventar número.
    const r = recalcularItens(
      [{ nome_produto: 'Serviço combinado', preco_unitario: 500, quantidade: 1 }],
      [],
    );
    expect(r.semMudanca).toBe(true);
    expect(r.totalDepois).toBe(500);
  });

  it('precificação apagada mantém o preço e avisa', () => {
    // Zerar o item por não achar a origem sumiria com dinheiro do orçamento.
    const r = recalcularItens(
      [{ nome_produto: 'Produto antigo', precificacao_id: 'sumiu', preco_unitario: 40, quantidade: 3 }],
      [prec('p1', 10)],
    );
    expect(r.semPrecificacao).toEqual(['Produto antigo']);
    expect(r.totalDepois).toBe(120);
    expect(r.mudancas).toHaveLength(0);
  });
});

describe('por que mudou', () => {
  it('aponta o componente que subiu', () => {
    const motivos = motivosDaMudanca(custos({ materia_prima: 10 }), custos({ materia_prima: 14.5 }));
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain('Matéria-prima subiu');
    expect(motivos[0]).toContain('R$ 4,50');
  });

  it('separa embalagem, imposto e custo indireto', () => {
    const motivos = motivosDaMudanca(
      custos(),
      custos({ embalagem: 5, impostos: 1, indiretos: 4 }),
    );
    expect(motivos.join(' | ')).toContain('Embalagem subiu');
    expect(motivos.join(' | ')).toContain('Impostos caiu');
    expect(motivos.join(' | ')).toContain('Custos indiretos subiu');
  });

  it('relata mudança de margem em pontos', () => {
    const motivos = motivosDaMudanca(custos({ margem_percentual: 40 }), custos({ margem_percentual: 32.5 }));
    expect(motivos[0]).toContain('Margem caiu 7.5 pontos');
  });

  it('ignora diferença abaixo de um centavo', () => {
    expect(motivosDaMudanca(custos(), custos({ materia_prima: 10.002 }))).toEqual([]);
  });

  it('sem os componentes de antes, não chuta a causa', () => {
    // Orçamento anterior ao sistema guardar os componentes: melhor dizer só a
    // diferença de preço do que inventar de onde ela veio.
    expect(motivosDaMudanca(null, custos({ materia_prima: 99 }))).toEqual([]);
    expect(motivosDaMudanca(undefined, custos())).toEqual([]);
  });

  it('o item recalculado leva os motivos junto', () => {
    const r = recalcularItens(
      [{
        nome_produto: 'Creatina',
        precificacao_id: 'p1',
        preco_unitario: 20,
        quantidade: 1,
        custos_no_orcamento: custos({ materia_prima: 10 }),
      }],
      [prec('p1', 24, { materia_prima: 13 })],
    );
    expect(r.mudancas[0].motivos[0]).toContain('Matéria-prima subiu R$ 3,00');
    expect(r.mudancas[0].custosAgora.materia_prima).toBe(13);
  });
});

describe('orçamento inteiro', () => {
  it('soma o que mudou e o que não mudou', () => {
    const r = recalcularItens(
      [
        { nome_produto: 'A', precificacao_id: 'p1', preco_unitario: 10, quantidade: 100 },
        { nome_produto: 'B', precificacao_id: 'p2', preco_unitario: 20, quantidade: 50 },
        { nome_produto: 'Avulso', preco_unitario: 300, quantidade: 1 },
      ],
      [prec('p1', 12), prec('p2', 20)],
    );
    expect(r.mudancas).toHaveLength(1);
    expect(r.mudancas[0].nome).toBe('A');
    expect(r.totalAntes).toBe(2300);
    expect(r.totalDepois).toBe(2500);
  });

  it('orçamento vazio não quebra', () => {
    const r = recalcularItens([], []);
    expect(r.semMudanca).toBe(true);
    expect(r.totalAntes).toBe(0);
  });
});
