import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('CLICKUP_API_TOKEN');
    const listId = Deno.env.get('CLICKUP_LIST_CONTRATOS_ID');
    if (!token || !listId) {
      return new Response(JSON.stringify({ error: 'ClickUp não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { taskName, description, arquivoUrl, arquivoNome } = body as {
      taskName: string; description?: string; arquivoUrl: string; arquivoNome: string;
    };

    if (!taskName || !arquivoUrl || !arquivoNome) {
      return new Response(JSON.stringify({ error: 'taskName, arquivoUrl e arquivoNome são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Cria a task
    console.log('Creating ClickUp task in list', listId, 'name:', taskName);
    const taskRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: taskName, description: description || '' }),
    });
    if (!taskRes.ok) {
      const txt = await taskRes.text();
      console.error('ClickUp task creation failed', taskRes.status, txt);
      return new Response(JSON.stringify({ error: `ClickUp task: ${txt}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const task = await taskRes.json();
    const taskId: string = task.id;
    console.log('Task created', taskId);

    // 2) Baixa o arquivo e anexa
    const fileRes = await fetch(arquivoUrl);
    if (!fileRes.ok) {
      console.error('File download failed', fileRes.status);
      return new Response(JSON.stringify({ error: 'Falha ao baixar arquivo', taskId, taskUrl: task.url }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: `ClickUp attachment: ${txt}`, taskId, taskUrl: task.url }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, taskId, taskUrl: task.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});