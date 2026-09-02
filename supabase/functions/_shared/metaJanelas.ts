// Fatiamento do período de coleta em janelas de trabalho.
//
// Mora aqui, e não dentro da edge function, porque é o tipo de lógica que erra
// por um dia sem avisar: uma lacuna entre duas fatias deixa um buraco permanente
// na tabela, invisível até alguém somar o mês e comparar com o Gerenciador.

export const DIAS_POR_JANELA = 7;

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(base: Date, dias: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

export interface Janela {
  inicio: string;
  fim: string;
}

/**
 * Janelas cobrindo `[since, until]`, da mais recente para a mais antiga — dado
 * recente é o que alguém vai olhar primeiro, e drenar nessa ordem faz a página
 * ficar útil antes do backfill inteiro terminar.
 *
 * As fatias são contíguas: o fim de uma e o início da seguinte são dias
 * consecutivos, sem lacuna e sem sobreposição.
 */
export function janelas(since: string, until: string): Janela[] {
  const fatias: Janela[] = [];
  const limite = new Date(`${since}T00:00:00Z`);
  let fim = new Date(`${until}T00:00:00Z`);

  // Intervalo invertido devolve lista vazia em vez de girar para sempre.
  while (fim >= limite) {
    const inicio = somarDias(fim, -(DIAS_POR_JANELA - 1));
    fatias.push({ inicio: iso(inicio < limite ? limite : inicio), fim: iso(fim) });
    fim = somarDias(inicio, -1);
  }
  return fatias;
}
