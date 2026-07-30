import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = (Deno.env.get('CLICKUP_API_TOKEN') || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
    const defaultListId = Deno.env.get('CLICKUP_LIST_CONTRATOS_ID');
    if (!token) return jsonResponse({ error: 'ClickUp não configurado' }, 500);

    const url = new URL(req.url);
    const listId = url.searchParams.get('list_id') || defaultListId;
    if (!listId) return jsonResponse({ error: 'list_id não informado' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) return jsonResponse({ error: 'Não autenticado' }, 401);

    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/member`, {
      headers: { Authorization: token, accept: 'application/json' },
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('ClickUp members failed', res.status, txt);
      return jsonResponse({ error: `ClickUp (${res.status}): ${txt}` }, 500);
    }
    const data = await res.json();
    const members = (data.members || []).map((m: any) => ({
      id: m.id,
      username: m.username,
      email: m.email,
      color: m.color,
      profilePicture: m.profilePicture,
    }));
    return jsonResponse({ members });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});