// Camada 2 da IA: o parecer estratégico de um consultor num período.
//
// Esta função NUNCA lê mensagem crua. Ela consome as métricas determinísticas e
// os vereditos que a `zap-analisar` já gravou. É o que torna o parecer barato o
// bastante para ser regerado à vontade: o texto das conversas foi lido uma vez,
// na camada 1, por US$ 7,22; reler o resultado custa centavos.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { gerarJson } from '../_shared/anthropic.ts';

const VERSAO_PROMPT = 2;

const SISTEMA = [
  'Você é head de vendas de uma indústria brasileira de suplementos, escrevendo o feedback',
  'de ciclo de um consultor comercial que atende por WhatsApp.',
  'Escreva em português do Brasil, em parágrafos corridos, sem markdown, sem títulos e sem emojis.',
  'Use os números fornecidos de forma concreta: cite o valor e o que ele significa na prática.',
  'Compare o consultor com a média do time sempre que o dado do time estiver disponível.',
  'Seja direto e específico. Evite elogio genérico e conselho de autoajuda.',
  'Quando um indicador tiver base pequena, diga isso em vez de tirar conclusão forte.',
  'Este texto será lido pelo próprio consultor: seja franco, mas trate-o como profissional.',
  'No plano de ação, cada item precisa de uma meta numérica que parta do valor ATUAL dele.',
  'Não invente número que não esteja nos dados. Se faltar base para uma meta, diga o que medir antes.',
  'Você recebe CONVERSAS EXEMPLARES reais, com nome do contato, o número que as colocou ali e o resumo do que aconteceu.',
  'Todo ponto de impacto DEVE citar pelo menos uma dessas conversas, pelo nome do contato, e dizer o que nela sustenta a conclusão.',
  'Descreva o erro concreto: o que o consultor fez ou deixou de fazer naquela conversa, e o que deveria ter feito.',
  'Nunca cite conversa que não esteja na lista fornecida. Se uma afirmação não tiver conversa que a sustente, não a faça.',
].join(' ');

const SCHEMA = {
  type: 'object',
  properties: {
    eficiencia: { type: 'string' },
    processo: { type: 'string' },
    relacionamento: { type: 'string' },
    comparativo_time: { type: 'string' },
    pontos_impacto: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          porque: { type: 'string' },
          // A métrica que sustenta o ponto, com o valor. Sem isto o leitor não
          // consegue conferir a afirmação.
          metrica: { type: 'string' },
          // As conversas concretas. É o que diferencia "seu tempo de resposta é
          // alto" de "a Cristiana esperou 71h e não voltou".
          evidencias: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                contato: { type: 'string' },
                observado: { type: 'string' },
                erro: { type: 'string' },
                deveria: { type: 'string' },
              },
              required: ['contato', 'observado', 'erro', 'deveria'],
              additionalProperties: false,
            },
          },
        },
        required: ['titulo', 'porque', 'metrica', 'evidencias'],
        additionalProperties: false,
      },
    },
    plano_acao: { type: 'string' },
    plano_acao_itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          acao: { type: 'string' },
          metrica: { type: 'string' },
          valor_atual: { type: 'string' },
          meta: { type: 'string' },
          prazo: { type: 'string' },
        },
        required: ['acao', 'metrica', 'valor_atual', 'meta', 'prazo'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'eficiencia',
    'processo',
    'relacionamento',
    'comparativo_time',
    'pontos_impacto',
    'plano_acao',
    'plano_acao_itens',
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Segundos viram algo que uma pessoa lê sem converter de cabeça. */
function duracao(s: number | null): string {
  if (s == null) return 'sem dados';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)} dias`;
}

const ROTULO_CATEGORIA: Record<string, string> = {
  demora_primeira_resposta: 'DEMOROU PARA A PRIMEIRA RESPOSTA',
  nunca_respondido: 'ESCREVEU E NUNCA FOI RESPONDIDO',
  objecao_aberta: 'OBJEÇÃO LEVANTADA E NÃO SUPERADA',
  sentimento_negativo: 'CLIENTE SAIU INSATISFEITO',
  parou_apos_catalogo: 'RECEBEU CATÁLOGO E A CONVERSA MORREU',
  etiqueta_diverge: 'MARCADO COMO NEGOCIAÇÃO ATIVA, MAS PARADO',
};

/**
 * Texto legível em vez de JSON: o modelo erra menos lendo "Cristiana — espera
 * pela 1ª resposta: 71h" do que um objeto com sete campos. O resumo entra
 * porque é ele que permite descrever o erro concreto, não só o atraso.
 */
function blocosExemplares(linhas: any[]): string[] {
  const porCategoria = new Map<string, any[]>();
  for (const l of linhas) {
    const atual = porCategoria.get(l.categoria) ?? [];
    atual.push(l);
    porCategoria.set(l.categoria, atual);
  }

  const saida: string[] = [];
  for (const [categoria, itens] of porCategoria) {
    saida.push('', ROTULO_CATEGORIA[categoria] ?? categoria.toUpperCase());
    for (const i of itens) {
      const nome = i.identificacao || i.nome || '(contato sem identificacao)';
      const etiquetas = (i.etiquetas ?? []).length
        ? ` | etiquetas do consultor: ${(i.etiquetas as string[]).join(', ')}`
        : '';
      const abertas = (i.objecoes ?? []).filter(
        (o: string) => !(i.objecoes_superadas ?? []).includes(o)
      );
      saida.push(
        `  - ${nome} — ${i.metrica_rotulo}: ${i.metrica_valor}` +
          ` | etapa: ${i.etapa_funil ?? 'nao analisada'}` +
          ` | sentimento: ${i.sentimento ?? 'nao analisado'}` +
          (abertas.length ? ` | objeções abertas: ${abertas.join(', ')}` : '') +
          etiquetas
      );
      if (i.resumo) saida.push(`    resumo: ${String(i.resumo).slice(0, 700)}`);
    }
  }
  return saida;
}

const pct = (parte: number, todo: number) =>
  todo > 0 ? `${((parte / todo) * 100).toFixed(1)}%` : 'sem base';

async function coletar(supabase: SupabaseClient, usuarioId: string, inicio: string, fim: string) {
  const { data: todas, error } = await supabase.rpc('zap_metricas_consultor', {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new Error(`métricas: ${error.message}`);

  const lista = (todas || []) as any[];
  const m = lista.find((x) => x.usuario_id === usuarioId);
  if (!m) return null;

  // A média do time exclui o próprio consultor: comparar alguém com um grupo
  // que o inclui dilui a diferença justamente quando ela é grande.
  const outros = lista.filter((x) => x.usuario_id !== usuarioId);
  const mediaTime = (campo: string) => {
    const vals = outros.map((o) => Number(o[campo])).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const [dist, objecoes, exemplares] = await Promise.all([
    supabase.rpc('zap_distribuicao_resposta', {
      p_inicio: inicio,
      p_fim: fim,
      p_usuario_id: usuarioId,
    }),
    supabase.rpc('zap_objecoes_ranking', {
      p_inicio: inicio,
      p_fim: fim,
      p_usuario_id: usuarioId,
    }),
    // A evidência. Sem isto o parecer só tem agregado, e agregado não permite
    // citar conversa — a IA acabaria inventando exemplo.
    supabase.rpc('zap_conversas_exemplares', {
      p_usuario_id: usuarioId,
      p_inicio: inicio,
      p_fim: fim,
      p_por_categoria: 4,
    }),
  ]);

  return {
    m,
    outros: outros.length,
    mediaTime,
    distribuicao: (dist.data || []) as any[],
    objecoes: (objecoes.data || []) as any[],
    exemplares: (exemplares.data || []) as any[],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, error: 'corpo inválido' }, 400);
  }

  const usuarioId = String(corpo?.usuario_id || '').trim();
  const inicio = String(corpo?.inicio || '').trim();
  const fim = String(corpo?.fim || '').trim();
  if (!usuarioId || !inicio || !fim) {
    return json({ ok: false, error: 'usuario_id, inicio e fim são obrigatórios' }, 400);
  }

  try {
    const coletado = await coletar(supabase, usuarioId, inicio, fim);
    if (!coletado) {
      return json({ ok: false, error: 'Sem atendimento registrado para este consultor no período.' }, 404);
    }
    const { m, outros, mediaTime, distribuicao, objecoes, exemplares } = coletado;

    const analisadas = Number(m.conversas_analisadas) || 0;
    const contatos = Number(m.contatos) || 0;

    // Texto legível em vez de JSON cru: o modelo erra menos interpretando
    // "TMR1 mediano: 13min" do que um campo `tmr1_mediana_seg: 780`.
    const contexto = [
      `Consultor: ${m.consultor}`,
      `Período: ${inicio.slice(0, 10)} a ${fim.slice(0, 10)}`,
      `Contatos atendidos: ${contatos}`,
      `Contatos internos excluídos do cálculo: ${m.contatos_internos_excluidos}`,
      '',
      'AGILIDADE (relógio corrido 24/7, sem congelar fora do expediente)',
      `Tempo até a 1ª resposta — mediana ${duracao(m.tmr1_mediana_seg)}, média ${duracao(m.tmr1_media_seg)}, p90 ${duracao(m.tmr1_p90_seg)}, p99 ${duracao(m.tmr1_p99_seg)}`,
      `  base: ${m.contatos_cliente_iniciou} conversas iniciadas pelo cliente`,
      `  média do time (${outros} outros consultores): ${duracao(mediaTime('tmr1_mediana_seg'))}`,
      `Resposta ao longo da conversa — mediana ${duracao(m.resposta_continua_mediana_seg)}, p90 ${duracao(m.resposta_continua_p90_seg)}, p99 ${duracao(m.resposta_continua_p99_seg)}`,
      `  média do time: ${duracao(mediaTime('resposta_continua_mediana_seg'))}`,
      `O cliente responde a ele em — mediana ${duracao(m.resposta_cliente_mediana_seg)}, p90 ${duracao(m.resposta_cliente_p90_seg)}`,
      '',
      'DISTRIBUIÇÃO DAS RESPOSTAS DELE',
      ...distribuicao.map((d) => `  ${d.faixa}: ${d.respostas} (${d.pct}%)`),
      '',
      'PROSPECÇÃO',
      `Conversas que ELE iniciou: ${m.contatos_consultor_iniciou}`,
      `Conversas que o CLIENTE iniciou: ${m.contatos_cliente_iniciou}`,
      `Taxa de vácuo inicial (abordou e não teve resposta): ${m.vacuo_inicial_pct ?? 'sem base'}%`,
      `  média do time: ${mediaTime('vacuo_inicial_pct')?.toFixed(1) ?? 'sem base'}%`,
      '',
      'USO DE MÍDIA (por contato)',
      `Áudios: ${m.audios_enviados} (${(Number(m.audios_enviados) / Math.max(contatos, 1)).toFixed(1)} por contato)`,
      `Vídeos: ${m.videos_enviados} | Imagens: ${m.imagens_enviadas} | Documentos: ${m.documentos_enviados}`,
      `Contatos que receberam catálogo ou link: ${m.contatos_com_link} (${pct(m.contatos_com_link, contatos)})`,
      `  média do time em áudios por contato: ${(mediaTime('audios_enviados') ?? 0) / Math.max(mediaTime('contatos') ?? 1, 1)}`,
      '',
      'RESULTADO (inferido pela IA a partir do conteúdo das conversas)',
      `Conversas analisadas: ${analisadas} de ${contatos} (${pct(analisadas, contatos)} de cobertura)`,
      `Chegaram a reunião, proposta ou fechamento: ${m.contatos_com_reuniao} (${pct(m.contatos_com_reuniao, analisadas)} das analisadas)`,
      `Sentimento — positivo ${m.sentimento_positivo}, neutro ${m.sentimento_neutro}, negativo ${m.sentimento_negativo}`,
      '',
      'OBJEÇÕES POR CATEGORIA (total / quantas foram superadas / em quantas conversas)',
      ...objecoes.map((o) => `  ${o.categoria}: ${o.total} / ${o.superadas} / ${o.conversas}`),
      '',
      'CONVERSAS EXEMPLARES — use ESTAS para embasar cada ponto de impacto.',
      'Cada bloco traz o contato, o número que o colocou nesta lista e o resumo do que aconteceu.',
      'Cite o contato exatamente como aparece na lista. Boa parte não tem nome salvo — nesses casos o identificador é o telefone ou os dígitos finais, e você deve usá-lo como está, sem inventar nome.',
  'Não cite conversa que não esteja aqui.',
      ...(exemplares.length === 0
        ? ['  (nenhuma conversa se destacou no período — não afirme problema específico sem base)']
        : blocosExemplares(exemplares)),
    ].join('\n');

    const { dados, uso } = await gerarJson<any>({
      system: SISTEMA,
      partes: [
        {
          text:
            `Escreva o parecer de ciclo deste consultor.\n\n${contexto}\n\n` +
            'Em pontos_impacto, liste os TRÊS pontos de maior impacto potencial. ' +
            'Em plano_acao_itens, escreva de 5 a 8 ações; valor_atual deve citar o número ' +
            'real que aparece acima. plano_acao é a mesma coisa em prosa, para quem prefere ler corrido.',
        },
      ],
      schema: SCHEMA,
      maxTokens: 16000,
    });

    const { error: upErr } = await supabase.from('zap_consultor_parecer').upsert(
      {
        usuario_id: usuarioId,
        periodo_inicio: inicio.slice(0, 10),
        periodo_fim: fim.slice(0, 10),
        versao_prompt: VERSAO_PROMPT,
        eficiencia: dados.eficiencia,
        processo: dados.processo,
        relacionamento: dados.relacionamento,
        comparativo_time: dados.comparativo_time,
        pontos_impacto: dados.pontos_impacto ?? [],
        plano_acao: dados.plano_acao,
        plano_acao_itens: dados.plano_acao_itens ?? [],
        // Congela os números que geraram este texto: reler o parecer meses
        // depois, com o acervo já mudado, precisa da âncora que o justificou.
        metricas: { m, distribuicao, objecoes },
      },
      { onConflict: 'usuario_id,periodo_inicio,periodo_fim,versao_prompt' }
    );
    if (upErr) throw new Error(`gravar parecer: ${upErr.message}`);

    return json({ ok: true, parecer: dados, uso });
  } catch (e) {
    console.error('zap-parecer:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
