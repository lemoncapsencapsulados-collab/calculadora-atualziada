// Recebe da VPS o que a API da Evolution não entrega.
//
// Duas coisas moram no Postgres da Evolution e não saem por REST:
//   1. `Chat.labels` — quem está em cada etiqueta. Nenhuma rota devolve isso;
//      verificado com 404 nas específicas e zero campos de etiqueta em 918
//      chats varridos.
//   2. O telefone de contatos `@lid`, que vem em `key.remoteJidAlt` dentro de
//      `Message`. A partir de agora o webhook capta sozinho; isto é o que
//      recupera o pouco que já está gravado.
//
// O Postgres da Evolution não é exposto para fora da VPS — de propósito, e
// melhor assim. Então quem lê é um script lá dentro, que empurra para cá.
//
// `verify_jwt = false` porque quem chama é um cron da VPS, sem sessão do
// Supabase. Em troca exige segredo compartilhado: sem ele, qualquer um na
// internet reescreveria as etiquetas e os telefones da base.

import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Comparação em tempo constante — mesmo cuidado do `zap-webhook`. Um `!==`
 *  vaza, pelo tempo de resposta, quantos caracteres o atacante acertou. */
function segredoConfere(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recebido.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

interface Corpo {
  instancia?: string;
  etiquetas?: Array<{ label_id: string; nome: string; cor?: string | null }>;
  associacoes?: Array<{ remote_jid: string; label_ids: string[]; nome?: string | null }>;
  telefones?: Array<{ remote_jid: string; telefone: string }>;
  nomes?: Array<{ remote_jid: string; nome: string }>;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'método não suportado' }, 405);

  const esperado = (Deno.env.get('ZAP_SYNC_SECRET') || '').trim();
  if (!esperado) {
    console.error('ZAP_SYNC_SECRET não configurado — recusando tudo');
    return json({ ok: false, error: 'sincronização não configurada' }, 500);
  }
  if (!segredoConfere((req.headers.get('x-zap-secret') || '').trim(), esperado)) {
    return json({ ok: false, error: 'não autorizado' }, 401);
  }

  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, error: 'corpo inválido' }, 400);
  }

  const instancia = String(corpo?.instancia || '').trim();
  if (!instancia) return json({ ok: false, error: 'instancia ausente' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const agora = new Date().toISOString();
  const resultado: Record<string, number> = {};

  try {
    // --- Catálogo de etiquetas
    const etiquetas = (corpo.etiquetas ?? []).filter((e) => e?.label_id && e?.nome);
    if (etiquetas.length) {
      const { error } = await supabase.from('zap_etiquetas').upsert(
        etiquetas.map((e) => ({
          instance_name: instancia,
          label_id: String(e.label_id),
          nome: String(e.nome),
          cor: e.cor ?? null,
          atualizado_em: agora,
        })),
        { onConflict: 'instance_name,label_id' }
      );
      if (error) throw error;
      resultado.etiquetas = etiquetas.length;
    }

    // --- Associações
    //
    // Substituição completa por instância, não merge: etiqueta REMOVIDA no
    // WhatsApp precisa sumir daqui. Só somar deixaria a base afirmando que um
    // contato ainda está em 'EM NEGOCIAÇÃO' meses depois de o consultor tirar.
    if (Array.isArray(corpo.associacoes)) {
      const linhas = corpo.associacoes.flatMap((a) =>
        (a?.label_ids ?? []).map((id) => ({
          instance_name: instancia,
          remote_jid: String(a.remote_jid),
          label_id: String(id),
          // Nome vem daqui porque boa parte dos contatos etiquetados não tem
          // conversa em `zap_contatos` — na conta do Emmanuel, 1.532 chats
          // existem mas só 877 têm mensagem na própria Evolution.
          nome: a.nome ? String(a.nome) : null,
          atualizado_em: agora,
        }))
      );

      const { error: delErr } = await supabase
        .from('zap_contato_etiquetas')
        .delete()
        .eq('instance_name', instancia);
      if (delErr) throw delErr;

      for (let i = 0; i < linhas.length; i += 500) {
        const { error } = await supabase
          .from('zap_contato_etiquetas')
          .upsert(linhas.slice(i, i + 500), {
            onConflict: 'instance_name,remote_jid,label_id',
          });
        if (error) throw error;
      }
      resultado.associacoes = linhas.length;
    }

    // --- Telefones
    //
    // `update` e não `upsert`: o contato tem de existir. Criar linha aqui
    // inventaria contato sem nenhuma mensagem, que poluiria toda contagem de
    // base. Só preenche o que está vazio — o webhook é a fonte corrente.
    const telefones = (corpo.telefones ?? []).filter((t) => t?.remote_jid && t?.telefone);
    let gravados = 0;
    for (const t of telefones) {
      const { error, count } = await supabase
        .from('zap_contatos')
        .update({ telefone: String(t.telefone), updated_at: agora }, { count: 'exact' })
        .eq('instance_name', instancia)
        .eq('remote_jid', String(t.remote_jid))
        .is('telefone', null);
      if (error) throw error;
      gravados += count ?? 0;
    }
    resultado.telefones_preenchidos = gravados;
    resultado.telefones_recebidos = telefones.length;

    // --- Nomes
    //
    // Sem isto, `zap_contatos.nome` guarda o número do `@lid` — 848 de 879 na
    // conta do Emmanuel. Um parecer que cita "168165401202940 esperou 326h" não
    // serve para ninguém; citando "Cristiana", serve. A fonte é o `pushName` de
    // mensagem recebida, que cobre 782 de 918 conversas.
    //
    // Só sobrescreve nome ausente ou puramente numérico: nome já legível pode
    // ter sido corrigido à mão e não deve ser pisado.
    const nomes = (corpo.nomes ?? []).filter((n) => n?.remote_jid && n?.nome);
    let nomesGravados = 0;
    for (const n of nomes) {
      const { data: atual } = await supabase
        .from('zap_contatos')
        .select('nome')
        .eq('instance_name', instancia)
        .eq('remote_jid', String(n.remote_jid))
        .maybeSingle();
      if (!atual) continue;
      const atualNome = String(atual.nome ?? '').trim();
      if (atualNome && !/^\d+$/.test(atualNome)) continue;

      const { error } = await supabase
        .from('zap_contatos')
        .update({ nome: String(n.nome).trim(), updated_at: agora })
        .eq('instance_name', instancia)
        .eq('remote_jid', String(n.remote_jid));
      if (error) throw error;
      nomesGravados++;
    }
    resultado.nomes_preenchidos = nomesGravados;

    return json({ ok: true, instancia, ...resultado });
  } catch (e) {
    console.error('zap-sync-evolution:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
