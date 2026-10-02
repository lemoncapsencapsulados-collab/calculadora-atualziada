/**
 * Desempenho comercial de cada vendedor, mês a mês.
 *
 * Serve a duas conversas diferentes, e por isso tem dois recortes:
 *
 *  - a conversa com UM vendedor, em que o que importa é ele contra ele mesmo:
 *    o que melhorou e o que piorou em relação ao mês anterior;
 *  - a conversa de gestão, em que o que importa é um contra o outro no mesmo
 *    período.
 *
 * Comparar vendedor com vendedor sem olhar a evolução de cada um premia quem
 * começou bem e esconde quem está subindo; olhar só a evolução esconde quem
 * melhorou pouco partindo de um patamar ruim. Os dois recortes existem porque
 * nenhum dos dois sozinho sustenta a conversa.
 */

/** Uma métrica do painel, com o nome por extenso e o que ela quer dizer. */
export interface Metrica {
  chave: keyof ResultadoMes;
  nome: string;
  /** O que é, em uma frase, para ninguém precisar adivinhar. */
  explicacao: string;
  /** Dinheiro ou contagem -- muda o jeito de formatar. */
  formato: 'moeda' | 'numero' | 'percentual';
  /** Em quase tudo subir é bom; onde não for, isto diz. */
  subirEBom: boolean;
}

export interface ResultadoMes {
  /** AAAA-MM */
  mes: string;
  leads: number;
  orcamentos: number;
  valorPrimeirasVendas: number;
  valorRecompras: number;
  vendasNovas: number;
  recompras: number;
}

/**
 * O glossário. O pedido foi explícito: toda sigla ou termo criado aqui vem com
 * explicação, porque o painel vai ser lido na frente do vendedor e uma métrica
 * que ninguém entende vira discussão sobre a métrica, não sobre o trabalho.
 */
export const METRICAS: Metrica[] = [
  {
    chave: 'leads',
    nome: 'Leads recebidos',
    explicacao: 'Pessoas novas que falaram com este vendedor no WhatsApp no mês.',
    formato: 'numero',
    subirEBom: true,
  },
  {
    chave: 'orcamentos',
    nome: 'Orçamentos gerados',
    explicacao: 'Orçamentos que o vendedor montou no mês, pagos ou não.',
    formato: 'numero',
    subirEBom: true,
  },
  {
    chave: 'vendasNovas',
    nome: 'Vendas novas',
    explicacao: 'Quantos orçamentos de cliente novo foram pagos no mês.',
    formato: 'numero',
    subirEBom: true,
  },
  {
    chave: 'valorPrimeirasVendas',
    nome: 'Valor em vendas novas',
    explicacao: 'Soma dos orçamentos de cliente novo pagos no mês.',
    formato: 'moeda',
    subirEBom: true,
  },
  {
    chave: 'recompras',
    nome: 'Recompras',
    explicacao: 'Quantos orçamentos de recompra foram pagos no mês.',
    formato: 'numero',
    subirEBom: true,
  },
  {
    chave: 'valorRecompras',
    nome: 'Valor em recompras',
    explicacao: 'Soma dos orçamentos de recompra pagos no mês.',
    formato: 'moeda',
    subirEBom: true,
  },
];

/** Indicadores que saem de uma conta sobre os números acima. */
export const INDICADORES_DERIVADOS = [
  {
    nome: 'Taxa de conversão',
    sigla: 'TC',
    explicacao:
      'De cada 100 orçamentos que o vendedor montou, quantos foram pagos. ' +
      'Mede o fechamento, não o esforço: 10 orçamentos com 5 pagos vale mais que 40 com 5.',
  },
  {
    nome: 'Ticket médio',
    sigla: 'TM',
    explicacao:
      'Quanto vale, em média, cada venda fechada. Sobe quando o vendedor leva ' +
      'o cliente a um pedido maior, não só quando vende mais vezes.',
  },
  {
    nome: 'Participação em recompra',
    sigla: '% recompra',
    explicacao:
      'Quanto do dinheiro que ele trouxe veio de cliente que já comprava. ' +
      'Alto demais pode significar pouca prospecção; baixo demais, cliente que não volta.',
  },
] as const;

export type Tendencia = 'melhorou' | 'piorou' | 'estavel' | 'sem_base';

/** Abaixo disso é oscilação normal, não mudança de comportamento. */
const LIMITE_ESTAVEL = 0.05;

export interface Variacao {
  atual: number;
  anterior: number;
  /** Diferença absoluta. */
  diferenca: number;
  /** Variação relativa; `null` quando não havia base para comparar. */
  percentual: number | null;
  tendencia: Tendencia;
}

/**
 * Compara um mês com o anterior.
 *
 * Mês sem base -- o primeiro do vendedor -- devolve `sem_base` em vez de 100%:
 * sair de zero não é crescer, é começar, e mostrar "+100%" na frente do
 * vendedor é uma conversa que começa errada.
 */
export function compararMes(atual: number, anterior: number, subirEBom = true): Variacao {
  const diferenca = atual - anterior;

  if (!anterior) {
    return {
      atual,
      anterior,
      diferenca,
      percentual: null,
      tendencia: atual > 0 ? 'sem_base' : 'estavel',
    };
  }

  const percentual = diferenca / Math.abs(anterior);
  let tendencia: Tendencia = 'estavel';
  if (Math.abs(percentual) >= LIMITE_ESTAVEL) {
    const subiu = diferenca > 0;
    tendencia = subiu === subirEBom ? 'melhorou' : 'piorou';
  }

  return { atual, anterior, diferenca, percentual, tendencia };
}

export function taxaConversao(r: ResultadoMes): number {
  if (!r.orcamentos) return 0;
  return ((r.vendasNovas + r.recompras) / r.orcamentos) * 100;
}

export function ticketMedio(r: ResultadoMes): number {
  const vendas = r.vendasNovas + r.recompras;
  if (!vendas) return 0;
  return (r.valorPrimeirasVendas + r.valorRecompras) / vendas;
}

export function participacaoRecompra(r: ResultadoMes): number {
  const total = r.valorPrimeirasVendas + r.valorRecompras;
  if (!total) return 0;
  return (r.valorRecompras / total) * 100;
}

export interface DesempenhoVendedor {
  vendedor: string;
  meses: ResultadoMes[];
}

/** Resumo do mês de um vendedor contra o mês anterior dele. */
export interface LeituraDoMes {
  mes: string;
  resultado: ResultadoMes;
  variacoes: Partial<Record<keyof ResultadoMes, Variacao>>;
  melhorou: string[];
  piorou: string[];
}

/**
 * A leitura que se leva para a conversa: o que subiu e o que caiu, por nome.
 *
 * Devolve nome de métrica, não chave: quem lê é gente, e "valorPrimeirasVendas"
 * não é uma frase que se diz em voz alta.
 */
export function lerMes(meses: ResultadoMes[], indice: number): LeituraDoMes | null {
  const resultado = meses[indice];
  if (!resultado) return null;
  const anterior = meses[indice - 1];

  const variacoes: Partial<Record<keyof ResultadoMes, Variacao>> = {};
  const melhorou: string[] = [];
  const piorou: string[] = [];

  for (const m of METRICAS) {
    const v = compararMes(
      Number(resultado[m.chave]) || 0,
      Number(anterior?.[m.chave]) || 0,
      m.subirEBom,
    );
    variacoes[m.chave] = v;
    if (v.tendencia === 'melhorou') melhorou.push(m.nome);
    if (v.tendencia === 'piorou') piorou.push(m.nome);
  }

  return { mes: resultado.mes, resultado, variacoes, melhorou, piorou };
}

/** Rótulo do mês em português: "setembro de 2026". */
const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function nomeDoMes(mes: string): string {
  const [ano, m] = (mes || '').split('-');
  const i = Number(m) - 1;
  if (!ano || i < 0 || i > 11) return mes || '—';
  return `${MESES_PT[i]} de ${ano}`;
}
