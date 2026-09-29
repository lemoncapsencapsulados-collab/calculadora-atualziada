/**
 * Prazo de validade do preço de um orçamento ou pedido de compra.
 *
 * O preço combinado vale por 5 dias corridos. Dentro da janela o cliente tem o
 * valor garantido mesmo que matéria-prima, embalagem, imposto ou markup mudem
 * nesse meio-tempo -- foi o que se prometeu. Passado o prazo, a negociação
 * continua, mas com o preço de hoje: quem recalcula é o consultor, de propósito,
 * para que ele veja o que mudou antes de falar com o cliente.
 *
 * Quem já fechou não entra nessa conta. Reprecificar um pedido pago mudaria um
 * valor que já virou nota fiscal.
 */

/** Dias corridos que o preço combinado fica garantido. */
export const PRAZO_RECALCULO_DIAS = 5;

/**
 * Status em que o preço não se mexe mais.
 *
 * `pago` e `aprovado` já viraram compromisso; `recusado` e `cancelado` não vão
 * a lugar nenhum, e ficar cobrando recálculo deles só gera alarme falso na tela.
 */
export const STATUS_PRECO_TRAVADO = ['aprovado', 'pago', 'cancelado', 'recusado'] as const;

export interface EntradaPrazo {
  status?: string | null;
  /** Quando o orçamento/pedido foi criado. */
  criadoEm?: string | Date | null;
  /** Último recálculo, se houve. Reinicia a janela. */
  recalculadoEm?: string | Date | null;
}

export interface SituacaoPrazo {
  /** Preço já fechado: não se recalcula. */
  travado: boolean;
  /** Dias inteiros que ainda restam. Negativo quando já venceu. */
  diasRestantes: number;
  vencido: boolean;
  /** Último dia em que o preço combinado vale. */
  venceEm: Date | null;
  /** De quando a janela conta -- criação ou último recálculo. */
  contaDe: Date | null;
}

const UM_DIA = 24 * 60 * 60 * 1000;

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Meia-noite local. Dias CORRIDOS se contam por data virada, não por 24 h: um
 * orçamento feito às 23h de segunda vence junto com um feito às 8h da mesma
 * segunda, que é como o consultor conta ao falar com o cliente.
 */
function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function situacaoPrazo(entrada: EntradaPrazo, agora: Date = new Date()): SituacaoPrazo {
  const travado = STATUS_PRECO_TRAVADO.includes(
    String(entrada.status || '').toLowerCase() as (typeof STATUS_PRECO_TRAVADO)[number],
  );

  // O recálculo reinicia a janela: o preço novo também vale 5 dias.
  const contaDe = paraData(entrada.recalculadoEm) ?? paraData(entrada.criadoEm);
  if (travado || !contaDe) {
    return { travado, diasRestantes: 0, vencido: false, venceEm: null, contaDe };
  }

  const decorridos = Math.floor((inicioDoDia(agora) - inicioDoDia(contaDe)) / UM_DIA);
  const diasRestantes = PRAZO_RECALCULO_DIAS - decorridos;
  const venceEm = new Date(inicioDoDia(contaDe) + PRAZO_RECALCULO_DIAS * UM_DIA);

  return { travado: false, diasRestantes, vencido: diasRestantes < 0, venceEm, contaDe };
}

/** Texto do aviso, do jeito que aparece no card. */
export function avisoPrazo(s: SituacaoPrazo, tipo: 'orcamento' | 'pedido'): string | null {
  if (s.travado || !s.contaDe) return null;
  const alvo = tipo === 'pedido' ? 'o Pedido de Compra' : 'o Orçamento';

  if (s.vencido) {
    const dias = Math.abs(s.diasRestantes);
    return `Prazo de preço vencido há ${dias} ${dias === 1 ? 'dia' : 'dias'} — recalcule ${alvo}`;
  }
  if (s.diasRestantes === 0) return `Último dia do preço combinado — recalcule ${alvo} amanhã`;
  if (s.diasRestantes === 1) return `1 dia para o preço vencer`;
  return `${s.diasRestantes} dias para o preço vencer`;
}

/** Quanto falta pesa na cor: vermelho quando venceu, âmbar na véspera. */
export type TomPrazo = 'neutro' | 'atencao' | 'vencido';

export function tomDoPrazo(s: SituacaoPrazo): TomPrazo {
  if (s.travado || !s.contaDe) return 'neutro';
  if (s.vencido) return 'vencido';
  return s.diasRestantes <= 1 ? 'atencao' : 'neutro';
}

export const CLASSES_PRAZO: Record<TomPrazo, string> = {
  neutro: 'text-muted-foreground',
  atencao: 'text-amber-700 dark:text-amber-500',
  vencido: 'text-red-700 dark:text-red-400',
};

/** Moldura do card quando o preço venceu: o card inteiro fica vermelho. */
export const BORDA_PRAZO: Record<TomPrazo, string> = {
  neutro: '',
  atencao: 'border-amber-400/70 dark:border-amber-700',
  vencido: 'border-red-500/70 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20',
};
