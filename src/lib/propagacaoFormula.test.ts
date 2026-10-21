import { describe, expect, it } from 'vitest';
import {
  atualizarComposicao,
  atualizarInsumosDosItens,
  composicaoDosInsumos,
  doseEmTexto,
  insumosDaFormula,
  mesmaComposicao,
  mesmosInsumos,
  quantidadePorFrasco,
  unidadeDoPote,
  atualizarQuantidadePorFrasco,
} from './propagacaoFormula';

/** O caso real: uma matéria-prima de 149 mcg que passou a ser 49 mcg. */
const ANTES = [{ nome: 'Vitamina D3', quantidade: 149, unidade: 'mcg' }];
const DEPOIS = [{ nome: 'Vitamina D3', quantidade: 49, unidade: 'mcg' }];

const P = 'precificacao-x';

describe('a fórmula vira instantâneo', () => {
  it('lê nome, quantidade e unidade como o Gerar Orçamento lê', () => {
    expect(
      insumosDaFormula([
        { nome_insumo_snapshot: 'Vitamina D3', qtd_informada: 49, unidade_informada: 'mcg' },
      ]),
    ).toEqual(DEPOIS);
  });

  it('descarta linha sem nome, em vez de gravar um insumo em branco', () => {
    const r = insumosDaFormula([
      { nome_insumo_snapshot: '', qtd_informada: 10, unidade_informada: 'mg' },
      { nome_insumo_snapshot: 'Zinco', qtd_informada: 7, unidade_informada: 'mg' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('Zinco');
  });

  it('não quebra com formato inesperado', () => {
    expect(insumosDaFormula(null)).toEqual([]);
    expect(insumosDaFormula('nada')).toEqual([]);
    expect(insumosDaFormula([null, 3])).toEqual([]);
  });

  it('quantidade inválida vira zero, não NaN', () => {
    const r = insumosDaFormula([
      { nome_insumo_snapshot: 'X', qtd_informada: Number('abc'), unidade_informada: 'mg' },
    ]);
    expect(r[0].quantidade).toBe(0);
  });
});

describe('a dose como o documento escreve', () => {
  it('usa vírgula decimal', () => {
    expect(doseEmTexto({ nome: 'X', quantidade: 2.5, unidade: 'g' })).toBe('2,5 g');
  });

  it('inteiro não ganha casa decimal', () => {
    expect(doseEmTexto({ nome: 'X', quantidade: 49, unidade: 'mcg' })).toBe('49 mcg');
  });

  it('sem unidade não deixa espaço sobrando', () => {
    expect(doseEmTexto({ nome: 'X', quantidade: 1, unidade: '' })).toBe('1');
  });
});

describe('os itens do orçamento', () => {
  const itens = [
    { precificacao_id: P, nome_produto: 'Multi', insumos_formula: ANTES },
    { precificacao_id: 'outro', nome_produto: 'Colágeno', insumos_formula: ANTES },
  ];

  it('só o item do produto editado muda', () => {
    const r = atualizarInsumosDosItens(itens, P, DEPOIS);
    expect(r[0].insumos_formula).toEqual(DEPOIS);
    expect(r[1].insumos_formula).toEqual(ANTES);
  });

  it('não altera o item original no lugar', () => {
    atualizarInsumosDosItens(itens, P, DEPOIS);
    expect(itens[0].insumos_formula).toEqual(ANTES);
  });
});

describe('a composição do Pedido de Compra', () => {
  const composicaoAntiga = composicaoDosInsumos(ANTES);
  const composicaoNova = composicaoDosInsumos(DEPOIS);

  const espec = (nome: string) => ({
    produto_nome: nome,
    composicao: composicaoAntiga,
    embalagem: { pote_cor: 'Âmbar', lacre_inducao: true },
  });

  it('a dose nova chega ao documento', () => {
    // O caso que o Wesley viu: o PDF do cliente mudou e o Pedido de Compra
    // continuou com 149 mcg.
    expect(composicaoAntiga[0].dose).toBe('149 mcg');
    const { especificacoes, alteradas } = atualizarComposicao(
      [espec('Multi')],
      'Multi',
      composicaoNova,
    );
    expect(alteradas).toBe(1);
    expect(especificacoes[0].composicao[0].dose).toBe('49 mcg');
  });

  it('preserva tudo que o consultor digitou à mão', () => {
    // Material do pote, lacre, cor da tampa: escolhidos por ele. Trocar a
    // dosagem não pode apagar esse trabalho.
    const { especificacoes } = atualizarComposicao([espec('Multi')], 'Multi', composicaoNova);
    expect(especificacoes[0].embalagem).toEqual({ pote_cor: 'Âmbar', lacre_inducao: true });
  });

  it('não encosta em produto de outro nome', () => {
    const { especificacoes, alteradas } = atualizarComposicao(
      [espec('Multi'), espec('Colágeno')],
      'Multi',
      composicaoNova,
    );
    expect(alteradas).toBe(1);
    expect(especificacoes[1].composicao[0].dose).toBe('149 mcg');
  });

  it('nome que não casa não altera nada', () => {
    // Falha silenciosa de propósito: casar por posição trocaria a composição
    // de um produto pela de outro quando o documento tem produto a mais.
    const { alteradas } = atualizarComposicao([espec('Multi')], 'Produto Renomeado', composicaoNova);
    expect(alteradas).toBe(0);
  });

  it('ignora caixa e espaço em volta do nome', () => {
    const { alteradas } = atualizarComposicao([espec('Multi')], '  multi ', composicaoNova);
    expect(alteradas).toBe(1);
  });

  it('nome vazio não casa com tudo', () => {
    // Um nome em branco casando por engano reescreveria o documento inteiro.
    expect(atualizarComposicao([espec('Multi')], '   ', composicaoNova).alteradas).toBe(0);
  });

  it('composição igual não conta como alteração', () => {
    // Evita gravação e linha de histórico por nada.
    expect(atualizarComposicao([espec('Multi')], 'Multi', composicaoAntiga).alteradas).toBe(0);
  });
});

describe('comparações que evitam gravar à toa', () => {
  it('reconhece composição igual e diferente', () => {
    expect(mesmaComposicao(composicaoDosInsumos(ANTES), composicaoDosInsumos(ANTES))).toBe(true);
    expect(mesmaComposicao(composicaoDosInsumos(ANTES), composicaoDosInsumos(DEPOIS))).toBe(false);
    expect(mesmaComposicao(undefined, [])).toBe(true);
  });

  it('insumo diferente na quantidade conta como mudança', () => {
    expect(mesmosInsumos(ANTES, DEPOIS)).toBe(false);
    expect(mesmosInsumos(ANTES, ANTES)).toBe(true);
  });

  it('mesma quantidade com unidade diferente é mudança', () => {
    // 49 mg e 49 mcg são mil vezes diferentes. Comparar só o número deixaria
    // passar uma troca de unidade sem atualizar nada.
    expect(
      mesmosInsumos(
        [{ nome: 'X', quantidade: 49, unidade: 'mcg' }],
        [{ nome: 'X', quantidade: 49, unidade: 'mg' }],
      ),
    ).toBe(false);
  });

  it('insumo a mais conta como mudança', () => {
    expect(mesmosInsumos(ANTES, [...ANTES, { nome: 'Zinco', quantidade: 7, unidade: 'mg' }])).toBe(
      false,
    );
  });
});

describe('quantidade por pote, por tipo de produto', () => {
  const casos: [string, number, string][] = [
    ['Encapsulados', 60, '60 capsulas'],
    ['Gummy', 30, '30 gummies'],
    ['Líquido', 30, '30 ml'],
    ['Solúvel', 300, '300 g'],
  ];

  for (const [tipo, qtd, esperado] of casos) {
    it(`${tipo}: ${esperado}`, () => {
      expect(quantidadePorFrasco(qtd, tipo)).toBe(esperado);
    });
  }

  it('solúvel respeita a unidade que a fórmula definiu', () => {
    expect(quantidadePorFrasco(150, 'Solúvel', 'ml')).toBe('150 ml');
  });

  it('sem quantidade devolve vazio, não "0 capsulas"', () => {
    // Um "0 capsulas" impresso no documento é pior que a linha em branco:
    // a branca ao menos mostra que falta preencher.
    expect(quantidadePorFrasco(0, 'Encapsulados')).toBe('');
    expect(quantidadePorFrasco(null, 'Encapsulados')).toBe('');
    expect(quantidadePorFrasco('abc', 'Encapsulados')).toBe('');
  });

  it('tipo desconhecido não quebra', () => {
    expect(unidadeDoPote('')).toBe('capsulas');
    expect(unidadeDoPote('Coisa Nova')).toBe('capsulas');
  });
});

describe('a quantidade chega ao Pedido de Compra preenchido', () => {
  const espec = (nome: string, qtd: string) => ({
    produto_nome: nome,
    quantidade_por_frasco: qtd,
    composicao: [],
    embalagem: { pote_cor: 'Âmbar' },
  });

  it('troca a quantidade do produto editado', () => {
    const { especificacoes, alteradas } = atualizarQuantidadePorFrasco(
      [espec('Multi', '60 capsulas')],
      'Multi',
      '90 capsulas',
    );
    expect(alteradas).toBe(1);
    expect(especificacoes[0].quantidade_por_frasco).toBe('90 capsulas');
  });

  it('preserva o resto da especificação', () => {
    const { especificacoes } = atualizarQuantidadePorFrasco(
      [espec('Multi', '60 capsulas')],
      'Multi',
      '90 capsulas',
    );
    expect(especificacoes[0].embalagem).toEqual({ pote_cor: 'Âmbar' });
  });

  it('não encosta em produto de outro nome', () => {
    const { especificacoes, alteradas } = atualizarQuantidadePorFrasco(
      [espec('Multi', '60 capsulas'), espec('Colágeno', '30 g')],
      'Multi',
      '90 capsulas',
    );
    expect(alteradas).toBe(1);
    expect(especificacoes[1].quantidade_por_frasco).toBe('30 g');
  });

  it('quantidade igual não conta como alteração', () => {
    expect(
      atualizarQuantidadePorFrasco([espec('Multi', '60 capsulas')], 'Multi', '60 capsulas')
        .alteradas,
    ).toBe(0);
  });

  it('quantidade vazia não apaga o que já estava lá', () => {
    // Fórmula sem quantidade por pote não pode zerar um documento preenchido.
    const { especificacoes, alteradas } = atualizarQuantidadePorFrasco(
      [espec('Multi', '60 capsulas')],
      'Multi',
      '',
    );
    expect(alteradas).toBe(0);
    expect(especificacoes[0].quantidade_por_frasco).toBe('60 capsulas');
  });
});
