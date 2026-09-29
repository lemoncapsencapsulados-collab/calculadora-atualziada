/**
 * A conta que liga DOSE e POTE.
 *
 * A fórmula é cadastrada por dose -- "Creatina 3.000 mg" é o que vai em cada
 * dose, não no pote inteiro. O custo que interessa para precificar é o do pote:
 * custo da dose × número de doses. Confundir os dois divide o custo por 30 num
 * pote de 60 cápsulas com 2 por dose, e a margem sai três dígitos acima da real.
 *
 * Isto vive num módulo próprio porque a calculadora e o "Editar produto"
 * faziam a conta cada um do seu jeito -- e um deles esqueceu de multiplicar
 * pelas doses. Uma conta, um lugar.
 */

import type { UnitType } from '@/types/formula';

/** Capacidade de uma cápsula, em gramas. */
export const CAPACIDADE_CAPSULA_GRAMAS = 0.5;

/**
 * Quantas doses saem de um pote.
 *
 * `quantidadePorPote` e `unidadesPorDose` já vêm na mesma unidade do banco:
 * cápsulas para encapsulados, mg para solúvel (a calculadora converte antes de
 * gravar). Então é uma divisão simples -- o cuidado é não dividir por zero e
 * nunca devolver menos de uma dose, que faria o pote custar menos que a dose.
 */
export function numeroDeDoses(
  quantidadePorPote: number | null | undefined,
  unidadesPorDose: number | null | undefined,
): number {
  const total = Number(quantidadePorPote);
  const porDose = Number(unidadesPorDose);
  if (!Number.isFinite(total) || total <= 0) return 1;
  if (!Number.isFinite(porDose) || porDose <= 0) return 1;
  return Math.max(1, total / porDose);
}

/** Custo de matéria-prima do pote inteiro. */
export function custoMpPorPote(custoPorDose: number, doses: number): number {
  const c = Number(custoPorDose);
  if (!Number.isFinite(c) || c <= 0) return 0;
  return c * (Number.isFinite(doses) && doses > 0 ? doses : 1);
}

/** Converte para gramas o que tem peso; volume e UI não entram. */
export function emGramas(quantidade: number, unidade: UnitType): number {
  const q = Number(quantidade);
  if (!Number.isFinite(q)) return 0;
  switch (unidade) {
    case 'kg':
      return q * 1000;
    case 'g':
      return q;
    case 'mg':
      return q / 1000;
    case 'mcg':
      return q / 1_000_000;
    default:
      // mL, L, UI e unidade não têm peso conhecido sem densidade.
      return 0;
  }
}

/** Peso total dos insumos de UMA dose, em gramas. */
export function gramasDaDose(
  itens: { quantidade: number; unidade: UnitType }[],
): number {
  return itens.reduce((s, i) => s + emGramas(i.quantidade, i.unidade), 0);
}

/**
 * Quanto de excipiente falta para encher as cápsulas da dose, em gramas.
 *
 * Só encapsulado tem esse buraco: a cápsula tem capacidade fixa e o que sobra
 * é completado com excipiente, que custa. Pó, goma e líquido não têm cápsula,
 * então não há o que completar.
 */
export function excipienteDaDoseEmGramas(
  tipoProduto: string,
  unidadesPorDose: number,
  gramasDosInsumos: number,
): number {
  if (tipoProduto !== 'Encapsulados') return 0;
  const capsulas = Number(unidadesPorDose) > 0 ? Number(unidadesPorDose) : 1;
  const capacidade = capsulas * CAPACIDADE_CAPSULA_GRAMAS;
  return Math.max(0, capacidade - Number(gramasDosInsumos || 0));
}
