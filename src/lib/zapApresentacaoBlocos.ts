/**
 * Blocos da apresentação, derivados do payload gravado.
 *
 * PDF e PPTX consomem ESTA função, nunca o payload direto. É o que garante o
 * critério de aceite da especificação: os dois formatos saem com números
 * idênticos. Se cada renderizador fizesse sua própria leitura, bastaria um
 * arredondar diferente para o relatório e o slide discordarem — e aí ninguém
 * confia em nenhum dos dois.
 *
 * Nenhum cálculo aqui. Toda taxa já vem pronta do agregador; este módulo só
 * escolhe o que mostrar e em que ordem.
 */

export interface Payload {
  metrics: any;
  relatorio: any;
}

export interface Apresentacao {
  id: string;
  consultor_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  versao: number;
  gerado_em: string;
  base_conversas: number;
  cobertura_analise_pct: number | null;
  score_geral: number | null;
  payload_json: Payload;
  validacao_orfaos: string[];
}

/**
 * `legendas` explica as siglas DAQUELE bloco, no próprio bloco.
 *
 * Um glossário no fim do documento não resolve: o slide circula sozinho, é
 * projetado isolado, e quem lê "n=357" ou "82,7%" precisa da definição ali, não
 * dez páginas adiante. Sigla sem definição ou é ignorada ou é mal interpretada.
 */
export type Bloco =
  | { tipo: 'capa'; titulo: string; linhas: string[]; selos: string[] }
  | { tipo: 'gauge'; titulo: string; valor: number; legenda: string; eixos: Eixo[]; legendas?: string[] }
  | {
      tipo: 'tabela';
      titulo: string;
      colunas: string[];
      linhas: string[][];
      nota?: string;
      /**
       * Proporção de cada coluna (soma livre; o renderizador normaliza).
       * Sem isso o autoTable divide o espaço pelo conteúdo e espreme a coluna
       * mais importante quando outra tem uma célula longa.
       */
      larguras?: number[];
      legendas?: string[];
    }
  | { tipo: 'funil'; titulo: string; etapas: EtapaFunil[]; nota?: string; legendas?: string[] }
  | { tipo: 'cards'; titulo: string; cards: CardBloco[]; legendas?: string[] }
  | { tipo: 'texto'; titulo: string; texto: string; legendas?: string[] };

export interface Eixo {
  nome: string;
  valor: number | null;
  peso: number;
  n: number;
  indisponivel?: string;
}
export interface EtapaFunil {
  etapa: string;
  valor: number;
  conv: number | null;
  queda: number;
}
export interface CardBloco {
  titulo: string;
  metrica: string;
  valor: string;
  leitura: string;
  custo?: string;
}

const ROTULO_ETAPA: Record<string, string> = {
  contatos: 'Contatos com conversa',
  consultor_falou: 'Consultor abordou',
  cliente_respondeu: 'Cliente respondeu',
  recebeu_link: 'Recebeu catálogo ou link',
  reuniao: 'Chegou a reunião',
  proposta: 'Proposta enviada',
  fechado: 'Fechado',
};

const ROTULO_PERFIL: Record<string, string> = {
  produtor_ativo: 'Produtor ativo',
  produtor_migracao: 'Produtor migrando',
  empreendedor_qualificado: 'Empreendedor qualificado',
  aspirante_inicial: 'Aspirante inicial',
  revendedor_pronto: 'Quer revender pronto',
  especulador: 'Especulador',
  fornecedor_ou_interno: 'Fornecedor ou interno',
  fora_de_perfil: 'Fora de perfil',
  nao_classificado: 'Não classificado',
};

const seg = (s: number | null | undefined): string => {
  if (s == null) return '—';
  const v = Number(s);
  if (v < 60) return `${Math.round(v)}s`;
  if (v < 3600) return `${Math.round(v / 60)} min`;
  if (v < 86400) return `${(v / 3600).toFixed(1)} h`;
  return `${(v / 86400).toFixed(1)} d`;
};

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** `n` sempre junto do número: taxa sem base convida a conclusão que o dado não sustenta. */
const comBase = (valor: string, n: number | null | undefined) =>
  n == null ? valor : `${valor}  (n=${n})`;

const LEG_BASE = 'Base (n) = quantos casos sustentam o número. Uma taxa sobre n=4 e outra sobre n=400 parecem iguais e não são.';
const LEG_MEDIANA = 'Mediana = o valor do meio: metade dos casos ficou abaixo, metade acima. Não se desloca por um caso extremo.';
const LEG_P90 = 'p90 = o tempo dos 10% mais lentos. É quem está sendo abandonado — a mediana nunca mostra isso.';
const LEG_P99 = 'p99 = o tempo do 1% pior, para dimensionar o pior caso real.';

export function blocosDaApresentacao(a: Apresentacao): Bloco[] {
  const m = a.payload_json?.metrics ?? {};
  const r = a.payload_json?.relatorio ?? {};
  const t = m.taxas ?? {};
  const blocos: Bloco[] = [];

  // Cobertura abaixo de 90% vira selo impresso, não nota de rodapé. Relatório
  // que parece completo sendo cego é pior que relatório que declara o buraco.
  const selos: string[] = [];
  const cob = a.cobertura_analise_pct;
  if (cob != null && cob < 90) selos.push(`COBERTURA PARCIAL — ${cob}% das conversas analisadas`);
  if (a.validacao_orfaos?.length) {
    selos.push(`${a.validacao_orfaos.length} número(s) do texto sem origem nas métricas`);
  }

  blocos.push({
    tipo: 'capa',
    titulo: a.consultor_nome,
    linhas: [
      `Período: ${data(a.periodo_inicio)} a ${data(a.periodo_fim)}`,
      `Base analisada: ${a.base_conversas} contatos`,
      `Conversas avaliadas: ${m.base?.analisadas ?? '—'} (${cob ?? '—'}%)`,
      `Gerado em ${new Date(a.gerado_em).toLocaleString('pt-BR')} · versão ${a.versao}`,
    ],
    selos,
  });

  const score = m.score ?? {};
  blocos.push({
    tipo: 'gauge',
    titulo: 'Score de atendimento',
    valor: Number(score.total ?? 0),
    legenda: r.veredito ?? '',
    eixos: (['velocidade', 'diagnostico', 'clareza_oferta', 'tratamento_objecao', 'proximo_passo', 'consistencia_tom'] as const)
      .map((k) => ({
        nome: k.replace(/_/g, ' '),
        valor: score[k]?.valor ?? null,
        peso: score[k]?.peso ?? 0,
        n: score[k]?.n ?? 0,
        indisponivel: score[k]?.indisponivel,
      })),
    legendas: [
      'Valor = desempenho do eixo, de 0 a 100.',
      'Peso = quanto aquele eixo vale no score final. A soma dos pesos medidos é 100.',
      LEG_BASE,
      'Consistência de tom aparece como não medido e com peso 0: exigiria classificar cada resposta uma a uma. O score é normalizado sobre os cinco eixos medidos.',
    ],
  });

  blocos.push({
    tipo: 'tabela',
    titulo: 'Velocidade de resposta',
    colunas: ['Indicador', 'Valor', 'Base'],
    linhas: [
      ['Até a 1ª resposta (mediana)', seg(m.velocidade?.tmr1_p50_seg), `${m.velocidade?.tmr1_n ?? 0} conversas`],
      ['Até a 1ª resposta (p90)', seg(m.velocidade?.tmr1_p90_seg), 'a cauda que perde cliente'],
      ['Pior caso registrado', seg(m.velocidade?.tmr1_pior_seg), ''],
      ['Durante a conversa (mediana)', seg(m.velocidade?.fluxo_p50_seg), `${m.velocidade?.fluxo_n ?? 0} respostas`],
      ['Durante a conversa (p90)', seg(m.velocidade?.fluxo_p90_seg), ''],
      ['O cliente responde em', seg(m.velocidade?.cliente_p50_seg), `${m.velocidade?.cliente_n ?? 0} respostas`],
      ['Dentro de 15 minutos', `${m.velocidade?.sla_15min_pct ?? '—'}%`, `${m.velocidade?.sla_n ?? 0} respostas`],
    ],
    legendas: [LEG_MEDIANA, LEG_P90, LEG_P99, LEG_BASE,
      'O relógio corre 24 horas por dia, sem congelar fora do expediente.'],
  });

  const fila = m.fila_parada ?? {};
  if ((fila.n ?? 0) > 0) {
    blocos.push({
      tipo: 'tabela',
      titulo: 'Fila parada',
      colunas: ['Contato', 'Parado há'],
      linhas: (fila.top ?? []).map((f: any) => [String(f.contato).split('@')[0], `${f.horas} h`]),
      nota: `${fila.n} conversas com o cliente esperando resposta há mais de 2 horas (${t.fila_parada_pct ?? '—'}% dos contatos).`,
    });
  }

  blocos.push({
    tipo: 'funil',
    titulo: 'Funil de atendimento, etapa a etapa',
    etapas: (t.funil_passo_a_passo ?? []).map((e: any) => ({
      etapa: ROTULO_ETAPA[e.etapa] ?? e.etapa,
      valor: e.valor,
      conv: e.conv_do_passo_pct,
      queda: e.queda,
    })),
    nota:
      `Conversão geral ${t.conversao_geral_pct ?? '—'}%. Excluindo fornecedores, contatos internos e fora de perfil, ` +
      `a conversão real é ${t.conversao_limpa_pct ?? '—'}% sobre ${m.funil_limpo?.contatos ?? '—'} contatos.`,
    legendas: (() => {
      const p = t.funil_passo_a_passo ?? [];
      const ach = (k: string) => p.find((x: any) => x.etapa === k);
      const reuniao = ach('reuniao');
      const proposta = ach('proposta');
      return [
        'Conversão do passo = percentual sobre a etapa IMEDIATAMENTE ANTERIOR, não sobre o total de contatos.',
        // Exemplo com os números reais deste relatório: é o que desfaz a
        // leitura errada de que o funil "melhorou" no meio.
        reuniao && proposta
          ? `Por isso ${proposta.conv_do_passo_pct}% aparece depois de ${reuniao.conv_do_passo_pct}% e não significa melhora do funil: dos ${reuniao.valor} que chegaram à reunião, ${proposta.valor} receberam proposta.`
          : 'Um percentual maior depois de um menor não significa melhora: cada etapa tem sua própria base.',
        'Perdidos = quantos contatos ficaram pelo caminho naquele passo, em números absolutos.',
        'A maior perda absoluta e a menor conversão apontam gargalos diferentes; olhe as duas colunas juntas.',
      ];
    })(),
  });

  const carteira = m.carteira ?? {};
  blocos.push({
    tipo: 'tabela',
    titulo: 'Carteira por perfil',
    colunas: ['Perfil', 'Contatos', '% da carteira'],
    linhas: Object.entries(carteira)
      .sort((a2, b2) => Number(b2[1]) - Number(a2[1]))
      .map(([k, v]) => [ROTULO_PERFIL[k] ?? k, String(v), `${t.carteira_pct?.[k] ?? '—'}%`]),
    nota:
      `Carteira fria (aspirantes + especuladores): ${t.carteira_fria_pct ?? '—'}%. ` +
      `Índice de especulação: ${t.indice_especulacao_pct ?? '—'}%. ` +
      'Perfil derivado por regra sobre o resumo de cada conversa, não por classificação direta.',
    legendas: [
      'Carteira fria = aspirantes iniciais somados a especuladores. Mede quanto da carteira ainda não tem estrutura para comprar.',
      'Índice de especulação = quem pediu tabela e não se qualificou, sobre o total analisado.',
      '% da carteira = participação sobre as conversas analisadas, não sobre todos os contatos.',
    ],
  });

  const obj = m.objecoes ?? [];
  if (obj.length) {
    blocos.push({
      tipo: 'tabela',
      titulo: 'Objeções recebidas',
      colunas: ['Objeção', 'Vezes', 'Contornadas', 'Conversas'],
      linhas: obj.slice(0, 12).map((o: any) => [o.categoria, String(o.total), String(o.superadas), String(o.conversas)]),
      nota: `Taxa geral de superação: ${t.objecoes_superadas_pct ?? '—'}%.`,
      legendas: [
        'Vezes = quantas vezes a objeção apareceu, somando repetições na mesma conversa.',
        'Contornadas = quantas foram resolvidas com a conversa seguindo adiante.',
        'Conversas = em quantas conversas distintas ela apareceu. Objeção que nunca é contornada trava a venda.',
      ],
    });
  }

  const rep = m.respostas_repetidas ?? [];
  if (rep.length) {
    blocos.push({
      tipo: 'tabela',
      titulo: 'Respostas que se repetem',
      colunas: ['Trecho', 'Vezes', 'Contatos'],
      larguras: [72, 12, 16],
      linhas: rep.slice(0, 8).map((x: any) => [x.trecho, String(x.ocorrencias), String(x.contatos)]),
      nota: 'Extraído das mensagens enviadas: é o script que o consultor já usa na prática.',
    });
  }

  blocos.push({
    tipo: 'tabela',
    titulo: 'Comportamento no atendimento',
    colunas: ['Indicador', 'Valor', 'Base'],
    linhas: [
      ['Enviou preço nas 5 primeiras falas', String(m.comportamento?.preco_antes_de_qualificar ?? 0), comBase('conversas', m.funil?.contatos)],
      ['Links sem frase de enquadramento', `${t.links_sem_contexto_pct ?? '—'}%`, `${m.comportamento?.links_sem_contexto ?? 0} de ${m.comportamento?.links_total ?? 0}`],
      ['Fechou com próximo passo definido', `${t.proximo_passo_pct ?? '—'}%`, `${m.comportamento?.proximo_passo_definido ?? 0} conversas`],
    ],
    legendas: [
      'Preço nas 5 primeiras falas = ofertar antes de diagnosticar. Atrai especulador e encurta a conversa.',
      'Link sem frase de enquadramento = mensagem com link e menos de 8 palavras em volta.',
      'Próximo passo definido = a última fala do consultor combina data, dia ou retorno.',
      'Medido apenas sobre TEXTO: o que foi dito em áudio não entra em nenhum destes três.',
    ],
  });

  if (r.pontos_positivos?.length) {
    blocos.push({
      tipo: 'cards',
      titulo: 'Pontos fortes',
      cards: r.pontos_positivos.map((p: any) => ({
        titulo: p.titulo, metrica: p.metrica, valor: p.valor, leitura: p.leitura,
      })),
    });
  }

  if (r.pontos_criticos?.length) {
    blocos.push({
      tipo: 'cards',
      titulo: 'Pontos críticos',
      cards: r.pontos_criticos.map((p: any) => ({
        titulo: p.titulo, metrica: p.metrica, valor: p.valor, leitura: p.leitura, custo: p.custo_estimado,
      })),
    });
  }

  if (r.gargalo_principal) blocos.push({ tipo: 'texto', titulo: 'Onde a conversa morre', texto: r.gargalo_principal });
  if (r.leitura_de_carteira) blocos.push({ tipo: 'texto', titulo: 'Leitura da carteira', texto: r.leitura_de_carteira });

  if (r.plano_de_acao?.length) {
    blocos.push({
      tipo: 'tabela',
      titulo: 'Plano de ação',
      colunas: ['#', 'O que fazer', 'Indicador', 'Meta', 'Prazo'],
      larguras: [5, 34, 22, 27, 12],
      linhas: r.plano_de_acao.map((x: any, i: number) => [
        String(i + 1), x.acao, x.metrica_impactada, x.meta_numerica, `${x.prazo_em_dias} dias`,
      ]),
    });
  }

  if (r.metas_proximo_mes?.length) {
    blocos.push({
      tipo: 'tabela',
      titulo: 'Metas do próximo ciclo',
      colunas: ['Métrica', 'Hoje', 'Meta', 'Variação'],
      larguras: [30, 22, 32, 16],
      linhas: r.metas_proximo_mes.map((x: any) => [x.nome, x.valor_atual, x.meta, x.variacao_pct]),
    });
  }

  if (r.playbook?.length) {
    blocos.push({
      tipo: 'tabela',
      titulo: 'Playbook de atendimento',
      colunas: ['Etapa', 'Objetivo', 'Erro comum', 'Critério de avanço'],
      // Quatro colunas de texto corrido: sem larguras explícitas, uma célula
      // longa em "erro comum" esmaga a coluna "etapa" até virar ilegível.
      larguras: [18, 28, 27, 27],
      linhas: r.playbook.map((e: any) => [e.etapa, e.objetivo, e.erro_comum_observado, e.criterio_de_avanco]),
    });
  }

  // Sempre por último e sempre presente: quem lê precisa saber sobre o que o
  // relatório é cego antes de agir em cima dele.
  blocos.push({
    tipo: 'tabela',
    titulo: 'Metodologia e limitações',
    colunas: ['Item', 'Situação'],
    linhas: [
      ['Base de contatos', String(a.base_conversas)],
      ['Conversas avaliadas por IA', `${m.base?.analisadas ?? '—'} (${cob ?? '—'}%)`],
      ['Áudios não transcritos', 'conteúdo falado não entra em nenhum indicador de conteúdo'],
      ['Perfil do contato', 'derivado por regra sobre o resumo, não por classificação direta'],
      ['Consistência de tom', 'não medida — exigiria classificar cada resposta'],
      ['Etapas de reunião e proposta', 'inferidas pela IA a partir da conversa, não contadas'],
      ['Versão do relatório', `v${a.versao} · prompt v1`],
    ],
  });

  return blocos;
}
