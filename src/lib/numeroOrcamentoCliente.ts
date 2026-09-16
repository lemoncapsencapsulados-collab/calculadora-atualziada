/**
 * Numeracao por cliente.
 *
 * A sequencia cresce por CLIENTE e conta so' os orcamentos pagos. O primeiro
 * pago do cliente vira a base -- o proprio numero dele, sem o prefixo ORC --
 * e os pagos seguintes penduram um sufixo: 400, 400-01, 400-02...
 *
 * Enquanto nao e' pago, o orcamento mantem o `ORC-xxx` da sequencia global:
 * um orcamento que nunca foi pago nao ocupa posicao nenhuma na fila do cliente.
 *
 * Acima disso fica o numero de contrato, que e' o ano e mes de criacao (YYMM).
 * Ele nao identifica o pedido; agrupa por periodo. O numero que o financeiro
 * informa continua sendo um campo proprio do Pedido de Compra.
 */

/** Numero de contrato pelo ano e mes: 14/09/2026 -> "2609". */
export function numeroContratoDoMes(data: Date = new Date()): string {
  const ano = String(data.getFullYear()).slice(-2);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${ano}${mes}`;
}

/** Tira o prefixo e deixa so' os digitos: "ORC-400" -> "400". */
export function baseDoNumero(numeroOrcamento: string | null | undefined): string {
  const bruto = (numeroOrcamento || '').trim();
  const semSufixo = bruto.split('-')[0];
  const digitos = bruto.replace(/^ORC-?/i, '').split('-')[0];
  return (digitos || semSufixo || '').trim();
}

/**
 * Monta o numero do pedido do cliente.
 * `posicao` e' a ordem entre os pagos, comecando em 0: o primeiro fica so' com
 * a base, o segundo ganha "-01", e assim por diante.
 */
export function montarNumeroCliente(base: string, posicao: number): string {
  const limpa = baseDoNumero(base);
  if (posicao <= 0) return limpa;
  return `${limpa}-${String(posicao).padStart(2, '0')}`;
}

export interface NumeroClienteParts {
  base: string;
  /** 0 para o primeiro pago; 1, 2... para os seguintes. */
  posicao: number;
}

export function parseNumeroCliente(numero: string | null | undefined): NumeroClienteParts {
  const bruto = (numero || '').trim().replace(/^ORC-?/i, '');
  const m = bruto.match(/^(\d+)-(\d+)$/);
  if (m) return { base: m[1], posicao: parseInt(m[2], 10) };
  return { base: bruto, posicao: 0 };
}

export interface OrcamentoPago {
  numero_orcamento?: string | null;
  data_pagamento?: string | null;
  created_at?: string | null;
}

/**
 * Decide o numero definitivo de um orcamento que acabou de ser pago.
 *
 * `pagosAnteriores` sao os orcamentos ja' pagos do mesmo cliente. A base vem do
 * mais antigo deles; se nao houver nenhum, este e' o primeiro e ele mesmo vira
 * a base.
 */
export function numeroAoPagar(
  numeroAtual: string,
  pagosAnteriores: OrcamentoPago[],
): string {
  if (pagosAnteriores.length === 0) return baseDoNumero(numeroAtual);

  const quando = (o: OrcamentoPago) =>
    new Date(o.data_pagamento || o.created_at || 0).getTime();
  const maisAntigo = [...pagosAnteriores].sort((a, b) => quando(a) - quando(b))[0];

  // A base e' sempre a do primeiro pago; o sufixo nao pode virar base.
  const base = parseNumeroCliente(maisAntigo.numero_orcamento).base;
  return montarNumeroCliente(base, pagosAnteriores.length);
}
