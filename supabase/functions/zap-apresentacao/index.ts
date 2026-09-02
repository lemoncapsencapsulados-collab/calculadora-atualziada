// Motor de síntese: transforma o objeto de métricas num relatório executivo.
//
// Recebe SOMENTE `metrics` (§5). Nenhuma conversa crua entra aqui — é o que
// mantém o custo em centavos mesmo com 800 conversas no acervo, e é o que
// garante que todo número do texto tenha origem verificável.
//
// A validação da §10 roda depois da geração: extrai os números do texto e
// confere contra o JSON de métricas. Órfãos não abortam a gravação (a chamada já
// foi paga), mas ficam registrados e marcam a apresentação com alerta.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { gerarJson } from '../_shared/anthropic.ts';

const VERSAO_PROMPT = 1;

const SISTEMA = [
  'Você é um gestor comercial sênior avaliando UM consultor de uma fábrica de suplementos',
  'que vende B2B para produtores de marca própria. Pedido mínimo de 100 potes por fórmula.',
  'O público NÃO é consumidor final: é quem compra fórmula com marca própria para revender.',
  'Escreva em português do Brasil.',
  'REGRAS:',
  'Cite SEMPRE o número e o n da base. Nenhuma afirmação sem dado.',
  'NUNCA use número que não esteja no objeto de métricas recebido. Nem arredondado, nem derivado.',
  'Se um indicador tiver n menor que 10, diga explicitamente que a base é pequena e não conclua.',
  'Frases curtas. Sem adjetivo motivacional, sem "é importante notar", sem preâmbulo.',
  'Respeite os limites de palavras de cada campo.',
  'Metas realistas: no máximo 20% de melhora sobre o valor atual de cada métrica.',
].join(' ');

const SCHEMA = {
  type: 'object',
  properties: {
    veredito: { type: 'string' },
    pontos_positivos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          metrica: { type: 'string' },
          valor: { type: 'string' },
          leitura: { type: 'string' },
        },
        required: ['titulo', 'metrica', 'valor', 'leitura'],
        additionalProperties: false,
      },
    },
    pontos_criticos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          metrica: { type: 'string' },
          valor: { type: 'string' },
          leitura: { type: 'string' },
          custo_estimado: { type: 'string' },
        },
        required: ['titulo', 'metrica', 'valor', 'leitura', 'custo_estimado'],
        additionalProperties: false,
      },
    },
    gargalo_principal: { type: 'string' },
    leitura_de_carteira: { type: 'string' },
    plano_de_acao: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          acao: { type: 'string' },
          responsavel: { type: 'string' },
          prazo_em_dias: { type: 'integer' },
          metrica_impactada: { type: 'string' },
          meta_numerica: { type: 'string' },
          como_medir: { type: 'string' },
        },
        required: ['acao', 'responsavel', 'prazo_em_dias', 'metrica_impactada', 'meta_numerica', 'como_medir'],
        additionalProperties: false,
      },
    },
    metas_proximo_mes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          valor_atual: { type: 'string' },
          meta: { type: 'string' },
          variacao_pct: { type: 'string' },
          metodo: { type: 'string' },
        },
        required: ['nome', 'valor_atual', 'meta', 'variacao_pct', 'metodo'],
        additionalProperties: false,
      },
    },
    playbook: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          etapa: { type: 'string' },
          objetivo: { type: 'string' },
          perguntas_chave: { type: 'array', items: { type: 'string' } },
          erro_comum_observado: { type: 'string' },
          criterio_de_avanco: { type: 'string' },
        },
        required: ['etapa', 'objetivo', 'perguntas_chave', 'erro_comum_observado', 'criterio_de_avanco'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'veredito',
    'pontos_positivos',
    'pontos_criticos',
    'gargalo_principal',
    'leitura_de_carteira',
    'plano_de_acao',
    'metas_proximo_mes',
    'playbook',
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validação da §10: todo número citado no texto precisa existir nas métricas.
 *
 * Compara sobre a forma normalizada (vírgula vira ponto, zeros à direita caem)
 * porque o modelo escreve "20,3" onde o JSON traz 20.3. Sem normalizar, todo
 * número apareceria como órfão e o alerta viraria ruído ignorado.
 *
 * Números de 0 a 100 sem casa decimal são ignorados: prazos em dias, contagens
 * de itens de lista e ordinais aparecem naturalmente no texto sem serem
 * métricas, e sinalizá-los afogaria os órfãos reais.
 */
function validarNumeros(texto: string, metrics: unknown): string[] {
  const bruto = JSON.stringify(metrics);
  const norm = (s: string) => String(parseFloat(s.replace(',', '.')));

  const disponiveis = new Set<string>();
  for (const n of bruto.match(/-?\d+(?:\.\d+)?/g) ?? []) {
    disponiveis.add(norm(n));
    // O texto costuma arredondar: 81.5 vira "82%".
    disponiveis.add(String(Math.round(parseFloat(n))));
  }

  const orfaos = new Set<string>();
  for (const n of texto.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const v = parseFloat(n.replace(',', '.'));
    if (!Number.isFinite(v)) continue;
    if (Number.isInteger(v) && v >= 0 && v <= 100) continue;
    if (!disponiveis.has(norm(n))) orfaos.add(n);
  }
  return Array.from(orfaos);
}

async function coletar(supabase: SupabaseClient, usuarioId: string, inicio: string, fim: string) {
  const [rel, score, taxas, metricas, fila, etiquetas] = await Promise.all([
    supabase.rpc('zap_relatorio', { p_inicio: inicio, p_fim: fim, p_usuario_id: usuarioId }),
    supabase.rpc('zap_score', { p_inicio: inicio, p_fim: fim, p_usuario_id: usuarioId }),
    // As taxas derivadas entram no objeto porque o modelo é proibido de
    // calcular percentual — e a proibição só é respeitável se o percentual já
    // vier pronto. O validador da §10 pegou 8 divisões que ele fez sozinho.
    supabase.rpc('zap_taxas', { p_inicio: inicio, p_fim: fim, p_usuario_id: usuarioId }),
    supabase.rpc('zap_metricas_consultor', { p_inicio: inicio, p_fim: fim }),
    // Fila e carteira por etiqueta só existem aqui, e não na visão geral da
    // dashboard: somadas sobre o time inteiro elas não têm dono, e número sem
    // dono não vira ação. Filtradas por consultor, viram.
    supabase.rpc('zap_fila_por_consultor', {
      p_usuario_id: usuarioId,
      p_inicio: null,
      p_fim: null,
    }),
    supabase.rpc('zap_etiquetas_por_consultor', { p_usuario_id: usuarioId }),
  ]);
  if (rel.error) throw new Error(`relatório: ${rel.error.message}`);
  if (score.error) throw new Error(`score: ${score.error.message}`);
  if (taxas.error) throw new Error(`taxas: ${taxas.error.message}`);

  const lista = (metricas.data || []) as any[];
  const meu = lista.find((x) => x.usuario_id === usuarioId);
  if (!meu) return null;

  // Média do time EXCLUINDO o próprio consultor: comparar alguém com um grupo
  // que o inclui dilui a diferença justamente quando ela é grande.
  const outros = lista.filter((x) => x.usuario_id !== usuarioId);
  const media = (campo: string) => {
    const v = outros.map((o) => Number(o[campo])).filter((x) => Number.isFinite(x));
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };

  return {
    consultor: meu.consultor,
    metrics: {
      ...(rel.data as any),
      score: score.data,
      taxas: taxas.data,
      fila_sem_atendimento: (fila.data || []) as any[],
      carteira_etiquetas: (etiquetas.data || []) as any[],
      time: {
        consultores_comparados: outros.length,
        tmr1_p50_seg: media('tmr1_mediana_seg'),
        vacuo_inicial_pct: media('vacuo_inicial_pct'),
        contatos: media('contatos'),
      },
    },
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
    const { consultor, metrics } = coletado;

    const { dados, uso } = await gerarJson<any>({
      system: SISTEMA,
      partes: [
        {
          text:
            `Consultor: ${consultor}\nPeríodo: ${inicio.slice(0, 10)} a ${fim.slice(0, 10)}\n\n` +
            `MÉTRICAS (única fonte de números permitida):\n${JSON.stringify(metrics, null, 1)}\n\n` +
            'Limites: veredito 30 palavras; leitura de cada ponto 25 palavras; ' +
            'gargalo_principal 40 palavras; leitura_de_carteira 40 palavras. ' +
            'pontos_positivos e pontos_criticos: 3 a 5 itens cada. ' +
            'plano_de_acao: exatamente 5 ações, ordenadas por impacto esperado. ' +
            'metas_proximo_mes: exatamente 6 métricas. playbook: exatamente 6 etapas, ' +
            'derivadas das conversas que converteram e dos erros que os dados mostram.',
        },
      ],
      schema: SCHEMA,
      maxTokens: 16000,
    });

    // §10: nenhum número no texto que não exista em metrics.
    //
    // Valida só o que AFIRMA sobre o presente. Metas e prazos ficam de fora por
    // construção: a especificação pede alvo de +20% sobre o valor atual, então
    // "de 3,36% para 4,03%" produz um número que por definição ainda não existe
    // nos dados. Validar isso transformaria o alerta em ruído permanente, e
    // alerta que sempre acende deixa de ser lido.
    const camposAfirmativos = {
      veredito: dados.veredito,
      pontos_positivos: dados.pontos_positivos,
      pontos_criticos: dados.pontos_criticos,
      gargalo_principal: dados.gargalo_principal,
      leitura_de_carteira: dados.leitura_de_carteira,
      // Do plano, só a leitura do problema — não a meta.
      plano_acoes: (dados.plano_de_acao ?? []).map((a: any) => a.acao),
    };
    const orfaos = validarNumeros(JSON.stringify(camposAfirmativos), metrics);

    const custo = (uso.entrada / 1e6) * 2 + (uso.saida / 1e6) * 10;

    const { data: versao } = await supabase.rpc('zap_proxima_versao', {
      p_usuario_id: usuarioId,
      p_inicio: inicio.slice(0, 10),
      p_fim: fim.slice(0, 10),
    });

    const { data: gravado, error: upErr } = await supabase
      .from('zap_apresentacoes')
      .insert({
        usuario_id: usuarioId,
        consultor_nome: consultor,
        periodo_inicio: inicio.slice(0, 10),
        periodo_fim: fim.slice(0, 10),
        versao: versao ?? 1,
        versao_prompt: VERSAO_PROMPT,
        base_conversas: (metrics as any).base?.contatos ?? 0,
        cobertura_analise_pct: (metrics as any).base?.cobertura_analise_pct ?? null,
        score_geral: (metrics as any).score?.total ?? null,
        // Guarda métricas E texto: permite re-renderizar PDF e slides sem
        // gastar IA de novo.
        payload_json: { metrics, relatorio: dados },
        custo_analise_usd: Math.round(custo * 10000) / 10000,
        validacao_orfaos: orfaos,
        status: orfaos.length ? 'com_alerta' : 'ok',
      })
      .select('id, versao')
      .single();
    if (upErr) throw new Error(`gravar apresentação: ${upErr.message}`);

    return json({
      ok: true,
      id: gravado.id,
      versao: gravado.versao,
      relatorio: dados,
      metrics,
      validacao_orfaos: orfaos,
      uso,
      custo_usd: Math.round(custo * 10000) / 10000,
    });
  } catch (e) {
    console.error('zap-apresentacao:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
