// Coleta da Meta em nível de anúncio, dirigida por fila.
//
// Por que fila, se é uma conta só: não é escala, é retomada. A coleta em nível
// de anúncio multiplica o número de chamadas por uma ordem de grandeza, e sem
// checkpoint uma falha transitória no meio do backfill de 180 dias exigiria
// recomeço manual. Com fila, estourar o orçamento de tempo deixa de ser falha e
// vira apenas mais uma rodada — mesmo raciocínio do `ultima_pagina` no backfill
// do ZapVendas.
//
// Duas ações:
//   { action: 'enfileirar', since?, until? }  cria os jobs
//   { action: 'drenar' }                      trabalha os pendentes
//
// A separação existe porque enfileirar é barato e idempotente, enquanto drenar
// é o que consome cota da Meta. O cron chama `drenar` de minuto em minuto e
// `enfileirar` uma vez por dia.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { GRAPH, buscarPagina, deveEsperar } from '../_shared/metaGraph.ts';
import { paraLinhaBase, paraLinhaRecorte, type Recorte } from '../_shared/metaMapear.ts';
import { extrairCriativo, hashCriativo, decidirVersao } from '../_shared/metaCriativo.ts';
import { janelas, iso, somarDias } from '../_shared/metaJanelas.ts';

type Passe = 'base' | 'criativo' | 'plataforma' | 'demografia';

// Ordem de utilidade: `base` sustenta os blocos de visão geral e hierarquia,
// `criativo` sustenta o de copy. Os recortes são enriquecimento — se atrasarem,
// a página continua de pé.
const ORDEM_PASSES: Passe[] = ['base', 'criativo', 'plataforma', 'demografia'];

// A janela de cada passe segue a retenção da tabela que ele alimenta. Enfileirar
// recorte além de 90 dias seria coletar o que o expurgo apaga na primeira
// execução.
const DIAS_RETENCAO: Record<Passe, number> = {
  base: 180,
  criativo: 180,
  plataforma: 90,
  demografia: 90,
};

const MAX_TENTATIVAS = 5;
// Encerra por conta própria antes do teto de parede da função, gravando o
// progresso. Devolver trabalho para a fila é sempre melhor do que ser morto no
// meio de um upsert.
const ORCAMENTO_MS = 50_000;

const CAMPOS_BASE = [
  'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
  'spend', 'impressions', 'clicks', 'reach', 'frequency',
  'actions', 'action_values', 'cost_per_action_type', 'date_start',
].join(',');

// Recorte não carrega `reach` nem `frequency`: não são aditivos entre recortes,
// e tê-los aqui convidaria a somá-los como se fossem.
const CAMPOS_RECORTE = 'ad_id,spend,impressions,clicks,actions,date_start';

const BREAKDOWNS: Record<'plataforma' | 'demografia', string> = {
  plataforma: 'publisher_platform,platform_position',
  demografia: 'age,gender',
};

const RECORTE_DE_PASSE: Record<'plataforma' | 'demografia', Recorte> = {
  plataforma: 'plataforma_posicionamento',
  demografia: 'idade_genero',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function enfileirar(
  supabase: SupabaseClient,
  contas: any[],
  since?: string,
  until?: string
) {
  const hoje = new Date();
  const criados: Record<string, number> = {};

  for (const conta of contas) {
    for (const passe of ORDEM_PASSES) {
      const fim = until ?? iso(hoje);
      const inicio = since ?? iso(somarDias(hoje, -DIAS_RETENCAO[passe]));

      // O passe de criativo é configuração, não série temporal: um job só,
      // sem janela útil. A janela é gravada apenas para a chave única existir.
      const fatias =
        passe === 'criativo' ? [{ inicio: fim, fim }] : janelas(inicio, fim);

      const linhas = fatias.map((f) => ({
        ad_account_id: conta.ad_account_id,
        passe,
        janela_inicio: f.inicio,
        janela_fim: f.fim,
        status: 'pending',
      }));

      // `ignoreDuplicates` torna reenfileirar idempotente: o cron diário
      // reenfileira os últimos 10 dias sem ressuscitar job já concluído.
      const { error } = await supabase
        .from('meta_sync_jobs')
        .upsert(linhas, {
          onConflict: 'ad_account_id,passe,janela_inicio,janela_fim',
          ignoreDuplicates: true,
        });
      if (error) throw error;
      criados[passe] = (criados[passe] ?? 0) + linhas.length;
    }
  }
  return criados;
}

/** Reabre para coleta as janelas que a Meta ainda pode reescrever. */
async function reabrirRecentes(supabase: SupabaseClient, dias = 10) {
  const corte = iso(somarDias(new Date(), -dias));
  const { error } = await supabase
    .from('meta_sync_jobs')
    .update({ status: 'pending', tentativas: 0, cursor_paginacao: null })
    .in('passe', ['base', 'plataforma', 'demografia'])
    .gte('janela_fim', corte)
    .eq('status', 'done');
  if (error) throw error;
}

async function gravarEmLotes(supabase: SupabaseClient, tabela: string, linhas: any[], chave: string) {
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await supabase
      .from(tabela)
      .upsert(linhas.slice(i, i + 200), { onConflict: chave });
    if (error) throw error;
  }
}

async function coletarInsights(
  supabase: SupabaseClient,
  conta: any,
  job: any,
  ateQuando: number
): Promise<{ linhas: number; cursor: string | null }> {
  const ehRecorte = job.passe === 'plataforma' || job.passe === 'demografia';

  const params = new URLSearchParams({
    access_token: conta.access_token,
    level: 'ad',
    time_increment: '1',
    fields: ehRecorte ? CAMPOS_RECORTE : CAMPOS_BASE,
    time_range: JSON.stringify({ since: job.janela_inicio, until: job.janela_fim }),
    limit: '200',
  });
  if (ehRecorte) params.set('breakdowns', BREAKDOWNS[job.passe as 'plataforma' | 'demografia']);

  let proxima: string | null =
    job.cursor_paginacao || `${GRAPH}/${conta.ad_account_id}/insights?${params}`;
  let total = 0;

  while (proxima) {
    const r = await buscarPagina(proxima, conta.ad_account_id);

    if (ehRecorte) {
      const recorte = RECORTE_DE_PASSE[job.passe as 'plataforma' | 'demografia'];
      const linhas = r.linhas.map((l) => paraLinhaRecorte(l, conta.ad_account_id, recorte));
      await gravarEmLotes(
        supabase,
        'meta_insights_ad_recorte',
        linhas,
        'ad_account_id,ad_id,data,recorte,chave_1,chave_2'
      );
      total += linhas.length;
    } else {
      const linhas = r.linhas.map((l) => paraLinhaBase(l, conta.ad_account_id));
      await gravarEmLotes(supabase, 'meta_insights_ad', linhas, 'ad_account_id,ad_id,data');
      total += linhas.length;
    }

    proxima = r.proxima;
    // Parar no limite da conta ou no orçamento de tempo devolve o cursor para a
    // fila — a próxima rodada retoma exatamente daqui.
    if (deveEsperar(r.consumo) || Date.now() > ateQuando) {
      return { linhas: total, cursor: proxima };
    }
  }
  return { linhas: total, cursor: null };
}

async function coletarCriativos(
  supabase: SupabaseClient,
  conta: any,
  job: any,
  ateQuando: number
): Promise<{ linhas: number; cursor: string | null }> {
  const params = new URLSearchParams({
    access_token: conta.access_token,
    fields:
      'id,name,adset_id,campaign_id,status,creative{body,title,image_url,video_id,call_to_action_type,link_url,object_story_spec}',
    limit: '100',
  });

  let proxima: string | null = job.cursor_paginacao || `${GRAPH}/${conta.ad_account_id}/ads?${params}`;
  const hoje = iso(new Date());
  const ontem = iso(somarDias(new Date(), -1));
  let total = 0;

  while (proxima) {
    const r = await buscarPagina(proxima, conta.ad_account_id);

    for (const ad of r.linhas as any[]) {
      const extraido = extrairCriativo(ad);
      if (!extraido.ad_id) continue;
      const hash = await hashCriativo(extraido);

      const { data: vigente } = await supabase
        .from('meta_criativos')
        .select('id, hash_conteudo')
        .eq('ad_id', extraido.ad_id)
        .is('vigente_ate', null)
        .maybeSingle();

      if (decidirVersao(vigente ?? null, hash) === 'manter') continue;

      // Fecha ontem e abre hoje: sem sobreposição e sem lacuna. A imprecisão é
      // que a troca fica datada no dia em que foi detectada — com coleta
      // diária, no máximo um dia de erro.
      if (vigente) {
        const { error } = await supabase
          .from('meta_criativos')
          .update({ vigente_ate: ontem })
          .eq('id', vigente.id);
        if (error) throw error;
      }

      const { error } = await supabase.from('meta_criativos').insert({
        ad_account_id: conta.ad_account_id,
        ...extraido,
        hash_conteudo: hash,
        vigente_desde: hoje,
        vigente_ate: null,
      });
      if (error) throw error;
      total++;
    }

    proxima = r.proxima;
    if (deveEsperar(r.consumo) || Date.now() > ateQuando) {
      return { linhas: total, cursor: proxima };
    }
  }
  return { linhas: total, cursor: null };
}

async function drenar(supabase: SupabaseClient, contas: any[]) {
  const ateQuando = Date.now() + ORCAMENTO_MS;
  const porId = new Map(contas.map((c) => [c.ad_account_id, c]));
  const feitos: any[] = [];

  while (Date.now() < ateQuando) {
    // Ordena por utilidade do passe e, dentro dele, do mais recente para o mais
    // antigo. `janela_fim desc` faz o dado que alguém vai olhar primeiro chegar
    // primeiro, em vez de esperar o backfill inteiro drenar.
    const { data: jobs, error } = await supabase
      .from('meta_sync_jobs')
      .select('*')
      .in('status', ['pending', 'failed'])
      .in('ad_account_id', [...porId.keys()])
      .order('janela_fim', { ascending: false })
      .limit(40);
    if (error) throw error;
    if (!jobs?.length) break;

    const job = jobs
      .slice()
      .sort((a, b) => ORDEM_PASSES.indexOf(a.passe) - ORDEM_PASSES.indexOf(b.passe))[0];
    const conta = porId.get(job.ad_account_id);
    if (!conta) break;

    await supabase
      .from('meta_sync_jobs')
      .update({ status: 'running', atualizado_em: new Date().toISOString() })
      .eq('id', job.id);

    try {
      const r =
        job.passe === 'criativo'
          ? await coletarCriativos(supabase, conta, job, ateQuando)
          : await coletarInsights(supabase, conta, job, ateQuando);

      await supabase
        .from('meta_sync_jobs')
        .update({
          // Cursor pendente significa que o orçamento acabou no meio: volta
          // para a fila em vez de mentir que terminou.
          status: r.cursor ? 'pending' : 'done',
          cursor_paginacao: r.cursor,
          linhas_gravadas: (job.linhas_gravadas ?? 0) + r.linhas,
          ultimo_erro: null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', job.id);

      feitos.push({ passe: job.passe, janela: job.janela_fim, linhas: r.linhas });
    } catch (e) {
      const tentativas = (job.tentativas ?? 0) + 1;
      await supabase
        .from('meta_sync_jobs')
        .update({
          status: tentativas >= MAX_TENTATIVAS ? 'dlq' : 'failed',
          tentativas,
          ultimo_erro: (e as Error).message,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', job.id);
      feitos.push({ passe: job.passe, janela: job.janela_fim, erro: (e as Error).message });
    }
  }
  return feitos;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const action = String(body?.action || 'drenar');

    // Só as contas explicitamente marcadas. A chave existe para "só a da Lemon
    // Caps" continuar verdadeiro sem depender de ninguém lembrar disso.
    const { data: contas, error } = await supabase
      .from('meta_ad_accounts')
      .select('*')
      .eq('ativo', true)
      .eq('coletar_nivel_ad', true);
    if (error) throw error;
    if (!contas?.length) {
      return json(
        { ok: false, error: 'Nenhuma conta marcada com coletar_nivel_ad.' },
        400
      );
    }

    if (action === 'enfileirar') {
      const validData = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const since = validData(body?.since) ? body.since : undefined;
      const until = validData(body?.until) ? body.until : undefined;
      const criados = await enfileirar(supabase, contas, since, until);
      return json({ ok: true, acao: 'enfileirar', criados });
    }

    if (action === 'reabrir') {
      await reabrirRecentes(supabase, Number(body?.dias) || 10);
      return json({ ok: true, acao: 'reabrir' });
    }

    const feitos = await drenar(supabase, contas);
    return json({ ok: true, acao: 'drenar', jobs: feitos });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
