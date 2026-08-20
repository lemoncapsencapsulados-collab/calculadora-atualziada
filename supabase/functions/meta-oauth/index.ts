import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v19.0';

function html(msg: string, redirect?: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Meta Business</title>
  <style>body{font-family:system-ui;background:#0A0A0F;color:#F0F0F5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .c{max-width:520px;text-align:center;padding:32px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#111118}
  a{color:#00E5C3}</style></head><body><div class="c"><p>${msg}</p>
  ${redirect ? `<p><a href="${redirect}">Voltar ao sistema</a></p><script>setTimeout(()=>location.href=${JSON.stringify(redirect)},1500)</script>` : ''}
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const appId = Deno.env.get('META_APP_ID');
  const appSecret = Deno.env.get('META_APP_SECRET');
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  // Facebook exige HTTPS: o runtime entrega req.url como http:// internamente
  const host = req.headers.get('x-forwarded-host') || url.host;
  const path = url.pathname.includes('/functions/v1/')
    ? url.pathname
    : `/functions/v1/${url.pathname.replace(/^\/+/, '')}`;
  const redirectUri = `https://${host}${path}`;
  const rawReturn = url.searchParams.get('return') || url.searchParams.get('state') || '';
  // Aceita apenas URLs absolutas https do app; caso contrário usa fallback relativo
  const appReturn = /^https:\/\//.test(rawReturn) ? rawReturn : '/investimento-anuncios';

  if (!appId || !appSecret) {
    return new Response(html('Integração Meta não configurada: faltam as credenciais do app.'), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (action === 'start') {
    const auth = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    auth.searchParams.set('client_id', appId);
    auth.searchParams.set('redirect_uri', redirectUri);
    auth.searchParams.set('scope', 'ads_read,business_management');
    auth.searchParams.set('state', appReturn);
    auth.searchParams.set('response_type', 'code');
    return Response.redirect(auth.toString(), 302);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return new Response(html('Requisição inválida: código de autorização ausente.'), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    // 1) Troca code -> token curto
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson?.error?.message || 'Falha ao obter token');
    }

    // 2) Token longo (60 dias)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`
    );
    const longJson = await longRes.json();
    const accessToken = longJson.access_token || tokenJson.access_token;
    const expiresIn = Number(longJson.expires_in || 0);

    // 3) Contas de anúncio
    const accRes = await fetch(`${GRAPH}/me/adaccounts?fields=account_id,name&access_token=${accessToken}`);
    const accJson = await accRes.json();
    const contas: any[] = accJson?.data || [];
    if (contas.length === 0) throw new Error('Nenhuma conta de anúncios encontrada nesta Business Manager.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (const c of contas) {
      const adAccountId = `act_${c.account_id}`;
      await supabase.from('meta_ad_accounts').upsert(
        {
          ad_account_id: adAccountId,
          nome: c.name || adAccountId,
          access_token: accessToken,
          token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
          ativo: true,
          last_sync_status: 'conectado',
          last_sync_error: null,
        },
        { onConflict: 'ad_account_id' }
      );
    }

    return new Response(html(`Meta Business conectada (${contas.length} conta(s)). Redirecionando...`, appReturn), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    return new Response(html(`Erro ao conectar: ${(e as Error).message}`, appReturn), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});
