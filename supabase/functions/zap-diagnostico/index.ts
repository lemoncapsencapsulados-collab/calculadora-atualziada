// Diagnóstico da Evolution: mostra o que a API REALMENTE devolve.
//
// Existe porque duas perguntas não se respondem lendo documentação:
//   1. Um contato `@lid` traz o telefone em algum campo? Hoje `zap_contatos`
//      tem 2.259 contatos e telefone nulo em TODOS — sem isso não há como
//      contatar quem ficou sem atendimento nem casar conversa com cliente.
//   2. A instância expõe as etiquetas que os consultores atribuíram?
//
// TEMPORÁRIA. Some assim que as duas respostas virarem código.
//
// Devolve o payload cru, com as chaves à mostra, em vez de um resumo já
// interpretado: o objetivo é justamente ver o que ninguém previu.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_BASE = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
const API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Tenta um endpoint e devolve o que veio — inclusive o erro, que também é
 *  resposta: saber que `/label/findLabels` não existe nesta versão vale tanto
 *  quanto saber que existe. */
async function tentar(metodo: 'GET' | 'POST', path: string, corpo?: unknown) {
  try {
    const res = await fetch(`${URL_BASE}${path}`, {
      method: metodo,
      headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
      ...(metodo === 'POST' ? { body: JSON.stringify(corpo ?? {}) } : {}),
    });
    const texto = await res.text();
    let payload: unknown;
    try {
      payload = texto ? JSON.parse(texto) : null;
    } catch {
      payload = texto.slice(0, 300);
    }
    return { path, status: res.status, ok: res.ok, payload };
  } catch (e) {
    return { path, status: 0, ok: false, erro: (e as Error).message };
  }
}

/** Só as chaves e o tipo de cada uma, mais uma amostra curta do valor. É o que
 *  permite achar um campo de telefone sem despejar conversa inteira no log. */
function formato(obj: unknown): Record<string, string> {
  if (!obj || typeof obj !== 'object') return { _tipo: typeof obj };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const t = Array.isArray(v) ? `array[${v.length}]` : typeof v;
    const amostra =
      v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 80);
    out[k] = `${t}: ${amostra}`;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!URL_BASE || !API_KEY) return json({ ok: false, error: 'EVOLUTION_API_URL/KEY ausentes' }, 500);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let corpo: any = {};
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }

  // Sem instância no corpo, usa a que tem mais mensagens — é a que interessa.
  let instancia = String(corpo?.instancia || '').trim();
  if (!instancia) {
    const { data } = await supabase
      .from('zap_mensagens')
      .select('instance_name')
      .limit(1000);
    const cont = new Map<string, number>();
    for (const r of (data ?? []) as any[]) {
      cont.set(r.instance_name, (cont.get(r.instance_name) ?? 0) + 1);
    }
    instancia = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }
  if (!instancia) return json({ ok: false, error: 'nenhuma instância encontrada' }, 400);

  const inst = encodeURIComponent(instancia);

  // Rodada 2: achar o elo etiqueta -> contato. A lista de etiquetas já veio por
  // `/label/findLabels`; falta saber QUEM está em cada uma.
  const idEtiqueta = String(corpo?.label_id || '8'); // 8 = LEAD nesta conta
  const [chats, contatosPost, contatosGet, labelsGet, porLabel1, porLabel2, porLabel3] =
    await Promise.all([
      tentar('POST', `/chat/findChats/${inst}`),
      tentar('POST', `/chat/findContacts/${inst}`, {}),
      tentar('GET', `/chat/findContacts/${inst}`),
      tentar('GET', `/label/findLabels/${inst}`),
      tentar('GET', `/label/findChats/${inst}/${idEtiqueta}`),
      tentar('POST', `/label/findChatsByLabelId/${inst}`, { labelId: idEtiqueta }),
      tentar('POST', `/label/findChats/${inst}`, { labelId: idEtiqueta }),
    ]);
  // Varre TODOS os chats atrás de qualquer campo que cheire a etiqueta. Se o
  // vínculo existir no payload, aparece aqui; se não aparecer, ele não vem por
  // esta rota e a associação tem de vir de outro lugar.
  const varredura = await tentar('POST', `/chat/findChats/${inst}`);
  const todos: any[] = Array.isArray(varredura.payload) ? varredura.payload : [];
  const chavesComLabel = new Set<string>();
  let exemploComLabel: unknown = null;
  for (const c of todos) {
    for (const k of Object.keys(c ?? {})) {
      if (/label|etiqueta|tag/i.test(k)) {
        chavesComLabel.add(k);
        if (!exemploComLabel && (c as any)[k]) exemploComLabel = { remoteJid: c.remoteJid, [k]: (c as any)[k] };
      }
    }
  }
  const labelsPost = { status: 0, payload: null };

  // Do findChats, o formato de um item `@lid` e de um `@s.whatsapp.net`, se
  // houver: comparar os dois é o que revela onde mora o telefone.
  const listaChats: any[] = Array.isArray(chats.payload)
    ? chats.payload
    : (chats.payload as any)?.chats ?? [];
  const umLid = listaChats.find((c) => String(c?.remoteJid ?? c?.id ?? '').endsWith('@lid'));
  const umAntigo = listaChats.find((c) =>
    String(c?.remoteJid ?? c?.id ?? '').endsWith('@s.whatsapp.net')
  );

  const listaContatos: any[] = Array.isArray(contatosPost.payload)
    ? contatosPost.payload
    : Array.isArray(contatosGet.payload)
      ? (contatosGet.payload as any[])
      : [];

  return json({
    ok: true,
    instancia,
    chats: {
      status: chats.status,
      total: listaChats.length,
      formato_item_lid: umLid ? formato(umLid) : 'nenhum @lid no findChats',
      formato_item_antigo: umAntigo ? formato(umAntigo) : 'nenhum @s.whatsapp.net',
    },
    contatos: {
      status_post: contatosPost.status,
      status_get: contatosGet.status,
      total: listaContatos.length,
      formato_item: listaContatos[0] ? formato(listaContatos[0]) : 'lista vazia',
      // Se algum contato trouxer telefone junto do lid, é aqui que aparece.
      exemplos: listaContatos.slice(0, 3).map((c) => formato(c)),
    },
    etiquetas: {
      lista: { status: labelsGet.status, total: Array.isArray(labelsGet.payload) ? labelsGet.payload.length : 0 },
      // Qual destas rotas devolve os contatos de uma etiqueta decide se dá para
      // filtrar por etiqueta sem varrer conversa por conversa.
      tentativa_findChats_por_id: {
        rota: `/label/findChats/${instancia}/${idEtiqueta}`,
        status: porLabel1.status,
        amostra: JSON.stringify(porLabel1.payload).slice(0, 400),
      },
      tentativa_findChatsByLabelId: {
        status: porLabel2.status,
        amostra: JSON.stringify(porLabel2.payload).slice(0, 400),
      },
      tentativa_label_findChats_post: {
        status: porLabel3.status,
        amostra: JSON.stringify(porLabel3.payload).slice(0, 300),
      },
      varredura_campos_de_etiqueta_nos_chats: {
        chats_varridos: todos.length,
        campos_encontrados: [...chavesComLabel],
        exemplo: exemploComLabel,
      },
    },
    // O `key` da última mensagem pode trazer o telefone de um `@lid` em
    // `participantPn`/`senderPn` — segunda fonte possível para o número.
    chave_ultima_mensagem: JSON.stringify((umLid as any)?.lastMessage?.key ?? null),
  });
});
