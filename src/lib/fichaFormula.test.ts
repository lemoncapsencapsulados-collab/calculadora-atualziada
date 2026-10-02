import { describe, expect, it } from 'vitest';
import {
  conteudoDoPote,
  descricaoDaDose,
  quantidadeComUnidade,
  textoDoseDiaria,
  textoFichaCompleta,
} from './fichaFormula';
import type { Formula } from '@/types/formula';

const encapsulado = {
  id: 'f1',
  cliente: 'Catálogo Lemon',
  nome_formula: 'Vitacaps MK',
  tipo_produto: 'Encapsulados',
  quantidade_por_pote: 60,
  unidades_por_dose: 2,
  itens: [
    { insumo_id: 'a', nome_insumo_snapshot: 'Vitamina B12 — Metilcobalamina', qtd_informada: 600, unidade_informada: 'mcg', custo_calculado: 0 },
    { insumo_id: 'b', nome_insumo_snapshot: 'Vitamina D3 — Colecalciferol', qtd_informada: 50, unidade_informada: 'mcg', custo_calculado: 0 },
    { insumo_id: 'c', nome_insumo_snapshot: 'Excipiente', qtd_informada: 0.49925, unidade_informada: 'g', custo_calculado: 0 },
  ],
  embalagens: [
    { embalagem_id: 'e1', descricao_snapshot: 'Cápsula 0 — gelatinosa tamanho 0', custo_calculado: 1.08 },
    { embalagem_id: 'e2', descricao_snapshot: 'Pote preto 170ml (Rublion)', custo_calculado: 0.8 },
  ],
  total_mp: 1,
  total_embalagem: 2,
  custo_total: 3,
  data: new Date(),
} as unknown as Formula;

describe('dose diária', () => {
  const texto = textoDoseDiaria(encapsulado);

  it('abre com o nome e o conteúdo do pote', () => {
    expect(texto).toContain('*Vitacaps MK*');
    expect(texto).toContain('Encapsulados · 60 cápsulas por pote');
  });

  it('traz a tabela nutricional com porção e porções por embalagem', () => {
    expect(texto).toContain('Porção: 2 cápsulas (1 dose)');
    expect(texto).toContain('Porções por embalagem: 30');
  });

  it('lista cada matéria-prima com sua dose e unidade', () => {
    expect(texto).toContain('• Vitamina B12 — Metilcobalamina — 600 mcg');
    expect(texto).toContain('• Vitamina D3 — Colecalciferol — 50 mcg');
  });

  it('mantém a unidade cadastrada em vez de converter tudo para mg', () => {
    // Um rótulo diz "600 mcg", não "0,600 mg".
    expect(texto).not.toContain('0,6 mg');
    expect(texto).toContain('600 mcg');
  });

  it('não vaza custo', () => {
    // O texto é colado em conversa com cliente.
    expect(texto).not.toContain('R$');
    expect(texto.toLowerCase()).not.toContain('custo');
  });

  it('não traz a embalagem', () => {
    expect(texto).not.toContain('Pote preto');
  });
});

describe('ficha completa', () => {
  const texto = textoFichaCompleta(encapsulado);

  it('tem tudo da dose diária', () => {
    expect(texto).toContain('Porções por embalagem: 30');
    expect(texto).toContain('• Vitamina B12 — Metilcobalamina — 600 mcg');
  });

  it('acrescenta a embalagem do pote', () => {
    expect(texto).toContain('*EMBALAGEM (por pote)*');
    expect(texto).toContain('• Cápsula 0 — gelatinosa tamanho 0');
    expect(texto).toContain('• Pote preto 170ml (Rublion)');
  });

  it('também não vaza custo', () => {
    expect(texto).not.toContain('R$');
  });
});

describe('cada apresentação se lê do seu jeito', () => {
  it('solúvel sai em grama, não em miligrama', () => {
    // O banco grava solúvel em mg: 300.000 mg não vai num rótulo.
    const f = { ...encapsulado, tipo_produto: 'Solúvel', quantidade_por_pote: 300000, unidades_por_dose: 10000 } as Formula;
    expect(conteudoDoPote(f)).toBe('300 g');
    expect(descricaoDaDose(f)).toBe('10 g');
  });

  it('solúvel abaixo de um grama continua em mg', () => {
    const f = { ...encapsulado, tipo_produto: 'Solúvel', quantidade_por_pote: 800, unidades_por_dose: 400 } as Formula;
    expect(conteudoDoPote(f)).toBe('800 mg');
    expect(descricaoDaDose(f)).toBe('400 mg');
  });

  it('gummy conta em gomas', () => {
    const f = { ...encapsulado, tipo_produto: 'Gummy', quantidade_por_pote: 60, unidades_por_dose: 2 } as Formula;
    expect(conteudoDoPote(f)).toBe('60 gomas');
    expect(descricaoDaDose(f)).toBe('2 gomas');
  });

  it('dose de uma unidade sai no singular', () => {
    const f = { ...encapsulado, unidades_por_dose: 1 } as Formula;
    expect(descricaoDaDose(f)).toBe('1 cápsula');
  });
});

describe('o que não pode quebrar o texto', () => {
  it('fórmula sem matéria-prima diz isso, em vez de sair vazia', () => {
    const f = { ...encapsulado, itens: [] } as unknown as Formula;
    expect(textoDoseDiaria(f)).toContain('sem matérias-primas cadastradas');
  });

  it('fórmula sem embalagem diz isso', () => {
    const f = { ...encapsulado, embalagens: [] } as unknown as Formula;
    expect(textoFichaCompleta(f)).toContain('sem embalagem cadastrada');
  });

  it('dose não cadastrada não vira divisão por zero', () => {
    const f = { ...encapsulado, unidades_por_dose: 0 } as Formula;
    expect(descricaoDaDose(f)).toBe('dose não informada');
    expect(textoDoseDiaria(f)).not.toContain('NaN');
    expect(textoDoseDiaria(f)).not.toContain('Infinity');
  });

  it('número decimal sai no formato brasileiro', () => {
    expect(quantidadeComUnidade(0.49925, 'g')).toBe('0,49925 g');
    expect(quantidadeComUnidade(1500, 'mg')).toBe('1.500 mg');
  });

  it('fórmula sem nome não deixa o título vazio', () => {
    const f = { ...encapsulado, nome_formula: '' } as Formula;
    expect(textoDoseDiaria(f)).toContain('Fórmula sem nome');
  });
});
