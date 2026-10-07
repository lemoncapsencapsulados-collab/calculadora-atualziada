import { describe, expect, it } from 'vitest';
import { conferirFechamento, construcaoDePreco } from './construcaoPreco';
import { ALIQUOTA_IMPOSTO, calcularPrecificacaoPorPreco } from './precificacaoCalculator';

const SEM_INDIRETOS = { maoObraDireta: 0, energia: 0, depreciacao: 0, administrativo: 0 };

/** Config com o overhead que a empresa usa hoje (Painel Administrador). */
const config = (overhead: number) => ({ overhead_unitario: overhead }) as any;

function precificar(mp: number, emb: number, preco: number, overhead = 2) {
  return calcularPrecificacaoPorPreco(
    { custoMateriaPrima: mp, custoEmbalagem: emb },
    SEM_INDIRETOS,
    preco,
    config(overhead),
  );
}

const linha = (ls: ReturnType<typeof construcaoDePreco>, tipo: string) =>
  ls.find((l) => l.tipo === tipo)!;

describe('a conta do preço, aberta', () => {
  // O caso do print: Creatina 300g, preço 30.
  const r = precificar(9.12, 5.15, 30);
  const linhas = construcaoDePreco(r);

  it('mostra as três parcelas do custo, overhead incluído', () => {
    // O overhead era o que faltava na tela: MP + Emb davam 14,27 e o rodapé
    // dizia 16,27, sem nada explicando os R$ 2,00 de diferença.
    expect(linha(linhas, 'custo').valor).toBeCloseTo(9.12, 2);
    const custos = linhas.filter((l) => l.tipo === 'custo');
    expect(custos.map((c) => c.rotulo)).toEqual([
      'Matéria-prima',
      'Embalagem',
      'Overhead de produção',
    ]);
    expect(custos[2].valor).toBeCloseTo(2, 2);
  });

  it('o custo de produção é a soma das três', () => {
    const custos = linhas.filter((l) => l.tipo === 'custo');
    const soma = custos.reduce((s, c) => s + c.valor, 0);
    expect(linha(linhas, 'subtotal').valor).toBeCloseTo(soma, 2);
    expect(linha(linhas, 'subtotal').valor).toBeCloseTo(16.27, 2);
  });

  it('o imposto sai do preço, não do custo', () => {
    // 12% de 30 = 3,60. Se saísse do custo seria 1,95 -- e a margem mentiria
    // quase dois reais por pote.
    expect(linha(linhas, 'imposto').valor).toBeCloseTo(30 * ALIQUOTA_IMPOSTO, 2);
    expect(linha(linhas, 'imposto').valor).toBeCloseTo(3.6, 2);
    expect(linha(linhas, 'imposto').nota).toContain('sobre o preço de venda');
  });

  it('bate com o que a tela mostrava: lucro 10,13 e margem 33,8%', () => {
    expect(linha(linhas, 'lucro').valor).toBeCloseTo(10.13, 2);
    expect(r.margemLucroPercentual).toBeCloseTo(33.8, 1);
  });

  it('markup é maior que a margem, e é outra conta', () => {
    // 16,27 de custo para 30 de preço: 84,4% por cima do custo, 33,8% do preço.
    // Fechar venda trocando um pelo outro vende por metade do planejado.
    expect(r.markupBruto).toBeCloseTo(84.4, 1);
    expect(r.markupBruto).toBeGreaterThan(r.margemLucroPercentual);
  });

  it('toda linha diz de onde o número sai, menos o preço', () => {
    for (const l of linhas) {
      if (l.tipo === 'preco') continue;
      expect(l.nota, `sem nota: ${l.rotulo}`).toBeTruthy();
    }
  });
});

describe('o fechamento', () => {
  it('custo + imposto + lucro dá o preço', () => {
    // É o ponto de tudo: se as parcelas na tela não somam o preço, conferir
    // margem vira chute.
    const f = conferirFechamento(construcaoDePreco(precificar(9.12, 5.15, 30)));
    expect(f.fecha).toBe(true);
    expect(f.soma).toBeCloseTo(30, 2);
  });

  it('fecha em qualquer combinação, não só na do print', () => {
    const casos: [number, number, number, number][] = [
      [1.5, 0.8, 7.9, 3],
      [40, 12.5, 120, 2],
      [0.0001, 0.0002, 1, 2],
      [9.12, 5.15, 16.27, 2], // preço igual ao custo: lucro negativo pelo imposto
      [30, 10, 35, 2], // vendendo abaixo do custo
    ];
    for (const [mp, emb, preco, oh] of casos) {
      const f = conferirFechamento(construcaoDePreco(precificar(mp, emb, preco, oh)));
      expect(f.fecha, `não fechou em ${mp}/${emb}/${preco}/${oh}`).toBe(true);
    }
  });

  it('acusa quando não fecha, em vez de deixar passar', () => {
    const quebrado = construcaoDePreco(precificar(9.12, 5.15, 30));
    quebrado.find((l) => l.tipo === 'lucro')!.valor += 1;
    expect(conferirFechamento(quebrado).fecha).toBe(false);
  });

  it('meio centavo de arredondamento não vira alarme', () => {
    // Custos têm seis casas e a tela mostra reais: a soma do que está escrito
    // pode cair no último centavo sem nada estar errado.
    const linhas = construcaoDePreco(precificar(9.12, 5.15, 30));
    linhas.find((l) => l.tipo === 'lucro')!.valor += 0.004;
    expect(conferirFechamento(linhas).fecha).toBe(true);
  });
});

describe('preço abaixo do custo', () => {
  it('o lucro aparece negativo, não zerado', () => {
    // Já houve produto vendido no prejuízo aqui. Esconder o sinal seria
    // esconder exatamente o que a tela existe para mostrar.
    const linhas = construcaoDePreco(precificar(30, 10, 35));
    expect(linha(linhas, 'lucro').valor).toBeLessThan(0);
    expect(conferirFechamento(linhas).fecha).toBe(true);
  });
});
