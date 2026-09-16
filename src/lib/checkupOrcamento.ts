/**
 * Checkup de orcamento: o registro de cada conversa de negociacao.
 *
 * Mora no `historico_contatos` do orcamento -- um jsonb que ja' existia para os
 * contatos simples. Os campos do checkup sao opcionais justamente porque o
 * historico antigo nao os tem: um contato sem `resultado` continua valido e
 * aparece como registro neutro na linha do tempo.
 */

import type { ContatoOrcamento, ResultadoCheckup } from '@/types/orcamento';

export const RESULTADO_LABEL: Record<ResultadoCheckup, string> = {
  positiva: 'Positiva',
  negativa: 'Negativa',
  neutra: 'Sem retorno / neutra',
};

export const RESULTADO_DESCRICAO: Record<ResultadoCheckup, string> = {
  positiva: 'Avançou: pediu ajuste, aprovou algo ou marcou próximo passo.',
  negativa: 'Travou: recusou, sumiu de vez ou escolheu concorrente.',
  neutra: 'Conversou, mas sem definição — segue em aberto.',
};

/** Cores do card por resultado. Verde avanca, vermelho trava, ambar segue aberto. */
export const RESULTADO_ESTILO: Record<
  ResultadoCheckup,
  { borda: string; fundo: string; texto: string; ponto: string }
> = {
  positiva: {
    borda: 'border-l-green-500',
    fundo: 'bg-green-50/60 dark:bg-green-950/20',
    texto: 'text-green-700 dark:text-green-400',
    ponto: 'bg-green-500',
  },
  negativa: {
    borda: 'border-l-red-500',
    fundo: 'bg-red-50/60 dark:bg-red-950/20',
    texto: 'text-red-700 dark:text-red-400',
    ponto: 'bg-red-500',
  },
  neutra: {
    borda: 'border-l-amber-500',
    fundo: 'bg-amber-50/60 dark:bg-amber-950/20',
    texto: 'text-amber-700 dark:text-amber-500',
    ponto: 'bg-amber-500',
  },
};

/** Nunca checado: cinza, sem cor de resultado. */
export const ESTILO_SEM_CHECKUP = {
  borda: 'border-l-muted-foreground/30',
  fundo: '',
  texto: 'text-muted-foreground',
  ponto: 'bg-muted-foreground/40',
};

/**
 * Objecoes mais comuns. A lista e' fechada de proposito: texto livre nao
 * agrega, e o valor desta tela e' justamente ver qual objecao mais derruba
 * negociacao. "Outro" continua aceitando descricao no proximo passo.
 */
export const OBJECOES = [
  { valor: 'preco', label: 'Preço acima do esperado' },
  { valor: 'prazo', label: 'Prazo de produção longo' },
  { valor: 'verba', label: 'Sem verba agora' },
  { valor: 'socio', label: 'Precisa consultar sócio / terceiro' },
  { valor: 'concorrencia', label: 'Está comparando com concorrente' },
  { valor: 'duvida_tecnica', label: 'Dúvida técnica sobre a fórmula' },
  { valor: 'quantidade', label: 'Quantidade mínima alta' },
  { valor: 'frete', label: 'Custo de frete' },
  { valor: 'sem_retorno', label: 'Não responde / sumiu' },
  { valor: 'mudou_projeto', label: 'Mudou o projeto' },
  { valor: 'outro', label: 'Outro' },
] as const;

export const OBJECAO_LABEL: Record<string, string> = Object.fromEntries(
  OBJECOES.map((o) => [o.valor, o.label]),
);

/** Um contato so' conta como checkup quando alguem registrou o resultado. */
export function ehCheckup(c: ContatoOrcamento): boolean {
  return !!c.resultado;
}

/** O checkup mais recente do orcamento, ou null se nunca foi checado. */
export function ultimoCheckup(historico?: ContatoOrcamento[]): ContatoOrcamento | null {
  const checkups = (historico || []).filter(ehCheckup);
  if (checkups.length === 0) return null;
  return checkups.reduce((maisNovo, c) =>
    new Date(c.data).getTime() > new Date(maisNovo.data).getTime() ? c : maisNovo,
  );
}

/** Dias desde o ultimo checkup; null quando nunca houve um. */
export function diasDesdeCheckup(historico?: ContatoOrcamento[]): number | null {
  const ultimo = ultimoCheckup(historico);
  if (!ultimo) return null;
  const ms = Date.now() - new Date(ultimo.data).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Foi checado hoje? E' o que da' a sensacao de progresso na tela. */
export function checadoHoje(historico?: ContatoOrcamento[]): boolean {
  const ultimo = ultimoCheckup(historico);
  if (!ultimo) return false;
  const d = new Date(ultimo.data);
  const hoje = new Date();
  return (
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
  );
}

export function estiloDoHistorico(historico?: ContatoOrcamento[]) {
  const ultimo = ultimoCheckup(historico);
  return ultimo?.resultado ? RESULTADO_ESTILO[ultimo.resultado] : ESTILO_SEM_CHECKUP;
}

/** Conta quantos checkups de cada resultado existem num conjunto de orcamentos. */
export function contarResultados(
  historicos: (ContatoOrcamento[] | undefined)[],
): { positiva: number; negativa: number; neutra: number; semCheckup: number } {
  const c = { positiva: 0, negativa: 0, neutra: 0, semCheckup: 0 };
  historicos.forEach((h) => {
    const u = ultimoCheckup(h);
    if (!u?.resultado) c.semCheckup += 1;
    else c[u.resultado] += 1;
  });
  return c;
}

export interface ObjecaoAgregada {
  valor: string;
  label: string;
  /** Quantas vezes essa objecao apareceu como ultima palavra do cliente. */
  quantidade: number;
  /** Fatia sobre o total de objecoes registradas, em %. */
  percentual: number;
  /** Valor em orcamento parado por essa objecao. */
  valorTravado: number;
}

/**
 * Ranking das objecoes que mais travam negociacao.
 *
 * Conta o *ultimo* checkup de cada orcamento, nao todos: o que interessa e' onde
 * a negociacao esta' parada agora. Um cliente que reclamou do preco e depois
 * aceitou nao deve continuar pesando na coluna "preco".
 */
export function rankingObjecoes(
  itens: { historico?: ContatoOrcamento[]; valor: number }[],
): ObjecaoAgregada[] {
  const mapa = new Map<string, { quantidade: number; valorTravado: number }>();
  let total = 0;

  itens.forEach(({ historico, valor }) => {
    const u = ultimoCheckup(historico);
    // So' conta o que travou: numa conversa positiva a objecao ja' foi superada.
    if (!u?.objecao || u.resultado === 'positiva') return;
    const atual = mapa.get(u.objecao) || { quantidade: 0, valorTravado: 0 };
    atual.quantidade += 1;
    atual.valorTravado += valor || 0;
    mapa.set(u.objecao, atual);
    total += 1;
  });

  return Array.from(mapa.entries())
    .map(([valor, { quantidade, valorTravado }]) => ({
      valor,
      label: OBJECAO_LABEL[valor] || valor,
      quantidade,
      percentual: total > 0 ? (quantidade / total) * 100 : 0,
      valorTravado,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}
