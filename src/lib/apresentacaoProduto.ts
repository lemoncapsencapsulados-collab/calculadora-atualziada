/**
 * A coluna APRESENTAÇÃO do Pedido de Compra.
 *
 * Ela mostra duas coisas juntas: o tipo do produto e quanto vai no pote --
 * "Encapsulados - 60 capsulas". O tipo vem do que foi vendido; a quantidade é
 * a mesma que aparece em "Quantidade por frasco", mais abaixo no documento.
 *
 * O problema era essa quantidade estar escrita em DOIS lugares. `produtos[]`
 * guardava a apresentação inteira, montada do snapshot do orçamento no dia em
 * que o documento nasceu; `especificacoes[]` guardava a quantidade de novo, e
 * era essa que o consultor editava. Editar 60 para 30 mudava a especificação e
 * deixava a coluna em 60 -- o mesmo documento afirmando duas quantidades
 * diferentes para o mesmo produto, uma ao lado da outra.
 *
 * Aqui a coluna passa a ser derivada na hora de imprimir, a partir da
 * especificação. Deixa de haver duas versões do número: há uma, e a outra é
 * calculada dela.
 */

export interface ProdutoComApresentacao {
  descricao?: string;
  apresentacao?: string;
}

export interface EspecificacaoComQuantidade {
  produto_nome?: string;
  quantidade_por_frasco?: string;
}

/** "Encapsulados - 60 capsulas" -> "Encapsulados". */
export function tipoDaApresentacao(apresentacao: string | undefined): string {
  const texto = String(apresentacao ?? '').trim();
  if (!texto) return '';
  const corte = texto.indexOf(' - ');
  return corte >= 0 ? texto.slice(0, corte).trim() : texto;
}

/**
 * Acha a especificação do produto.
 *
 * Pelo nome primeiro, porque é o que liga os dois de verdade. O índice só
 * entra quando o nome não casa com nenhuma: as duas listas nascem do mesmo
 * `itens`, na mesma ordem, então a posição é uma pista boa -- mas só depois do
 * nome, que não depende da ordem se alguém reordenar o documento.
 */
export function acharEspecificacao<T extends EspecificacaoComQuantidade>(
  especificacoes: T[],
  produto: ProdutoComApresentacao,
  indice: number,
): T | undefined {
  if (!Array.isArray(especificacoes) || especificacoes.length === 0) return undefined;
  const nome = String(produto.descricao ?? '').trim().toLowerCase();
  if (nome) {
    const porNome = especificacoes.find(
      (e) => String(e.produto_nome ?? '').trim().toLowerCase() === nome,
    );
    if (porNome) return porNome;
  }
  return especificacoes[indice];
}

/**
 * A apresentação como ela deve sair impressa.
 *
 * A quantidade da especificação manda, porque é a que o consultor edita. Sem
 * ela -- documento antigo, campo em branco -- vale o que a apresentação já
 * dizia, em vez de imprimir só o tipo e perder a informação.
 */
export function apresentacaoDoProduto(
  produto: ProdutoComApresentacao,
  especificacao: EspecificacaoComQuantidade | undefined,
): string {
  const original = String(produto.apresentacao ?? '').trim();
  const quantidade = String(especificacao?.quantidade_por_frasco ?? '').trim();
  if (!quantidade) return original;

  const tipo = tipoDaApresentacao(original);
  return tipo ? `${tipo} - ${quantidade}` : quantidade;
}

/** Aplica a regra à lista inteira, na ordem em que ela vai para a tabela. */
export function apresentacoesDosProdutos(
  produtos: ProdutoComApresentacao[],
  especificacoes: EspecificacaoComQuantidade[],
): string[] {
  if (!Array.isArray(produtos)) return [];
  return produtos.map((p, i) =>
    apresentacaoDoProduto(p, acharEspecificacao(especificacoes ?? [], p, i)),
  );
}
