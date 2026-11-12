/**
 * Juros do parcelamento no cartão.
 *
 * MORA NUM LUGAR SÓ porque a mesma tabela estava copiada em cinco arquivos —
 * o formulário, o PDF do orçamento, o resumo em texto, a previsão de
 * recebimentos e o cálculo de comissão. Mudar a taxa exigia lembrar dos cinco,
 * e esquecer um não quebra nada: o orçamento mostra um total, a comissão paga
 * sobre outro, e a diferença só aparece quando alguém confere na mão.
 *
 * TUDO AQUI É PERCENTUAL (5 = 5%), que é a unidade do campo gravado e a que a
 * pessoa digita. A conversão para fração acontece uma vez, em `taxaDoCartao`.
 */

import type { CartaoPagamento } from '@/types/orcamento';

/**
 * A tabela em vigor: o que a tela oferece ao montar um pagamento novo.
 *
 * 3x passou de 0% para 5% em 12/11/2026, a pedido da diretoria.
 */
export const JUROS_PADRAO: Record<number, number> = {
  1: 0,
  2: 0,
  3: 5,
  4: 7,
  5: 8,
  6: 9,
};

/**
 * A tabela de antes, para cartão gravado quando a taxa ainda não era guardada.
 *
 * POR QUE EXISTE: nenhum orçamento antigo tem `juros_percentual`. Se a falta do
 * campo caísse na tabela nova, todo pedido fechado em 3x sem juros passaria a
 * ser recalculado com 5% — o cliente assinou um valor, a previsão de
 * recebimento mostraria outro, e a comissão já paga ficaria errada para trás.
 *
 * Só o 3x difere entre as duas tabelas; o resto é igual de propósito, e é por
 * isso que esta tabela não precisa crescer: a partir de agora o formulário
 * carimba a taxa em todo cartão que cria ou tem o parcelamento trocado.
 */
const JUROS_ANTES_DE_GUARDAR_A_TAXA: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 7,
  5: 8,
  6: 9,
};

/** O que a tela propõe para N parcelas, em percentual. */
export function jurosPadraoPercentual(parcelas: number): number {
  return JUROS_PADRAO[parcelas] ?? 0;
}

/**
 * A taxa que vale para este cartão, em FRAÇÃO (0.05 para 5%).
 *
 * `?? ` e não `||`: zero é uma taxa escolhida — "este cartão não tem juros" —
 * e com `||` ela cairia no padrão, ressuscitando os 5% que alguém tirou de
 * propósito.
 */
export function taxaDoCartao(cartao: Pick<CartaoPagamento, 'parcelas' | 'juros_percentual'>): number {
  const percentual =
    cartao?.juros_percentual ?? JUROS_ANTES_DE_GUARDAR_A_TAXA[cartao?.parcelas] ?? 0;
  return Number(percentual) / 100;
}

/** O mesmo em percentual, para a tela escrever "5%". */
export function jurosDoCartaoPercentual(
  cartao: Pick<CartaoPagamento, 'parcelas' | 'juros_percentual'>,
): number {
  return taxaDoCartao(cartao) * 100;
}

export interface ContaDoCartao {
  /** Fração: 0.05 para 5%. */
  taxa: number;
  totalComJuros: number;
  valorParcela: number;
  /** O acréscimo em reais — o número que o cliente pergunta. */
  acrescimo: number;
}

/** A conta do cartão a partir do valor sem juros. */
export function calcularComJuros(
  valorBase: number,
  cartao: Pick<CartaoPagamento, 'parcelas' | 'juros_percentual'>,
): ContaDoCartao {
  const taxa = taxaDoCartao(cartao);
  const base = Number(valorBase) || 0;
  const parcelas = Math.max(1, Number(cartao?.parcelas) || 1);
  const totalComJuros = base * (1 + taxa);
  return {
    taxa,
    totalComJuros,
    valorParcela: totalComJuros / parcelas,
    acrescimo: totalComJuros - base,
  };
}

/** "(+5%)" ou "(s/ juros)" — o rótulo curto das listas. */
export function rotuloJurosCurto(taxa: number): string {
  return taxa > 0 ? ` (+${(taxa * 100).toFixed(0)}%)` : ' (s/ juros)';
}

/** "(juros de 5%)" ou "(sem juros)" — o rótulo dos documentos. */
export function rotuloJurosExtenso(taxa: number): string {
  return taxa > 0 ? ` (juros de ${(taxa * 100).toFixed(0)}%)` : ' (sem juros)';
}
