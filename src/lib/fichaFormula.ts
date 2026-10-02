/**
 * Texto da ficha de uma fórmula, para copiar e colar.
 *
 * Sai da tela e vai para WhatsApp, e-mail e documento do cliente, então é texto
 * puro, sem tabela de HTML que cola quebrada. A diagramação é feita com quebras
 * de linha e marcadores, que sobrevivem em qualquer lugar onde se cola.
 *
 * Duas versões: a DOSE DIÁRIA, que é o que o cliente pergunta ("o que tem
 * dentro"), e a FICHA COMPLETA, que acrescenta a embalagem -- o que a fábrica
 * precisa saber para montar o pote.
 *
 * Custo não entra em nenhuma das duas, de propósito: esse texto é colado em
 * conversa com cliente, e o custo da Lemon não tem por que viajar junto.
 */

import type { Formula, FormulaItem, UnitType } from '@/types/formula';
import { numeroDeDoses } from '@/lib/doseFormula';

/** Número em pt-BR, sem zero à toa: 0,5 e não 0,500. */
function numero(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 10 });
}

/**
 * Quantidade com a unidade que foi cadastrada.
 *
 * Sem converter tudo para mg: um rótulo diz "600 mcg", não "0,600 mg", e é o
 * rótulo que esse texto vai alimentar.
 */
export function quantidadeComUnidade(qtd: number, unidade: UnitType): string {
  return `${numero(qtd)} ${unidade}`;
}

/**
 * Como o conteúdo do pote se lê.
 *
 * Solúvel é gravado em mg -- 300.000 mg --, que ninguém escreve num rótulo.
 * Acima de mil vira grama.
 */
export function conteudoDoPote(formula: Partial<Formula>): string {
  const qtd = Number(formula.quantidade_por_pote) || 0;
  const tipo = formula.tipo_produto || '';

  if (tipo === 'Solúvel' || tipo === 'Líquido') {
    const emG = qtd / 1000;
    return qtd >= 1000 ? `${numero(emG)} g` : `${numero(qtd)} mg`;
  }
  if (tipo === 'Gummy') return `${numero(qtd)} gomas`;
  return `${numero(qtd)} cápsulas`;
}

/** O que uma dose é, em unidades do produto. */
export function descricaoDaDose(formula: Partial<Formula>): string {
  const porDose = Number(formula.unidades_por_dose) || 0;
  const tipo = formula.tipo_produto || '';
  if (porDose <= 0) return 'dose não informada';

  if (tipo === 'Solúvel' || tipo === 'Líquido') {
    return porDose >= 1000 ? `${numero(porDose / 1000)} g` : `${numero(porDose)} mg`;
  }
  if (tipo === 'Gummy') return porDose === 1 ? '1 goma' : `${numero(porDose)} gomas`;
  return porDose === 1 ? '1 cápsula' : `${numero(porDose)} cápsulas`;
}

function linhasDaComposicao(itens: FormulaItem[]): string[] {
  return (itens || [])
    .filter((i) => i && i.nome_insumo_snapshot)
    .map((i) => `• ${i.nome_insumo_snapshot} — ${quantidadeComUnidade(i.qtd_informada, i.unidade_informada)}`);
}

/**
 * Bloco da dose diária: a composição e a tabela nutricional.
 *
 * A tabela traz o que a legislação de rótulo traz -- porção, porções por
 * embalagem -- porque é daí que o cliente tira o texto do rótulo dele.
 */
export function textoDoseDiaria(formula: Formula): string {
  const doses = numeroDeDoses(formula.quantidade_por_pote, formula.unidades_por_dose);
  const dosesInteiras = Number.isInteger(doses) ? doses : Math.floor(doses);

  const partes: string[] = [];
  partes.push(`*${formula.nome_formula || 'Fórmula sem nome'}*`);
  partes.push(`${formula.tipo_produto || 'Produto'} · ${conteudoDoPote(formula)} por pote`);
  partes.push('');
  partes.push('*TABELA NUTRICIONAL*');
  partes.push(`Porção: ${descricaoDaDose(formula)} (1 dose)`);
  partes.push(`Porções por embalagem: ${numero(dosesInteiras)}`);
  partes.push('');
  partes.push('*COMPOSIÇÃO POR DOSE*');

  const linhas = linhasDaComposicao(formula.itens);
  if (linhas.length === 0) partes.push('• (sem matérias-primas cadastradas)');
  else partes.push(...linhas);

  return partes.join('\n');
}

/** A dose diária mais a embalagem que compõe cada pote. */
export function textoFichaCompleta(formula: Formula): string {
  const partes = [textoDoseDiaria(formula), '', '*EMBALAGEM (por pote)*'];

  const embalagens = (formula.embalagens || []).filter((e) => e && e.descricao_snapshot);
  if (embalagens.length === 0) partes.push('• (sem embalagem cadastrada)');
  else partes.push(...embalagens.map((e) => `• ${e.descricao_snapshot}`));

  return partes.join('\n');
}
