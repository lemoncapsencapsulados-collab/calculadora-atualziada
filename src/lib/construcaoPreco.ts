/**
 * A conta do preço, linha por linha.
 *
 * A tela mostrava três números -- MP, Embalagem e Custo -- e um custo que não
 * era a soma dos outros dois: faltava o overhead, que entra por configuração e
 * não aparecia em lugar nenhum. Com R$ 9,12 de matéria-prima e R$ 5,15 de
 * embalagem, o rodapé dizia "Custo R$ 16,27" e quem conferia não achava os
 * R$ 2,00 que sobravam.
 *
 * O imposto e o markup também não apareciam. O markup é gravado no banco desde
 * sempre e nunca foi mostrado em tela nenhuma.
 *
 * Então aqui a conta é aberta inteira, e um teste garante que as parcelas
 * fecham no preço de venda. Conferir margem é decidir quanto cobrar -- se os
 * números na tela não somam, a decisão é um chute.
 */

import type { PrecificacaoCalculada } from '@/types/precificacao';
import { ALIQUOTA_IMPOSTO } from '@/lib/precificacaoCalculator';

export type TipoLinha = 'custo' | 'subtotal' | 'imposto' | 'lucro' | 'preco';

export interface LinhaConstrucao {
  rotulo: string;
  valor: number;
  /** De onde o número sai. Sem isto, "R$ 3,60" é só um número a mais. */
  nota?: string;
  tipo: TipoLinha;
}

/**
 * As parcelas que somam o preço, na ordem em que o preço se forma.
 *
 * O overhead sai de `custoMaoObraDireta` porque é onde o cálculo o guarda --
 * um nome herdado de quando havia mão de obra, energia e depreciação
 * separadas. O rótulo aqui diz o que o número é hoje.
 */
export function construcaoDePreco(
  r: PrecificacaoCalculada,
  aliquota: number = ALIQUOTA_IMPOSTO,
): LinhaConstrucao[] {
  const overhead = Number(r.custoMaoObraDireta) || 0;
  const pct = (aliquota * 100).toFixed(aliquota * 100 % 1 === 0 ? 0 : 1);

  return [
    { tipo: 'custo', rotulo: 'Matéria-prima', valor: Number(r.custoMateriaPrima) || 0, nota: 'por pote' },
    { tipo: 'custo', rotulo: 'Embalagem', valor: Number(r.custoEmbalagem) || 0, nota: 'por pote' },
    { tipo: 'custo', rotulo: 'Overhead de produção', valor: overhead, nota: 'valor fixo por unidade, definido no Painel Administrador' },
    { tipo: 'subtotal', rotulo: 'Custo de produção', valor: Number(r.totalCustosProducao) || 0, nota: 'as três linhas acima' },
    { tipo: 'imposto', rotulo: 'Imposto', valor: Number(r.totalImpostos) || 0, nota: `${pct}% sobre o preço de venda, não sobre o custo` },
    { tipo: 'lucro', rotulo: 'Lucro', valor: Number(r.margemLucroValor) || 0, nota: 'o que sobra depois do custo e do imposto' },
    { tipo: 'preco', rotulo: 'Preço de venda', valor: Number(r.precoVenda) || 0 },
  ];
}

export interface Fechamento {
  /** Custo + imposto + lucro. */
  soma: number;
  preco: number;
  diferenca: number;
  /** As parcelas somam o preço, a menos de arredondamento de centavo. */
  fecha: boolean;
}

/**
 * Confere se as parcelas somam o preço.
 *
 * Meio centavo de tolerância: os custos são guardados com seis casas e exibidos
 * em reais, então a soma do que está NA TELA pode diferir do preço no último
 * centavo sem que nada esteja errado. Diferença maior que isso é conta furada,
 * e a tela precisa dizer em vez de deixar o consultor somar de cabeça e achar
 * que errou.
 */
export function conferirFechamento(linhas: LinhaConstrucao[]): Fechamento {
  const valor = (tipo: TipoLinha) => linhas.find((l) => l.tipo === tipo)?.valor ?? 0;
  const soma = valor('subtotal') + valor('imposto') + valor('lucro');
  const preco = valor('preco');
  const diferenca = soma - preco;
  return { soma, preco, diferenca, fecha: Math.abs(diferenca) < 0.005 };
}

/**
 * Markup e margem respondem perguntas diferentes e são confundidos o tempo
 * todo, porque os dois saem em porcentagem e o markup é sempre o número maior.
 *
 *   margem = lucro ÷ PREÇO    -- quanto do que o cliente paga sobra
 *   markup = lucro ÷ CUSTO    -- quanto se acrescenta por cima do custo
 *
 * Com custo 16,27 e preço 30: margem 33,8%, markup 84,4%. O mesmo negócio.
 * Trocar um pelo outro na hora de fechar é vender com metade do que se pensou.
 *
 * O markup daqui é o bruto, sobre o custo, SEM tirar o imposto -- é como o
 * cálculo o grava no banco desde sempre.
 */
export const EXPLICACAO_MARGEM =
  'Margem: quanto do preço sobra de lucro (lucro ÷ preço de venda).';

export const EXPLICACAO_MARKUP =
  'Markup: quanto se acrescenta por cima do custo (preço − custo, ÷ custo). Não desconta o imposto, por isso é sempre maior que a margem.';
