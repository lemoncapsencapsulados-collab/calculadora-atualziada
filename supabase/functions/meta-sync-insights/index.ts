import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v19.0';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function primeiroDia(offsetMeses: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMeses);
  return d.toISOString().slice(0, 10);
}

function ultimoDiaMesAtual(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function extrairLeads(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  const tipos = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.messaging_conversation_started_7d'];
  let total = 0;
  for (const a of actions) {
    if (tipos.includes(a.action_type)) total += Number(a.value) || 0;
  }
  return total;
}

function consultorDaCampanha(nome: string): string | null {
  const m = /consultor[=:_\-\s]+([a-zà-ú]+(?:\s[a-zà-ú]+)?)/i.exec(nome || '');
  return m ? m[1].trim() : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: contas, error } = await supabase
      .from('meta_ad_accounts')
      .select('*')
      .eq('ativo', true);
    if (error) throw error;
    if (!contas || contas.length === 0) {
      return json({ ok: false, error: 'Nenhuma conta Meta conectada.' }, 400);
    }

    // Período: aceita { since, until } no body (sincronização retroativa sob demanda)
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }
    const validData = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const since = validData(body?.since) ? body.since : primeiroDia(-1);
    const until = validData(body?.until) ? body.until : ultimoDiaMesAtual();
    const resultados: any[] = [];

    for (const conta of contas) {
      try {
        const params = new URLSearchParams({
          access_token: conta.access_token,
          level: 'campaign',
          time_increment: '1',
          fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start',
          time_range: JSON.stringify({ since, until }),
          limit: '500',
        });
        let next: string | null = `${GRAPH}/${conta.ad_account_id}/insights?${params}`;
        const linhas: any[] = [];
        while (next) {
          const r = await fetch(next);
          const j = await r.json();
          if (!r.ok) throw new Error(j?.error?.message || `Erro Graph API (${r.status})`);
          linhas.push(...(j.data || []));
          next = j.paging?.next || null;
        }

        const rows = linhas.map((l) => ({
          ad_account_id: conta.ad_account_id,
          data: l.date_start,
          campaign_id: String(l.campaign_id),
          campaign_name: l.campaign_name || null,
          spend: Number(l.spend) || 0,
          impressions: Number(l.impressions) || 0,
          clicks: Number(l.clicks) || 0,
          leads: extrairLeads(l.actions),
          consultor_nome: consultorDaCampanha(l.campaign_name || ''),
        }));

        for (let i = 0; i < rows.length; i += 200) {
          const { error: upErr } = await supabase
            .from('meta_insights')
            .upsert(rows.slice(i, i + 200), { onConflict: 'ad_account_id,data,campaign_id' });
          if (upErr) throw upErr;
        }

        await supabase
          .from('meta_ad_accounts')
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'ok', last_sync_error: null })
          .eq('id', conta.id);

        resultados.push({ conta: conta.ad_account_id, registros: rows.length });
      } catch (e) {
        const msg = (e as Error).message;
        await supabase
          .from('meta_ad_accounts')
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'erro', last_sync_error: msg })
          .eq('id', conta.id);
        resultados.push({ conta: conta.ad_account_id, erro: msg });
      }
    }

    return json({ ok: true, periodo: { since, until }, resultados });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
