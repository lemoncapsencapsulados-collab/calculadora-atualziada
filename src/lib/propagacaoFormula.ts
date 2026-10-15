/**
 * A formulação alcançando os documentos, não só o preço.
 *
 * Editar uma matéria-prima de 149 mcg para 49 mcg mudava o preço nos
 * orçamentos em negociação -- e deixava a dose antiga em todos eles. O preço
 * vem da precificação, que é relida; a composição vem de um instantâneo
 * gravado dentro de cada documento no dia em que ele nasceu, e esse ninguém
 * relia.
 *
 * São três instantâneos em série, e todos precisam andar juntos:
 *
 *   formulas.itens                                    (a fórmula de verdade)
 *     └─ orcamento.itens_producao[].insumos_formula   (no orçamento)
 *         └─ pedido.orcamento_snapshot.…              (no pedido)
 *             └─ pedido_compra_dados.especificacoes[].composicao
 *                                                     (no documento preenchido)
 *
 * O último é o que o Wesley viu desatualizado: o Pedido de Compra, uma vez
 * preenchido, passa a valer sobre o autopreenchimento -- é o que preserva o
 * que o consultor digitou à mão. Então ele não se corrige sozinho ao reabrir;
 * precisa ser reescrito aqui, e só na parte que veio da fórmula.
 */

export interface InsumoSnapshot {
  nome: string;
  quantidade: number;
  unidade: string;
}

/** Item da fórmula como `formulas.itens` guarda. */
export interface ItemDeFormula {
  nome_insumo_snapshot?: string;
  qtd_informada?: number;
  unidade_informada?: string;
}

/**
 * Converte a fórmula no instantâneo que os documentos carregam.
 *
 * Mesmo mapeamento que o Gerar Orçamento faz ao criar o orçamento. Mora aqui
 * para os dois caminhos -- criar e atualizar -- não divergirem: se o de criar
 * mudasse e o de atualizar não, uma fórmula editada passaria a ser gravada
 * diferente da original, e a diferença apareceria como "mudou" para sempre.
 */
export function insumosDaFormula(itens: unknown): InsumoSnapshot[] {
  if (!Array.isArray(itens)) return [];
  return itens
    .filter((i): i is ItemDeFormula => !!i && typeof i === 'object')
    .map((i) => ({
      nome: String(i.nome_insumo_snapshot ?? ''),
      quantidade: Number(i.qtd_informada) || 0,
      unidade: String(i.unidade_informada ?? ''),
    }))
    .filter((i) => i.nome.trim().length > 0);
}

/** "49 mcg" -- vírgula decimal, como o documento escreve. */
export function doseEmTexto(insumo: InsumoSnapshot): string {
  const qtd = Number(insumo.quantidade);
  if (!Number.isFinite(qtd)) return '';
  return `${String(qtd).replace('.', ',')} ${insumo.unidade}`.trim();
}

export interface AtivoFormula {
  insumo: string;
  dose: string;
}

/** A composição do Pedido de Compra, a partir do instantâneo da fórmula. */
export function composicaoDosInsumos(insumos: InsumoSnapshot[]): AtivoFormula[] {
  return insumos.map((i) => ({ insumo: i.nome, dose: doseEmTexto(i) }));
}

/** Troca `insumos_formula` dos itens que usam esta precificação. */
export function atualizarInsumosDosItens<T extends Record<string, unknown>>(
  itens: T[],
  precificacaoId: string,
  insumos: InsumoSnapshot[],
): T[] {
  if (!Array.isArray(itens)) return [];
  return itens.map((item) =>
    item?.precificacao_id === precificacaoId ? { ...item, insumos_formula: insumos } : item,
  );
}

export interface EspecificacaoParaAtualizar {
  produto_nome?: string;
  composicao?: AtivoFormula[];
  [k: string]: unknown;
}

/**
 * Reescreve a composição das especificações do produto editado.
 *
 * Só `composicao`, e só das que casam pelo nome do produto. Todo o resto do
 * documento -- material do pote, cor da tampa, lacre, quantidade de rótulo --
 * foi escolhido à mão pelo consultor, e sobrescrever isso apagaria o trabalho
 * dele por causa de uma troca de dosagem.
 *
 * Nome que não casa não vira alteração. É uma falha silenciosa de propósito:
 * inventar um casamento por posição, quando o documento tem produto a mais ou
 * a menos que o orçamento, trocaria a composição de um produto pela de outro.
 */
export function atualizarComposicao<T extends EspecificacaoParaAtualizar>(
  especificacoes: T[],
  nomeProduto: string,
  composicao: AtivoFormula[],
): { especificacoes: T[]; alteradas: number } {
  if (!Array.isArray(especificacoes)) return { especificacoes: [], alteradas: 0 };
  const alvo = nomeProduto.trim().toLowerCase();
  if (!alvo) return { especificacoes, alteradas: 0 };

  let alteradas = 0;
  const novas = especificacoes.map((esp) => {
    if (String(esp.produto_nome ?? '').trim().toLowerCase() !== alvo) return esp;
    if (mesmaComposicao(esp.composicao, composicao)) return esp;
    alteradas++;
    return { ...esp, composicao };
  });
  return { especificacoes: novas, alteradas };
}

/** Evita gravar quando nada mudou -- e evita uma linha de histórico vazia. */
export function mesmaComposicao(
  a: AtivoFormula[] | undefined,
  b: AtivoFormula[] | undefined,
): boolean {
  const x = a ?? [];
  const y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every((item, i) => item.insumo === y[i].insumo && item.dose === y[i].dose);
}

/** Os insumos mudaram de verdade? Compara nome, quantidade e unidade. */
export function mesmosInsumos(
  a: InsumoSnapshot[] | undefined,
  b: InsumoSnapshot[] | undefined,
): boolean {
  const x = a ?? [];
  const y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every(
    (i, idx) =>
      i.nome === y[idx].nome &&
      Number(i.quantidade) === Number(y[idx].quantidade) &&
      i.unidade === y[idx].unidade,
  );
}
