import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const TIPO_LABELS: Record<string, string> = {
  rotulo: 'Rótulo', criativos: 'Criativos', banner: 'Banner', monetizze: 'Conta Monetizze',
};
const TIPO_SETOR: Record<string, string> = {
  rotulo: 'Demanda Designer', criativos: 'Demanda Designer', banner: 'Demanda Designer', monetizze: 'Demanda T.I',
};

/** Regra de negócio: Amido de Milho sempre exibido como Excipiente */
const ofuscar = (nome: string) => (/amido\s+de\s+milho/i.test(nome || '') ? 'Excipiente' : nome);

function descricaoMarkdown(d: any, numeroPedido: string) {
  const dados = d.dados || {};
  const L: string[] = [];
  L.push(`## ${TIPO_LABELS[d.tipo] || d.tipo} — ${TIPO_SETOR[d.tipo] || ''}`);
  L.push('');
  L.push(`- **Pedido:** ${numeroPedido || '—'}`);
  L.push(`- **Cliente:** ${d.cliente_nome || '—'}`);
  L.push(`- **Vendedor responsável:** ${d.vendedor_nome || '—'}`);
  L.push('');

  const produtos = Array.isArray(dados.produtos_pedido) ? dados.produtos_pedido : [];
  if (produtos.length) {
    L.push('### Produtos do pedido');
    produtos.forEach((p: any) => {
      const det = [
        p.tipo_produto,
        p.segmento ? `Segmento: ${p.segmento}` : '',
        p.dose_diaria_sugerida ? `Dose diária: ${p.dose_diaria_sugerida}` : '',
        p.quantidade_por_pote ? `${p.quantidade_por_pote} ${p.unidade_por_pote || 'un'}/pote` : '',
        p.quantidade_doses ? `${p.quantidade_doses} doses/pote` : '',
        p.cor_pote ? `Pote: ${p.cor_pote}` : '',
        p.cor_tampa ? `Tampa: ${p.cor_tampa}` : '',
        p.quantidade ? `${p.quantidade} un. contratadas` : '',
      ].filter(Boolean).join(' | ');
      L.push(`- **${p.nome_produto}** — ${det}`);
      if (Array.isArray(p.insumos) && p.insumos.length) {
        const ins = p.insumos
          .map((i: any) => `${ofuscar(i?.nome || '')}${i?.quantidade ? ` ${i.quantidade}${i.unidade || ''}` : ''}`)
          .filter(Boolean).join(', ');
        if (ins) L.push(`  - Fórmula: ${ins}`);
      }
    });
    L.push('');
  }

  L.push('### Briefing');
  if (d.tipo === 'rotulo') {
    L.push(`- **Tipo de papel:** ${dados.tipo_papel || '—'}`);
    L.push(`- **Nome da marca:** ${dados.sem_marca ? 'Sem marca ainda' : dados.nome_marca || '—'}`);
    L.push(`- **Posicionamento:** ${dados.posicionamento || '—'}`);
    L.push(`- **Estrutura:** ${dados.estrutura || '—'}`);
    (dados.produtos || []).forEach((p: any, i: number) => {
      L.push(`- **Produto ${i + 1}:** ${p.nome_indefinido ? 'Nome indefinido ainda' : p.nome_produto || '—'} | ${p.tipo_produto || '—'} | ${p.quantidade_potes || 0} potes | Segmento: ${p.segmento || '—'}`);
    });
  } else if (d.tipo === 'criativos') {
    (dados.produtos || []).forEach((p: any) => {
      L.push(`- **${p.nome_produto || 'Produto'}:** ${p.quantidade} criativo(s) — ${(p.objetivos || []).join(', ')}`);
    });
  } else if (d.tipo === 'banner') {
    (dados.produtos || []).filter((p: any) => p.selecionado).forEach((p: any) => {
      const fmt = [p.vertical ? '1 banner vertical' : '', p.horizontal ? '1 banner horizontal' : ''].filter(Boolean).join(' + ');
      L.push(`- **${p.nome_produto || 'Produto'}:** ${fmt || '—'}`);
    });
  } else if (d.tipo === 'monetizze') {
    (dados.etapas || []).forEach((e: any) => L.push(`- [${e.concluida ? 'x' : ' '}] ${e.descricao}`));
    if (dados.link_divulgacao) L.push(`- **Link de divulgação:** ${dados.link_divulgacao}`);
  }
  if (dados.observacoes) {
    L.push('');
    L.push(`### Observações\n${dados.observacoes}`);
  }
  return L.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = (Deno.env.get('CLICKUP_API_TOKEN') || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'CLICKUP_API_TOKEN não configurado' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anon.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
    if (userError || !userData?.user) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { demanda_id, numero_pedido, list_id_override } = await req.json();
    if (!demanda_id) return json({ error: 'demanda_id é obrigatório' }, 400);

    const { data: demanda, error: demErr } = await admin
      .from('demandas_marca').select('*').eq('id', demanda_id).maybeSingle();
    if (demErr || !demanda) return json({ error: 'Demanda não encontrada' }, 404);

    const { data: cfg } = await admin
      .from('clickup_demandas_config').select('*').eq('tipo', demanda.tipo).maybeSingle();

    const listId = list_id_override || cfg?.list_id;
    if (!listId) return json({ error: `Configure a lista do ClickUp para "${TIPO_LABELS[demanda.tipo]}" no Painel Administrativo.` }, 400);
    if (cfg && cfg.ativo === false) return json({ error: 'Envio para ClickUp desativado para este tipo de demanda.' }, 400);

    const prefixo = cfg?.prefixo_nome || `${TIPO_LABELS[demanda.tipo]} - `;
    const nomeTask = `${prefixo}${demanda.cliente_nome || 'Cliente'}${numero_pedido ? ` (${numero_pedido})` : ''}`;

    const payload: Record<string, unknown> = {
      name: nomeTask,
      markdown_description: descricaoMarkdown(demanda, numero_pedido || ''),
    };
    const assignees = Array.isArray(cfg?.assignee_ids) ? (cfg!.assignee_ids as any[]).map(Number).filter(Number.isFinite) : [];
    if (assignees.length) payload.assignees = assignees;

    console.log('Criando task ClickUp na lista', listId, '-', nomeTask);
    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('ClickUp task falhou', res.status, txt);
      return json({ error: `ClickUp (${res.status}): ${txt}` }, res.status);
    }
    const task = await res.json();

    // Anexos (referências / logos) enviados junto à demanda
    const arquivos = Array.isArray(demanda.arquivos) ? demanda.arquivos : [];
    const anexosFalhos: string[] = [];
    for (const arq of arquivos) {
      try {
        const { data: file, error } = await admin.storage.from('demandas-marca').download(arq.path);
        if (error || !file) { anexosFalhos.push(arq.nome); continue; }
        const form = new FormData();
        form.append('attachment', file, arq.nome);
        const att = await fetch(`https://api.clickup.com/api/v2/task/${task.id}/attachment`, {
          method: 'POST', headers: { Authorization: token }, body: form,
        });
        if (!att.ok) { anexosFalhos.push(arq.nome); console.error('Anexo falhou', await att.text()); }
      } catch (e) {
        anexosFalhos.push(arq.nome);
        console.error('Erro no anexo', String(e));
      }
    }

    await admin.from('demandas_marca').update({
      clickup_task_id: task.id,
      clickup_task_url: task.url,
      clickup_enviado_em: new Date().toISOString(),
    }).eq('id', demanda_id);

    return json({ ok: true, taskId: task.id, taskUrl: task.url, anexosFalhos });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
