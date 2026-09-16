// Cliente da Graph API da Meta: paginação, backoff e leitura do consumo.
//
// Existe como módulo compartilhado porque a coleta em nível de anúncio precisa
// exatamente do mesmo cuidado que a de campanha — e porque nível de anúncio
// bate no limite da Meta com muito mais facilidade, já que multiplica o número
// de chamadas por uma ordem de grandeza.
//
// Nada aqui lê `Deno.env`. Configuração entra por parâmetro, e é isso que
// permite testar a lógica cara de errar (backoff, leitura de consumo) sem subir
// uma edge function.

export const GRAPH = 'https://graph.facebook.com/v19.0';

export interface ConsumoConta {
  chamadas: number;
  cpu: number;
  tempo: number;
}

/**
 * Lê o consumo da conta no cabeçalho `x-business-use-case-usage`, que a Meta
 * devolve em toda resposta com o percentual já gasto da cota.
 *
 * Devolve `null` em vez de lançar: cabeçalho ausente ou ilegível é situação
 * normal (respostas de erro costumam vir sem ele), e derrubar a coleta por
 * causa disso seria trocar uma pausa por uma falha.
 */
export function lerConsumo(headers: Headers, adAccountId: string): ConsumoConta | null {
  const bruto = headers.get('x-business-use-case-usage');
  if (!bruto) return null;

  let mapa: Record<string, Array<Record<string, unknown>>>;
  try {
    mapa = JSON.parse(bruto);
  } catch {
    return null;
  }

  // A chave do cabeçalho é o número da conta; o id que circula no código vem
  // com o prefixo `act_`.
  const chave = adAccountId.replace(/^act_/, '');
  const entrada = mapa?.[chave]?.[0];
  if (!entrada) return null;

  return {
    chamadas: Number(entrada.call_count) || 0,
    cpu: Number(entrada.total_cputime) || 0,
    tempo: Number(entrada.total_time) || 0,
  };
}

/**
 * Se algum eixo da cota passou do limite, para de puxar desta conta e deixa
 * para a próxima rodada. Sem leitura de consumo, segue em frente — inventar
 * bloqueio pararia a coleta por um cabeçalho que pode simplesmente não ter
 * vindo.
 */
export function deveEsperar(consumo: ConsumoConta | null, limite = 80): boolean {
  if (!consumo) return false;
  return consumo.chamadas >= limite || consumo.cpu >= limite || consumo.tempo >= limite;
}

/**
 * Backoff exponencial com jitter, tetado em 30s. O teto importa: a função tem
 * orçamento de tempo próprio, e dormir minutos gastaria a rodada inteira numa
 * espera em vez de devolver o trabalho para a fila.
 */
export function atrasoBackoff(tentativa: number): number {
  const base = Math.min(1000 * 2 ** Math.max(0, tentativa), 30_000);
  const jitter = Math.random() * base * 0.25;
  return Math.min(Math.round(base + jitter), 30_000);
}

/** Códigos com que a Graph sinaliza limite de chamadas. */
export function ehErroDeThrottle(erro: { code?: number } | null | undefined): boolean {
  const c = Number(erro?.code);
  if (!Number.isFinite(c)) return false;
  // 4: limite do app. 17: limite do usuário. 613: limite da chamada.
  // 80000-80006: limites específicos de Ads Insights.
  return c === 4 || c === 17 || c === 613 || (c >= 80000 && c <= 80006);
}

export interface RespostaGraph {
  linhas: unknown[];
  proxima: string | null;
  consumo: ConsumoConta | null;
}

/**
 * Uma página da Graph, com retentativa em erro de throttle. Devolve o cursor da
 * próxima em vez de percorrer tudo: quem decide se continua é o executor da
 * fila, que é o único que sabe quanto orçamento de tempo ainda resta.
 */
export async function buscarPagina(
  url: string,
  adAccountId: string,
  opcoes: { maxTentativas?: number; dormir?: (ms: number) => Promise<void> } = {}
): Promise<RespostaGraph> {
  const maxTentativas = opcoes.maxTentativas ?? 4;
  const dormir = opcoes.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let ultimoErro: Error | null = null;
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const r = await fetch(url);
    const corpo = await r.json();
    const consumo = lerConsumo(r.headers, adAccountId);

    if (r.ok) {
      return { linhas: corpo?.data ?? [], proxima: corpo?.paging?.next ?? null, consumo };
    }

    const erro = corpo?.error;
    ultimoErro = new Error(erro?.message || `Erro Graph API (${r.status})`);
    if (!ehErroDeThrottle(erro)) throw ultimoErro;
    await dormir(atrasoBackoff(tentativa));
  }
  throw ultimoErro ?? new Error('Falha ao consultar a Graph API');
}
