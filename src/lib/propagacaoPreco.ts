/**
 * Quem pode ser reescrito quando um produto precificado muda.
 *
 * Editar matéria-prima ou embalagem muda o custo, e o custo muda o preço. Os
 * documentos que ainda estão em negociação devem acompanhar -- senão o
 * consultor manda ao cliente um orçamento que o sistema já não sustenta.
 *
 * Os que já foram fechados, não. Um orçamento pago virou nota; um pedido
 * aprovado ou com contrato assinado virou compromisso com assinatura de duas
 * partes. Reescrever o valor deles depois faria o PDF que o cliente guardou
 * divergir do que o sistema mostra, sem que ninguém tenha combinado nada --
 * e a divergência só apareceria numa cobrança ou numa auditoria.
 *
 * Por isso a regra mora aqui, isolada e testada, em vez de virar um `if` no
 * meio da gravação: é a fronteira entre atualizar e adulterar.
 */

/** Orçamento ainda em negociação. */
const ORCAMENTO_ABERTO = ['rascunho', 'enviado'] as const;

/**
 * Pedido ainda sem assinatura.
 *
 * Só este. `pre_aprovado` e `aprovado` já passaram pelo cliente, e pedido
 * antigo -- sem `status_aprovacao`, de antes do fluxo de assinatura -- fica de
 * fora também: não dá para saber em que pé está, e na dúvida não se mexe no
 * preço de uma venda que já existe.
 */
const PEDIDO_ABERTO = ['pendente_assinatura'] as const;

export interface OrcamentoParaPropagar {
  id: string;
  status?: string | null;
  /** Contrato gerado a partir deste orçamento já foi assinado. */
  contrato_assinado_em?: string | null;
  /** Contrato já foi para o ZapSign e pode estar sendo assinado agora. */
  contrato_enviado_em?: string | null;
  itens_producao?: unknown;
  subtotal_servicos?: number | null;
}

export interface PedidoParaPropagar {
  id: string;
  status?: string | null;
  status_aprovacao?: string | null;
  contrato_assinado_em?: string | null;
  orcamento_snapshot?: { itens_producao?: unknown } | null;
  /** Documento do Pedido de Compra, quando já foi preenchido. */
  pedido_compra_dados?: unknown;
}

export function orcamentoEstaAberto(orc: OrcamentoParaPropagar): boolean {
  // O contrato tranca antes do status. Um orçamento segue "enviado" depois de
  // virar contrato, e o contrato é que o cliente assina -- mudar o preço por
  // baixo dele faria o papel na mão dele divergir do sistema.
  //
  // `contrato_enviado_em` tranca junto: foi para o ZapSign e pode estar sendo
  // assinado neste momento. Reescrever durante a assinatura é o pior caso --
  // ninguém saberia qual das duas versões foi assinada.
  if (orc.contrato_assinado_em || orc.contrato_enviado_em) return false;
  const s = String(orc.status ?? '').trim().toLowerCase();
  return (ORCAMENTO_ABERTO as readonly string[]).includes(s);
}

export function pedidoEstaAberto(ped: PedidoParaPropagar): boolean {
  // Contrato assinado tranca antes de qualquer outra coisa: a data existir já
  // basta, independente do status -- houve assinatura.
  if (ped.contrato_assinado_em) return false;
  const aprovacao = String(ped.status_aprovacao ?? '').trim().toLowerCase();
  if (!(PEDIDO_ABERTO as readonly string[]).includes(aprovacao)) return false;
  // Pago é pago, mesmo que a assinatura não tenha sido registrada.
  const status = String(ped.status ?? '').trim().toLowerCase();
  return status !== 'pago' && status !== 'cancelado';
}

/** Os itens do documento usam esta precificação? */
export function usaPrecificacao(itens: unknown, precificacaoId: string): boolean {
  if (!Array.isArray(itens) || !precificacaoId) return false;
  return itens.some(
    (i) => i && typeof i === 'object' && (i as { precificacao_id?: string }).precificacao_id === precificacaoId,
  );
}

export interface Selecao<T> {
  /** Vão ser atualizados. */
  atualizar: T[];
  /** Usam o produto, mas estão fechados. Ficam como estão. */
  travados: T[];
}

/**
 * Separa os orçamentos que usam a precificação entre os que se atualizam e os
 * que não. Devolver os dois, e não só a lista a atualizar, é o que permite
 * registrar no histórico que eles ficaram para trás de propósito.
 */
export function selecionarOrcamentos<T extends OrcamentoParaPropagar>(
  orcamentos: T[],
  precificacaoId: string,
): Selecao<T> {
  const usam = orcamentos.filter((o) => usaPrecificacao(o.itens_producao, precificacaoId));
  return {
    atualizar: usam.filter(orcamentoEstaAberto),
    travados: usam.filter((o) => !orcamentoEstaAberto(o)),
  };
}

export function selecionarPedidos<T extends PedidoParaPropagar>(
  pedidos: T[],
  precificacaoId: string,
): Selecao<T> {
  const usam = pedidos.filter((p) =>
    usaPrecificacao(p.orcamento_snapshot?.itens_producao, precificacaoId),
  );
  return {
    atualizar: usam.filter(pedidoEstaAberto),
    travados: usam.filter((p) => !pedidoEstaAberto(p)),
  };
}

/** Uma linha de histórico, gravada no documento atualizado. */
export interface RegistroPropagacao {
  atualizado_em: string;
  /** Qual produto precificado disparou. */
  precificacao_id: string;
  nome_produto?: string;
  valor_anterior: number;
  valor_novo: number;
  /** Em texto, o que mudou no custo. Vem de `motivosDaMudanca`. */
  motivos?: string[];
  origem: 'edicao_produto';
}

export function registroDaPropagacao(entrada: {
  precificacaoId: string;
  nomeProduto?: string;
  valorAnterior: number;
  valorNovo: number;
  motivos?: string[];
}): RegistroPropagacao {
  return {
    atualizado_em: new Date().toISOString(),
    precificacao_id: entrada.precificacaoId,
    nome_produto: entrada.nomeProduto,
    valor_anterior: entrada.valorAnterior,
    valor_novo: entrada.valorNovo,
    motivos: entrada.motivos?.length ? entrada.motivos : undefined,
    origem: 'edicao_produto',
  };
}
