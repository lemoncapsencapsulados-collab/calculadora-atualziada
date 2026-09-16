/**
 * Numeracao do Pedido de Compra.
 *
 * O formato definitivo e' `{numero_contrato}-{sequencial}` -- por exemplo
 * `260922-4`, o quarto pedido do produtor sob o contrato 260922. O numero do
 * contrato vem do financeiro e e' digitado pelo consultor; o sequencial e'
 * calculado pelo sistema a partir de quantos pedidos aquele CNPJ ja teve.
 *
 * Pedidos antigos usam a sequencia global `PED-001`, que nao carrega contrato
 * nenhum. Esses ficam marcados como incompletos ate' serem vinculados.
 */

export interface NumeroPedidoParts {
  /** Numero do contrato de fabricacao, quando o numero do pedido carrega um. */
  numeroContrato: string | null;
  /** Sequencial do pedido dentro do produtor (os digitos finais). */
  sequencial: number | null;
  /** Falso quando nao ha contrato vinculado -- o pedido nao pode ser aprovado. */
  completo: boolean;
}

export const MSG_PEDIDO_INCOMPLETO = 'Pedido incompleto, faltando número de contrato';

/** Um contrato e' uma sequencia de digitos; `PED` e afins nao contam. */
const CONTRATO_RE = /^(\d+)-(\d+)$/;
/** Fallback de ordenacao: os digitos finais de qualquer formato. */
const SEQUENCIAL_RE = /(\d+)\s*$/;

export function parseNumeroPedido(numero: string | null | undefined): NumeroPedidoParts {
  const raw = (numero || '').trim();

  const comContrato = raw.match(CONTRATO_RE);
  if (comContrato) {
    return {
      numeroContrato: comContrato[1],
      sequencial: parseInt(comContrato[2], 10),
      completo: true,
    };
  }

  const soSequencial = raw.match(SEQUENCIAL_RE);
  return {
    numeroContrato: null,
    sequencial: soSequencial ? parseInt(soSequencial[1], 10) : null,
    completo: false,
  };
}

/**
 * Ordena pedidos pelos digitos finais do numero. Quem nao tem numero legivel
 * cai para o fim da lista, na ordem em que veio.
 */
export function compararPorSequencial(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const sa = parseNumeroPedido(a).sequencial;
  const sb = parseNumeroPedido(b).sequencial;
  if (sa === null && sb === null) return 0;
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sa - sb;
}

/**
 * Monta o numero do proximo pedido de um produtor.
 * `pedidosDoCnpj` e' quantos pedidos aquele CNPJ ja tem -- o novo entra como o
 * proximo da fila (3 pedidos existentes => `-4`).
 */
export function montarNumeroPedido(numeroContrato: string, pedidosDoCnpj: number): string {
  return `${numeroContrato.trim()}-${pedidosDoCnpj + 1}`;
}
