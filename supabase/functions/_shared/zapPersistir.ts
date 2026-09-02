// Grava mensagens normalizadas e mantém `zap_contatos` coerente.
//
// Compartilhado entre webhook e backfill porque os dois escrevem na mesma
// conversa ao mesmo tempo: o webhook recebendo o que chega agora, o backfill
// varrendo o passado. Toda a estratégia de concorrência mora aqui.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { LinhaMensagem } from './zapNormalizar.ts';

/** Lote do upsert. Acima disso o payload da PostgREST fica grande demais e começa a dar timeout. */
const LOTE = 200;

/**
 * `nomes` mapeia remote_jid -> nome de exibição, extraído do `pushName` das
 * mensagens RECEBIDAS. Vem por fora porque `pushName` não é campo de
 * `zap_mensagens` — é atributo do contato, não da mensagem, e só o cliente o
 * informa (no que o consultor envia, `pushName` é o nome do próprio vendedor).
 */
export async function salvarMensagens(
  supabase: SupabaseClient,
  linhas: LinhaMensagem[],
  nomes: Map<string, string> = new Map()
): Promise<number> {
  if (linhas.length === 0) return 0;

  // Dedup dentro do próprio lote: a Evolution repete mensagem na paginação, e
  // um upsert com duas linhas de mesma chave falha ("ON CONFLICT DO UPDATE
  // command cannot affect row a second time").
  const porChave = new Map<string, LinhaMensagem>();
  for (const l of linhas) porChave.set(`${l.instance_name}|${l.id}`, l);
  const unicas = Array.from(porChave.values());

  for (let i = 0; i < unicas.length; i += LOTE) {
    const { error } = await supabase
      .from('zap_mensagens')
      .upsert(unicas.slice(i, i + LOTE), {
        onConflict: 'instance_name,id',
        // A mensagem já gravada pode ter transcrição que este lote não traz.
        // Sem `ignoreDuplicates`, o backfill sobrescreveria o texto transcrito
        // com o `null` original e o áudio voltaria para a fila para sempre.
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`upsert zap_mensagens: ${error.message}`);
  }

  await atualizarContatos(supabase, unicas, nomes);
  await recalcularTurnos(supabase, unicas);
  return unicas.length;
}

/**
 * Mantém `zap_turnos_cache` em dia para as conversas tocadas.
 *
 * O cálculo de turnos depende só das mensagens, que não mudam depois de
 * gravadas — então ele acontece aqui, uma vez por escrita, em vez de a cada
 * abertura do painel. Sem isso a consulta de métricas levava 7s e crescendo.
 *
 * Falha aqui NÃO derruba a ingestão: a mensagem já está gravada, e o cache pode
 * ser reconstruído depois com `zap_recalcular_turnos_todos()`. Perder a
 * mensagem seria irreversível; perder o cache, não.
 */
async function recalcularTurnos(supabase: SupabaseClient, linhas: LinhaMensagem[]): Promise<void> {
  const conversas = new Set(linhas.map((l) => `${l.instance_name}|${l.remote_jid}`));
  for (const chave of conversas) {
    const [instance, jid] = chave.split('|');
    const { error } = await supabase.rpc('zap_recalcular_turnos', {
      p_instance: instance,
      p_jid: jid,
    });
    if (error) console.error(`recalcular turnos ${jid}: ${error.message}`);
  }
}

/**
 * Recalcula os agregados do contato a partir da tabela, em vez de incrementar
 * contadores. Incremento é rápido mas perde a corrida entre webhook e backfill:
 * os dois somariam sobre o mesmo estado lido e o total ficaria menor que o real.
 * Recalcular é idempotente — rodar duas vezes dá o mesmo número.
 */
async function atualizarContatos(
  supabase: SupabaseClient,
  linhas: LinhaMensagem[],
  nomes: Map<string, string>
): Promise<void> {
  const conversas = new Map<string, { instance_name: string; remote_jid: string }>();
  for (const l of linhas) {
    const chave = `${l.instance_name}|${l.remote_jid}`;
    if (!conversas.has(chave)) {
      conversas.set(chave, { instance_name: l.instance_name, remote_jid: l.remote_jid });
    }
  }

  for (const c of conversas.values()) {
    const { data, error } = await supabase
      .from('zap_mensagens')
      .select('momento')
      .eq('instance_name', c.instance_name)
      .eq('remote_jid', c.remote_jid)
      .order('momento', { ascending: true });
    if (error) throw new Error(`agregado do contato: ${error.message}`);

    const momentos = (data || []) as { momento: string }[];
    if (momentos.length === 0) continue;

    const nome = nomes.get(c.remote_jid);
    const { error: upErr } = await supabase.from('zap_contatos').upsert(
      {
        instance_name: c.instance_name,
        remote_jid: c.remote_jid,
        // Só sobrescreve quando este lote trouxe um nome; passar `undefined`
        // faz a PostgREST omitir a coluna e preservar o que já estava lá.
        ...(nome ? { nome } : {}),
        // Só extrai telefone de JID no formato antigo. Num `@lid` a parte
        // local é um identificador interno do WhatsApp, NÃO um número — gravá-lo
        // como telefone encheria a coluna de lixo e quebraria qualquer
        // casamento futuro com `clientes.telefone`.
        telefone: c.remote_jid.endsWith('@s.whatsapp.net')
          ? c.remote_jid.split('@')[0] || null
          : null,
        primeira_mensagem_at: momentos[0].momento,
        ultima_mensagem_at: momentos[momentos.length - 1].momento,
        total_mensagens: momentos.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'instance_name,remote_jid' }
    );
    if (upErr) throw new Error(`upsert zap_contatos: ${upErr.message}`);
  }
}
