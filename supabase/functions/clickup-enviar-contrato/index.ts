import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const token = Deno.env.get('CLICKUP_API_TOKEN');
    const listId = Deno.env.get('CLICKUP_LIST_CONTRATOS_ID');
    if (!token || !listId) return jsonResponse({ error: 'ClickUp não configurado' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return jsonResponse({ error: 'Não autenticado' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      console.error('Invalid auth user', userError?.message || 'user ausente');
      return jsonResponse({ error: 'Não autenticado' }, 401);
    }

    const body = await req.json();
    const { taskName, description, arquivoUrl, arquivoNome, assignees } = body as {
      taskName: string; description?: string; arquivoUrl: string; arquivoNome: string;
      assignees?: number[];
    };

    if (!taskName || !arquivoUrl || !arquivoNome) {
      return jsonResponse({ error: 'taskName, arquivoUrl e arquivoNome são obrigatórios' }, 400);
    }

    // 1) Cria a task
    console.log('Creating ClickUp task in list', listId, 'name:', taskName);
    const taskPayload: Record<string, unknown> = { name: taskName, description: description || '' };
    if (Array.isArray(assignees) && assignees.length > 0) {
      taskPayload.assignees = assignees.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    }
    const taskRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(taskPayload),
    });
    if (!taskRes.ok) {
      const txt = await taskRes.text();
      console.error('ClickUp task creation failed', taskRes.status, txt);
      return jsonResponse({ ok: false, error: `ClickUp task (${taskRes.status}): ${txt}` });
    }
    const task = await taskRes.json();
    const taskId: string = task.id;
    console.log('Task created', taskId);

    // 2) Baixa o arquivo e anexa
    const fileRes = await fetch(arquivoUrl);
    if (!fileRes.ok) {
      console.error('File download failed', fileRes.status);
      return jsonResponse({ ok: false, error: `Falha ao baixar arquivo (${fileRes.status})`, taskId, taskUrl: task.url });
    }
    const blob = await fileRes.blob();
    const form = new FormData();
    form.append('attachment', blob, arquivoNome);

    const attRes = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
      method: 'POST',
      headers: { Authorization: token },
      body: form,
    });
    if (!attRes.ok) {
      const txt = await attRes.text();
      console.error('ClickUp attachment failed', attRes.status, txt);
      return jsonResponse({ ok: false, error: `ClickUp attachment (${attRes.status}): ${txt}`, taskId, taskUrl: task.url });
    }

    return jsonResponse({ ok: true, taskId, taskUrl: task.url });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});