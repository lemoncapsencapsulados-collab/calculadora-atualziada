/**
 * O Pedido de Compra seguindo o Orçamento para Contrato.
 *
 * Cada pedido tem o seu orçamento, e é o orçamento que manda: editar produto,
 * quantidade, fórmula ou dose lá tem de aparecer aqui. Até agora não aparecia.
 * O documento, uma vez preenchido, passava a valer sobre o autopreenchimento
 * -- é assim que ele preserva o que o consultor digitou à mão -- e com isso
 * congelava também tudo que vinha do orçamento.
 *
 * A saída não é escolher um dos dois por inteiro. É separar o documento em
 * duas metades:
 *
 *   do ORÇAMENTO   produto, quantidade, preço, apresentação, composição,
 *                  dose diária, doses por pote, quantidade por frasco
 *   da MÃO         embalagem inteira (pote, tampa, lacre, rótulo, dosador),
 *                  contrato, parcelas, endereço, prazos
 *
 * A primeira metade é reescrita a cada edição do orçamento; a segunda nunca.
 * Reescrever a embalagem apagaria escolhas que o orçamento não tem como saber;
 * não reescrever a primeira é o bug que estamos consertando.
 */

export interface EspecificacaoReconciliavel {
  produto_nome?: string;
  quantidade_por_frasco?: string;
  dose_diaria?: string;
  doses_por_pote?: string;
  composicao?: { insumo: string; dose: string }[];
  /** Escolhida à mão. Nunca vem do orçamento. */
  embalagem?: unknown;
  [k: string]: unknown;
}

export interface DocumentoReconciliavel {
  produtos?: unknown[];
  especificacoes?: EspecificacaoReconciliavel[];
  [k: string]: unknown;
}

/** Campos da especificação que o orçamento manda. */
const DO_ORCAMENTO = [
  'quantidade_por_frasco',
  'dose_diaria',
  'doses_por_pote',
  'composicao',
] as const;

const chave = (nome: unknown) => String(nome ?? '').trim().toLowerCase();

/**
 * Casa a especificação do documento salvo com a do orçamento novo.
 *
 * Pelo nome do produto. Pela posição seria mais simples e estaria errado: o
 * orçamento pode ter ganhado ou perdido um produto desde que o documento foi
 * preenchido, e aí a embalagem de um produto migraria para outro.
 */
function acharSalva(
  salvas: EspecificacaoReconciliavel[],
  nome: unknown,
): EspecificacaoReconciliavel | undefined {
  const alvo = chave(nome);
  if (!alvo) return undefined;
  return salvas.find((e) => chave(e.produto_nome) === alvo);
}

/**
 * Junta o documento salvo com o autopreenchimento do orçamento de agora.
 *
 * A lista de especificações passa a ser a do ORÇAMENTO -- produto removido lá
 * sai daqui, produto novo entra já preenchido. A embalagem de cada uma volta
 * da versão salva quando o produto continua existindo; produto novo nasce com
 * a embalagem que o autopreenchimento deduziu.
 */
export function reconciliarPedidoCompra<T extends DocumentoReconciliavel>(
  salvo: T | null | undefined,
  doOrcamento: T,
): T {
  if (!salvo) return doOrcamento;

  const salvas = Array.isArray(salvo.especificacoes) ? salvo.especificacoes : [];
  const novas = Array.isArray(doOrcamento.especificacoes) ? doOrcamento.especificacoes : [];

  const especificacoes = novas.map((nova) => {
    const antiga = acharSalva(salvas, nova.produto_nome);
    if (!antiga) return nova;

    // Começa do que estava salvo -- preserva embalagem e qualquer campo que
    // alguém acrescente no futuro sem passar por aqui -- e por cima aplica
    // só o que o orçamento manda.
    const juntas: Record<string, unknown> = { ...antiga };
    for (const campo of DO_ORCAMENTO) {
      if (nova[campo] !== undefined) juntas[campo] = nova[campo];
    }
    return juntas as (typeof novas)[number];
  });

  return {
    ...salvo,
    // Produtos, preços e quantidades vêm do orçamento: é ele que foi editado.
    produtos: doOrcamento.produtos,
    especificacoes,
  };
}

/** Mudou alguma coisa? Evita gravar e registrar histórico por nada. */
export function houveMudanca(
  antes: DocumentoReconciliavel | null | undefined,
  depois: DocumentoReconciliavel,
): boolean {
  if (!antes) return true;
  return (
    JSON.stringify(antes.produtos ?? null) !== JSON.stringify(depois.produtos ?? null) ||
    JSON.stringify(antes.especificacoes ?? null) !== JSON.stringify(depois.especificacoes ?? null)
  );
}
