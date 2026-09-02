// Camada 1 da IA: lê CADA conversa uma vez e grava o veredito.
//
// A hierarquia importa. Esta função lê texto cru; a `zap-parecer` lê só o que
// esta aqui produziu. Sem essa separação, gerar o parecer de um consultor
// releria um ano de conversas a cada clique — e o custo, que aqui é pago uma
// vez, seria pago para sempre.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { gerarJson, ErroIA } from '../_shared/anthropic.ts';

// Subir esta constante força a reanálise de TODA conversa com o prompt novo,
// sem apagar o que a versão anterior concluiu. É o mecanismo de evolução do
// prompt — e é caro, então subir é decisão consciente.
const VERSAO_PROMPT = 1;

/**
 * Orçamento de tempo por invocação. O plano Pro corta a função em 400s de
 * relógio; 300s deixa folga para a contagem final e o retorno. Era 90s, o que
 * fazia a rodada devolver o controle ao navegador com um terço do lote feito e
 * pagar uma partida a frio para continuar de onde parou.
 */
const ORCAMENTO_MS = 300_000;

/**
 * Quantas conversas a rodada pode processar. Cada análise já grava sozinha, então
 * um lote grande não é aposta: se a função morrer no meio, o que foi analisado
 * está no banco e o resto continua elegível.
 */
const MAX_POR_RODADA = 200;

/**
 * Análises simultâneas.
 *
 * O laço era sequencial e cada conversa custa ~6s de espera pelo modelo —
 * espera, não processamento. Rodavam 8 a 12 por minuto enquanto a máquina
 * ficava parada olhando a rede. Em paralelo o teto passa a ser a cota da conta,
 * não a latência de uma chamada.
 *
 * 12 é medido, não chutado: em produção rendeu 122 análises/min com zero 429
 * (contra 8-12/min do laço sequencial), consumindo ~395 mil tokens de entrada
 * por minuto sem a conta reclamar. `ZAP_CONCORRENCIA` ajusta sem deploy se a
 * cota mudar; o recuo em 429 abaixo protege caso ela encolha.
 */
const CONCORRENCIA = Math.max(1, Math.min(16, Number(Deno.env.get('ZAP_CONCORRENCIA')) || 12));

/**
 * Esforço de raciocínio desta função. Classificar sentimento e etapa de funil
 * contra um schema fechado é extração, não deliberação — `medium` (o padrão do
 * módulo) pagava tempo e tokens de pensamento por conversa sem melhorar o
 * preenchimento de campos enumerados. O parecer, que argumenta, segue no padrão.
 */
const ESFORCO_ANALISE = Deno.env.get('ZAP_ESFORCO_ANALISE') || 'low';

/** Teto de caracteres por conversa enviada ao modelo. */
const MAX_CHARS = 120_000;

const SISTEMA = [
  'Você é analista de inteligência comercial de uma indústria brasileira de suplementos.',
  'Analisa conversas de WhatsApp entre um consultor de vendas e um cliente (produtor rural ou revendedor).',
  'Responda SEMPRE em português do Brasil.',
  'Baseie-se apenas no que está na conversa. Não invente fatos, valores ou combinados que não aparecem.',
  'Se a conversa for curta ou ambígua demais para uma conclusão, use sentimento neutro e diga isso no resumo.',
  'Mensagens de áudio aparecem como marcador, sem o conteúdo falado. NÃO trate isso como silêncio ou',
  'desinteresse: houve comunicação ali, você apenas não a vê. Quando o áudio for parte relevante da',
  'conversa, diga no resumo que a leitura está incompleta.',
  'Objeção é uma resistência concreta do CLIENTE: preço, prazo, frete, desconfiança, concorrente, adiamento.',
  'CRITÉRIO DE SENTIMENTO — use exatamente estas definições:',
  'positivo = a conversa avança e o cliente demonstra intenção concreta (pede orçamento, confirma',
  'recebimento, marca reunião, envia dados, fecha, ou retorna por conta própria). Objeção contornada',
  'com a conversa seguindo adiante continua sendo positivo.',
  'neutro = nenhum sinal claro em nenhuma direção: pediu informação e sumiu sem recusar, troca',
  'operacional, conversa no começo, ou curta e ambígua demais para concluir. Também é o destino de',
  'conversa com muito áudio não transcrito — sem o conteúdo falado não há base para afirmar nada.',
  'negativo = recusa, insatisfação ou desistência EXPLÍCITA. Sumir em silêncio é neutro; dizer não',
  'é negativo. Não classifique como negativo apenas porque a venda não aconteceu.',
  'Uma objeção só entra em objecoes_superadas se a conversa mostrar que ela foi resolvida e o cliente seguiu adiante.',
].join(' ');

const SCHEMA = {
  type: 'object',
  properties: {
    sentimento: { type: 'string', enum: ['positivo', 'neutro', 'negativo'] },
    objecoes: { type: 'array', items: { type: 'string' } },
    objecoes_superadas: { type: 'array', items: { type: 'string' } },
    etapa_funil: {
      type: 'string',
      enum: [
        'sem_resposta',
        'em_conversa',
        'catalogo_enviado',
        'meeting_agendada',
        'proposta',
        'fechado',
        'perdido',
      ],
    },
    resumo: { type: 'string' },
  },
  required: ['sentimento', 'objecoes', 'objecoes_superadas', 'etapa_funil', 'resumo'],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Monta a conversa como diálogo legível. O rótulo de mídia entra explícito
 * em vez de sumir: o modelo precisa saber que houve uma troca ali, senão lê
 * uma conversa com buracos como se fosse silêncio do cliente — e a maior parte
 * do áudio antigo é irrecuperável (a mídia do WhatsApp expira em ~14-30 dias).
 */
function montarDialogo(mensagens: any[]): string {
  const linhas: string[] = [];

  for (const m of mensagens) {
    const quem = m.from_me ? 'CONSULTOR' : 'CLIENTE';
    const quando = new Date(m.momento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let conteudo: string;
    if (m.texto) {
      conteudo = m.tipo === 'audio' ? `(áudio transcrito) ${m.texto}` : m.texto;
    } else if (m.tipo === 'audio') {
      // Três estados distintos, e confundi-los engana o modelo. Com a
      // transcrição desligada, TODO áudio está "não transcrito" — rotulá-lo
      // como "sem fala" faria o modelo ler a conversa como se o interlocutor
      // tivesse mandado silêncio, e concluir desinteresse onde houve conversa.
      if (m.transcricao_status === 'midia_expirada') {
        conteudo = '[áudio enviado — gravação não está mais disponível]';
      } else if (m.transcricao_status === 'sem_fala') {
        conteudo = '[áudio sem fala]';
      } else {
        conteudo = '[áudio enviado — conteúdo não transcrito]';
      }
    } else if (m.tipo === 'texto') {
      // Texto vazio não é evento; pular evita poluir o diálogo com linhas ocas.
      continue;
    } else {
      conteudo = `[${m.tipo} enviado]`;
    }

    linhas.push(`[${quando}] ${quem}: ${conteudo}`);
  }

  const texto = linhas.join('\n');
  if (texto.length <= MAX_CHARS) return texto;

  // Conversa gigante: preserva a abertura (como o consultor abordou) e o fim
  // (onde está o desfecho). O meio é o que menos carrega diagnóstico.
  const cabeca = texto.slice(0, Math.floor(MAX_CHARS * 0.3));
  const cauda = texto.slice(-Math.floor(MAX_CHARS * 0.7));
  return `${cabeca}\n\n[...trecho intermediário omitido por tamanho...]\n\n${cauda}`;
}

async function analisarConversa(supabase: SupabaseClient, conversa: any) {
  const { data, error } = await supabase
    .from('zap_mensagens')
    .select('from_me, momento, tipo, texto, transcricao_status')
    .eq('instance_name', conversa.instance_name)
    .eq('remote_jid', conversa.remote_jid)
    .order('momento', { ascending: true });
  if (error) throw new Error(`mensagens: ${error.message}`);

  const dialogo = montarDialogo((data || []) as any[]);
  if (!dialogo.trim()) return null;

  const { dados, uso } = await gerarJson<any>({
    system: SISTEMA,
    partes: [{ text: `Analise esta conversa de atendimento:\n\n${dialogo}` }],
    schema: SCHEMA,
    maxTokens: 2048,
    esforco: ESFORCO_ANALISE,
  });

  const { error: upErr } = await supabase.from('zap_conversa_analise').upsert(
    {
      instance_name: conversa.instance_name,
      remote_jid: conversa.remote_jid,
      versao_prompt: VERSAO_PROMPT,
      // Grava até onde ESTA análise enxergou. Mensagem que chegar depois torna
      // a conversa elegível de novo, sem reanalisar o que não mudou.
      analisado_ate: conversa.ultima_mensagem,
      sentimento: dados.sentimento,
      objecoes: dados.objecoes ?? [],
      objecoes_superadas: dados.objecoes_superadas ?? [],
      etapa_funil: dados.etapa_funil,
      resumo: dados.resumo,
      tokens_entrada: uso.entrada,
      tokens_saida: uso.saida,
    },
    { onConflict: 'instance_name,remote_jid,versao_prompt' }
  );
  if (upErr) throw new Error(`gravar análise: ${upErr.message}`);

  return uso;
}

Deno.serve(async (req) => {
  // O navegador manda um OPTIONS de preflight antes do POST, sem corpo e sem
  // autenticação. Ele precisa ser respondido ANTES de qualquer validação —
  // exigir corpo JSON aqui devolvia 400 e o navegador abortava com
  // "Failed to send a request to the Edge Function", sem nunca chamar a função.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // `t0` e não `inicio`: `inicio` aqui é a borda do período analisado.
  const t0 = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let limite = MAX_POR_RODADA;
  let inicio: string | null = null;
  let fim: string | null = null;
  // Nulo = todos os consultores (é como o cron chama). A tela sempre manda um,
  // porque o botão dela vive num painel filtrado por consultor — analisar o time
  // inteiro dali fez o usuário ler 803 conversas como se fossem de um só.
  let usuarioId: string | null = null;
  try {
    const corpo = await req.json();
    const n = Number(corpo?.limite);
    if (Number.isInteger(n) && n > 0) limite = Math.min(n, MAX_POR_RODADA);
    if (typeof corpo?.inicio === 'string') inicio = corpo.inicio;
    if (typeof corpo?.fim === 'string') fim = corpo.fim;
    if (typeof corpo?.usuario_id === 'string' && corpo.usuario_id) usuarioId = corpo.usuario_id;
  } catch {
    // Sem corpo — o cron chama vazio e cai no padrão.
  }

  // Sem janela informada, o padrão é o mês corrente e não "tudo": um disparo
  // acidental sem período não deve varrer (e cobrar por) o acervo inteiro.
  if (!inicio || !fim) {
    const agora = new Date();
    inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
    fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString();
  }

  try {
    const { data, error } = await supabase.rpc('zap_conversas_para_analisar', {
      p_inicio: inicio,
      p_fim: fim,
      p_versao: VERSAO_PROMPT,
      p_limite: limite,
      p_usuario_id: usuarioId,
    });
    if (error) throw new Error(`seleção: ${error.message}`);

    let analisadas = 0;
    let falhas = 0;
    // A causa da última falha sobe junto da resposta. Sem isto, uma rodada que
    // falha inteira (chave ausente, cota estourada) chega à tela como "nada foi
    // analisado" — verdadeiro e inútil.
    let ultimoErro: string | null = null;
    let tokensEntrada = 0;
    let tokensSaida = 0;
    let fatais = 0;
    // Freio compartilhado. Quando a conta devolve 429, não adianta cada worker
    // descobrir isso por conta própria: todos param até o mesmo instante, senão
    // os outros cinco continuam batendo na porta fechada e renovam o bloqueio.
    let pausaAte = 0;

    const fila = (data || []) as any[];
    let proxima = 0;
    const esgotado = () => Date.now() - t0 > ORCAMENTO_MS;

    const trabalhador = async () => {
      while (true) {
        // Cinco falhas definitivas seguidas indicam problema de configuração
        // (chave inválida, cota estourada) — insistir queimaria o orçamento
        // inteiro repetindo o mesmo erro.
        if (fatais >= 5 || esgotado()) return;

        const espera = pausaAte - Date.now();
        if (espera > 0) {
          if (Date.now() + espera - t0 > ORCAMENTO_MS) return;
          await new Promise((r) => setTimeout(r, espera));
        }

        // Índice tomado antes do await: sem isso dois workers pegariam a mesma
        // conversa e pagaríamos duas vezes pela mesma análise.
        const i = proxima++;
        if (i >= fila.length) return;
        const conversa = fila[i];

        try {
          const uso = await analisarConversa(supabase, conversa);
          if (uso) {
            analisadas++;
            tokensEntrada += uso.entrada;
            tokensSaida += uso.saida;
          }
        } catch (e) {
          falhas++;
          ultimoErro = (e as Error).message;
          // Sem marcar nada: a conversa continua elegível e volta na próxima
          // rodada. Uma falha isolada de IA não deve consumir a fila inteira.
          if (e instanceof ErroIA && e.status === 429) {
            // Cota estourada é sinal de ritmo, não de erro de programação:
            // recua o pelotão inteiro por alguns segundos e segue.
            pausaAte = Math.max(pausaAte, Date.now() + 5_000);
          } else if (e instanceof ErroIA && !e.retentavel) {
            fatais++;
          }
          console.error(`analisar ${conversa.remote_jid}:`, (e as Error).message);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, () => trabalhador())
    );

    // Contagem no banco. Trazer 100 mil linhas para medir o tamanho da fila
    // custava mais que a própria rodada quando o acervo cresceu.
    const { data: pendentes } = await supabase.rpc('zap_conversas_pendentes', {
      p_inicio: inicio,
      p_fim: fim,
      p_versao: VERSAO_PROMPT,
      p_usuario_id: usuarioId,
    });

    return json({
      ok: true,
      analisadas,
      falhas,
      ultimo_erro: ultimoErro,
      restantes: Number(pendentes) || 0,
      periodo: { inicio, fim },
      usuario_id: usuarioId,
      tokens: { entrada: tokensEntrada, saida: tokensSaida },
      // Instrumentação: sem isto, "está mais rápido?" vira impressão.
      ritmo: {
        concorrencia: CONCORRENCIA,
        segundos: Math.round((Date.now() - t0) / 100) / 10,
        por_minuto:
          Date.now() > t0
            ? Math.round((analisadas / ((Date.now() - t0) / 60000)) * 10) / 10
            : 0,
      },
    });
  } catch (e) {
    console.error('zap-analisar:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
