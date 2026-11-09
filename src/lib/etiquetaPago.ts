/**
 * Quem está marcado como pago.
 *
 * A etapa "Marcado como pago" do funil é o único número da tela que não vem de
 * julgamento da IA: alguém que estava na conversa marcou a etiqueta. Por isso
 * ela vale mais que a etapa anterior — e por isso ela zerada é pior que
 * ausente, porque o aviso amarelo passa a acusar o time de não etiquetar
 * quando o problema é de leitura.
 *
 * COMPARAÇÃO DE NOME, E NÃO IGUALDADE: a etiqueta é criada à mão, uma por
 * conta de WhatsApp. "PAGO", "pago", "PAGO ✅" e "CLIENTE PAGO" são a mesma
 * decisão comercial, e exigir que o texto bata letra por letra faz a contagem
 * cair para zero no dia em que alguém põe um emoji no nome. O que não entra é
 * a negação — "NÃO PAGO" e "AGUARDANDO PAGO" dizem o contrário.
 */

/** Linha de `zap_etiquetas`. */
export interface EtiquetaNomeada {
  instance_name: string;
  label_id: string;
  nome: string;
}

/** Linha de `zap_contato_etiquetas`: o vínculo contato ↔ etiqueta. */
export interface VinculoEtiqueta {
  instance_name: string;
  remote_jid: string;
  label_id: string;
}

/** Sem acento, em maiúsculas, com emoji e pontuação viram separador. */
export function normalizarEtiqueta(nome: string | null | undefined): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Palavras que invertem o sentido. "NÃO PAGO" não é pago; "AGUARDANDO PAGO"
 * também não. Basta uma delas no nome para a etiqueta ficar de fora.
 */
const NEGACOES = new Set(['NAO', 'SEM', 'FALTA', 'FALTOU', 'AGUARDANDO', 'PENDENTE', 'ATRASADO']);

/** As formas que contam como "pago". "PAGAMENTO" e "A PAGAR" ficam fora: são
 *  etapa do processo, não fato consumado. */
const PAGO = new Set(['PAGO', 'PAGOS', 'PAGA', 'PAGAS']);

export function ehEtiquetaPago(nome: string | null | undefined): boolean {
  const palavras = normalizarEtiqueta(nome).split(' ').filter(Boolean);
  if (!palavras.some((p) => PAGO.has(p))) return false;
  return !palavras.some((p) => NEGACOES.has(p));
}

/** As etiquetas de pagamento entre as da conta. */
export function etiquetasDePagamento(etiquetas: EtiquetaNomeada[]): EtiquetaNomeada[] {
  return (etiquetas || []).filter((e) => ehEtiquetaPago(e?.nome));
}

/**
 * Quantos CONTATOS, e não quantos vínculos.
 *
 * Uma conta pode ter mais de uma etiqueta de pagamento ("PAGO" e "PAGO ✅"
 * convivendo depois de uma renomeação), e um contato pode carregar as duas.
 * Contar linhas diria dois clientes onde há um.
 *
 * O par instância + conversa é a chave: o mesmo `remote_jid` em duas contas de
 * WhatsApp são duas conversas, com dois donos.
 */
export function contarMarcadosPago(
  etiquetas: EtiquetaNomeada[],
  vinculos: VinculoEtiqueta[],
): number {
  const pagas = new Set(
    etiquetasDePagamento(etiquetas).map((e) => `${e.instance_name}|${e.label_id}`),
  );
  if (pagas.size === 0) return 0;
  const contatos = new Set<string>();
  for (const v of vinculos || []) {
    if (!v?.remote_jid) continue;
    if (!pagas.has(`${v.instance_name}|${v.label_id}`)) continue;
    contatos.add(`${v.instance_name}|${v.remote_jid}`);
  }
  return contatos.size;
}
