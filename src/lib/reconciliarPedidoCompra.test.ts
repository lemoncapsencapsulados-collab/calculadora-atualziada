import { describe, expect, it } from 'vitest';
import { houveMudanca, reconciliarPedidoCompra } from './reconciliarPedidoCompra';

const EMBALAGEM = { pote_cor: 'Âmbar', tampa_tipo: 'Rosca 63mm', lacre_inducao: true };

const salvo = {
  contratante: 'TRULY LTDA',
  numero_contrato: '2609',
  parcelas: [{ meio_pagamento: 'PIX', valor: 5000 }],
  endereco_entrega: 'Rua X, 100',
  produtos: [{ descricao: 'Multi', quantidade: 500, preco_unitario: 24 }],
  especificacoes: [
    {
      produto_nome: 'Multi',
      quantidade_por_frasco: '60 capsulas',
      dose_diaria: '2 cápsulas ao dia',
      doses_por_pote: '30 doses',
      composicao: [{ insumo: 'Vitamina D3', dose: '149 mcg' }],
      embalagem: EMBALAGEM,
    },
  ],
};

/** O orçamento depois de o consultor mexer: dose, fórmula e quantidade. */
const doOrcamento = {
  contratante: '',
  numero_contrato: '',
  parcelas: [],
  endereco_entrega: '',
  produtos: [{ descricao: 'Multi', quantidade: 800, preco_unitario: 26 }],
  especificacoes: [
    {
      produto_nome: 'Multi',
      quantidade_por_frasco: '90 capsulas',
      dose_diaria: '3 cápsulas ao dia',
      doses_por_pote: '30 doses',
      composicao: [{ insumo: 'Vitamina D3', dose: '49 mcg' }],
      embalagem: { pote_cor: '', tampa_tipo: '', lacre_inducao: false },
    },
  ],
};

describe('o orçamento manda no que é dele', () => {
  const r = reconciliarPedidoCompra(salvo, doOrcamento);

  it('traz fórmula, dose e quantidade novas', () => {
    const e = r.especificacoes![0];
    expect(e.composicao).toEqual([{ insumo: 'Vitamina D3', dose: '49 mcg' }]);
    expect(e.dose_diaria).toBe('3 cápsulas ao dia');
    expect(e.quantidade_por_frasco).toBe('90 capsulas');
  });

  it('traz produto, preço e quantidade novos', () => {
    expect(r.produtos).toEqual([{ descricao: 'Multi', quantidade: 800, preco_unitario: 26 }]);
  });
});

describe('a mão manda no que é dela', () => {
  const r = reconciliarPedidoCompra(salvo, doOrcamento);

  it('a embalagem escolhida não é apagada', () => {
    // O orçamento não tem como saber a cor do pote nem se leva lacre. Deixar
    // o autopreenchimento vencer apagaria a escolha do consultor.
    expect(r.especificacoes![0].embalagem).toEqual(EMBALAGEM);
  });

  it('contrato, parcelas e endereço continuam', () => {
    expect(r.numero_contrato).toBe('2609');
    expect(r.parcelas).toHaveLength(1);
    expect(r.endereco_entrega).toBe('Rua X, 100');
    expect(r.contratante).toBe('TRULY LTDA');
  });
});

describe('quando a lista de produtos muda', () => {
  it('produto novo no orçamento entra no documento', () => {
    const comDois = {
      ...doOrcamento,
      especificacoes: [
        ...doOrcamento.especificacoes,
        {
          produto_nome: 'Colágeno',
          quantidade_por_frasco: '300 g',
          composicao: [],
          embalagem: { pote_cor: 'Preto' },
        },
      ],
    };
    const r = reconciliarPedidoCompra(salvo, comDois);
    expect(r.especificacoes).toHaveLength(2);
    expect(r.especificacoes![1].produto_nome).toBe('Colágeno');
    // Produto novo nasce com a embalagem que o autopreenchimento deduziu.
    expect(r.especificacoes![1].embalagem).toEqual({ pote_cor: 'Preto' });
  });

  it('produto removido do orçamento sai do documento', () => {
    const semNenhum = { ...doOrcamento, especificacoes: [] };
    expect(reconciliarPedidoCompra(salvo, semNenhum).especificacoes).toHaveLength(0);
  });

  it('a embalagem não migra de um produto para outro', () => {
    // O ponto de casar por NOME e não por posição: se o orçamento perdeu o
    // primeiro produto, casar por índice daria ao Colágeno a embalagem do
    // Multi -- pote âmbar com lacre num produto que não pediu nenhum dos dois.
    const soColageno = {
      ...doOrcamento,
      especificacoes: [
        {
          produto_nome: 'Colágeno',
          quantidade_por_frasco: '300 g',
          composicao: [],
          embalagem: { pote_cor: 'Preto' },
        },
      ],
    };
    const r = reconciliarPedidoCompra(salvo, soColageno);
    expect(r.especificacoes![0].embalagem).toEqual({ pote_cor: 'Preto' });
    expect(r.especificacoes![0].embalagem).not.toEqual(EMBALAGEM);
  });
});

describe('casos de borda', () => {
  it('sem documento salvo, vale o do orçamento inteiro', () => {
    expect(reconciliarPedidoCompra(null, doOrcamento)).toBe(doOrcamento);
  });

  it('campo que o orçamento não trouxe não apaga o que estava', () => {
    const semDose = {
      ...doOrcamento,
      especificacoes: [{ produto_nome: 'Multi', embalagem: {} }],
    };
    const r = reconciliarPedidoCompra(salvo, semDose as never);
    expect(r.especificacoes![0].dose_diaria).toBe('2 cápsulas ao dia');
  });

  it('nome com caixa ou espaço diferente ainda casa', () => {
    const outroCaso = {
      ...doOrcamento,
      especificacoes: [{ ...doOrcamento.especificacoes[0], produto_nome: '  MULTI ' }],
    };
    expect(reconciliarPedidoCompra(salvo, outroCaso).especificacoes![0].embalagem).toEqual(
      EMBALAGEM,
    );
  });
});

describe('só grava quando mudou', () => {
  it('reconhece mudança de fórmula', () => {
    expect(houveMudanca(salvo, reconciliarPedidoCompra(salvo, doOrcamento))).toBe(true);
  });

  it('documento igual não conta como mudança', () => {
    expect(houveMudanca(salvo, salvo)).toBe(false);
  });

  it('sem documento anterior, é sempre mudança', () => {
    expect(houveMudanca(null, doOrcamento)).toBe(true);
  });
});
