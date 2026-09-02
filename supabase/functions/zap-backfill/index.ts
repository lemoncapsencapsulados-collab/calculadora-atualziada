// Importa o histórico de conversas da Evolution para `zap_mensagens`.
//
// Por que fila e não um laço só: a Edge Function tem limite de execução e o
// histórico de 15+ consultores × centenas de contatos × 1 ano não cabe numa
// invocação. Cada rodada consome um punhado de conversas dentro de um orçamento
// de tempo, salva o progresso e devolve o controle; o cron chama de novo.
//
// Duas ações:
//   semear    — cria uma linha de fila por conversa de cada instância ativa
//   processar — consome a fila (é o que o cron chama)

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  listarConversas,
  listarConversasBrutas,
  listarMensagens,
  estadoConexao,
} from '../_shared/evolution.ts';
import { normalizar } from '../_shared/zapNormalizar.ts';
import { salvarMensagens } from '../_shared/zapPersistir.ts';

// Orçamento de parede por invocação. Fica bem abaixo do limite da plataforma
// porque a rodada precisa de folga para gravar o progresso antes de ser cortada
// — um job morto no meio sem checkpoint reimportaria tudo na próxima vez.
const ORCAMENTO_MS = 90_000;

/** Teto de páginas por conversa em UMA rodada. O resto fica para a próxima. */
const PAGINAS_POR_RODADA = 10;

/** Tamanho da página do findMessages — precisa casar com o `offset` do cliente Evolution. */
const TAMANHO_PAGINA = 100;

/** Depois disso o job vai para dlq e para de consumir a fila. */
const MAX_TENTATIVAS = 4;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function semear(supabase: SupabaseClient) {
  const { data: instancias, error } = await supabase
    .from('zap_instancias')
    .select('instance_name')
    .eq('ativo', true);
  if (error) throw new Error(`instâncias: ${error.message}`);

  let criados = 0;
  for (const i of (instancias || []) as { instance_name: string }[]) {
    const jids = await listarConversas(i.instance_name);
    for (let k = 0; k < jids.length; k += 200) {
      const lote = jids.slice(k, k + 200).map((jid) => ({
        instance_name: i.instance_name,
        remote_jid: jid,
      }));
      // `ignoreDuplicates` para semear de novo não zerar o progresso de uma
      // conversa que já está importada.
      const { error: upErr } = await supabase
        .from('zap_backfill_jobs')
        .upsert(lote, { onConflict: 'instance_name,remote_jid', ignoreDuplicates: true });
      if (upErr) throw new Error(`fila: ${upErr.message}`);
      criados += lote.length;
    }
  }
  return criados;
}

interface ResultadoJob {
  importadas: number;
  ultimaPagina: number;
  /** `true` só quando a conversa acabou de verdade (página incompleta ou vazia). */
  terminou: boolean;
}

async function processarJob(supabase: SupabaseClient, job: any): Promise<ResultadoJob> {
  let importadas = 0;
  // Retoma de onde a rodada anterior parou. Recomeçar da página 1 não só
  // desperdiçaria chamadas — com o teto de páginas por rodada, uma conversa
  // longa ficaria presa nas mesmas primeiras 1000 mensagens para sempre.
  let pagina = Number(job.ultima_pagina || 0);
  let terminou = false;

  for (let i = 0; i < PAGINAS_POR_RODADA; i++) {
    pagina++;
    const brutas = await listarMensagens(job.instance_name, job.remote_jid, pagina);
    if (brutas.length === 0) {
      terminou = true;
      // Página vazia não foi importada: o checkpoint volta para a anterior.
      pagina--;
      break;
    }

    const linhas = [];
    const nomes = new Map<string, string>();
    for (const b of brutas) {
      const linha = normalizar(b, job.instance_name);
      if (!linha) continue;
      linhas.push(linha);
      const push = String(b?.pushName || '').trim();
      if (push && !linha.from_me) nomes.set(linha.remote_jid, push);
    }
    importadas += await salvarMensagens(supabase, linhas, nomes);

    // Página incompleta = fim da conversa.
    if (brutas.length < TAMANHO_PAGINA) {
      terminou = true;
      break;
    }
  }

  return { importadas, ultimaPagina: pagina, terminou };
}

Deno.serve(async (req) => {
  // O navegador manda um OPTIONS de preflight antes do POST, sem corpo e sem
  // autenticação. Ele precisa ser respondido ANTES de qualquer validação —
  // exigir corpo JSON aqui devolvia 400 e o navegador abortava com
  // "Failed to send a request to the Edge Function", sem nunca chamar a função.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const inicio = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let acao = 'processar';
  try {
    const corpo = await req.json();
    if (typeof corpo?.acao === 'string') acao = corpo.acao;
  } catch {
    // Sem corpo — o cron chama vazio e cai no padrão.
  }

  try {
    // Diagnóstico: mostra o que a Evolution devolve ANTES de qualquer filtro
    // nosso. Existe porque "a fila ficou vazia" tem causas muito diferentes —
    // instância desconectada, formato de JID inesperado, conta sem conversas —
    // e adivinhar entre elas custa mais que medir.
    if (acao === 'diagnosticar') {
      const { data: instancias } = await supabase
        .from('zap_instancias')
        .select('instance_name, ativo')
        .eq('ativo', true);

      const relatorio = [];
      for (const i of (instancias || []) as any[]) {
        try {
          const estado = await estadoConexao(i.instance_name);
          const brutas = await listarConversasBrutas(i.instance_name);
          const sufixos: Record<string, number> = {};
          for (const c of brutas) {
            const jid = c?.remoteJid || c?.id || '';
            const suf = typeof jid === 'string' && jid.includes('@') ? '@' + jid.split('@')[1] : '(sem @)';
            sufixos[suf] = (sufixos[suf] || 0) + 1;
          }
          relatorio.push({
            instancia: i.instance_name,
            estado,
            chats_retornados: brutas.length,
            sufixos_de_jid: sufixos,
            amostra: brutas.slice(0, 3).map((c: any) => c?.remoteJid || c?.id || null),
          });
        } catch (e) {
          relatorio.push({ instancia: i.instance_name, erro: (e as Error).message });
        }
      }
      return json({ ok: true, relatorio });
    }

    if (acao === 'semear') {
      return json({ ok: true, jobs_criados: await semear(supabase) });
    }

    const resultados: any[] = [];
    while (Date.now() - inicio < ORCAMENTO_MS) {
      const { data, error } = await supabase
        .from('zap_backfill_jobs')
        .select('*')
        .in('status', ['pending', 'failed'])
        .lt('tentativas', MAX_TENTATIVAS)
        .order('atualizado_em', { ascending: true })
        .limit(1);
      if (error) throw new Error(`leitura da fila: ${error.message}`);

      const job = (data || [])[0];
      if (!job) break;

      // Marca 'running' antes de trabalhar: se duas rodadas do cron se
      // sobrepuserem, a segunda não pega o mesmo job.
      await supabase
        .from('zap_backfill_jobs')
        .update({ status: 'running', atualizado_em: new Date().toISOString() })
        .eq('id', job.id);

      try {
        const { importadas, ultimaPagina, terminou } = await processarJob(supabase, job);
        await supabase
          .from('zap_backfill_jobs')
          .update({
            // 'done' SÓ quando a conversa acabou. Marcar antes truncaria em
            // silêncio toda conversa maior que o teto de páginas por rodada.
            status: terminou ? 'done' : 'pending',
            ultima_pagina: ultimaPagina,
            mensagens_importadas: (job.mensagens_importadas || 0) + importadas,
            // Tentativas zeram no sucesso: uma falha isolada no meio de uma
            // conversa longa não deve empurrá-la para a dlq rodadas depois.
            tentativas: 0,
            ultimo_erro: null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', job.id);
        resultados.push({ jid: job.remote_jid, importadas, terminou });
      } catch (e) {
        const tentativas = (job.tentativas || 0) + 1;
        await supabase
          .from('zap_backfill_jobs')
          .update({
            // dlq depois do teto: sem isso um contato problemático seria
            // reprocessado para sempre e a fila nunca esvaziaria.
            status: tentativas >= MAX_TENTATIVAS ? 'dlq' : 'failed',
            tentativas,
            ultimo_erro: (e as Error).message.slice(0, 500),
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', job.id);
        resultados.push({ jid: job.remote_jid, erro: (e as Error).message });
      }
    }

    const { count: restantes } = await supabase
      .from('zap_backfill_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed']);

    return json({ ok: true, processados: resultados.length, restantes: restantes ?? null, resultados });
  } catch (e) {
    console.error('zap-backfill:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
