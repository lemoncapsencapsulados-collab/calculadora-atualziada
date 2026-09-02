// Transcreve os áudios pendentes de `zap_mensagens`.
//
// Estágio separado da análise de propósito: transcrever é o item caro do
// pipeline (US$ 0,003 por minuto de áudio, contra centavos por centenas de
// conversas de texto), então o áudio é lido UMA vez e o texto fica guardado.
// Reanalisar depois custa só o texto.
//
// Também é o estágio que isola o provedor: a análise consome
// `zap_mensagens.texto` sem saber se veio de fala ou de digitação.
//
// Não existe tabela de fila aqui: a fila é a própria condição
// "tipo='audio' AND transcrito_em IS NULL", coberta por índice parcial.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { baixarMidia } from '../_shared/evolution.ts';
import { transcrever, ErroIA } from '../_shared/openai.ts';

const ORCAMENTO_MS = 90_000;

/** Teto por rodada. Existe para o gasto ser previsível: você aprova N áudios por vez, não "todos". */
const MAX_POR_RODADA = 40;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // O navegador manda um OPTIONS de preflight antes do POST, sem corpo e sem
  // autenticação. Ele precisa ser respondido ANTES de qualquer validação —
  // exigir corpo JSON aqui devolvia 400 e o navegador abortava com
  // "Failed to send a request to the Edge Function", sem nunca chamar a função.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const inicio = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let limite = MAX_POR_RODADA;
  try {
    const corpo = await req.json();
    const n = Number(corpo?.limite);
    if (Number.isInteger(n) && n > 0) limite = Math.min(n, MAX_POR_RODADA);
  } catch {
    // Sem corpo — cron.
  }

  const contagem = { ok: 0, sem_fala: 0, expirados: 0, erros: 0 };
  let tokensEntrada = 0;
  let tokensSaida = 0;

  try {
    const { data, error } = await supabase
      .from('zap_mensagens')
      .select('instance_name, id, remote_jid, from_me, duracao_segundos')
      .eq('tipo', 'audio')
      .is('transcrito_em', null)
      // Mais novo primeiro: a mídia do WhatsApp expira em ~14-30 dias, então o
      // áudio recente é o único que ainda dá para baixar. Começar pelo antigo
      // gastaria a rodada inteira colecionando 'midia_expirada'.
      .order('momento', { ascending: false })
      .limit(limite);
    if (error) throw new Error(`leitura de pendentes: ${error.message}`);

    for (const m of (data || []) as any[]) {
      if (Date.now() - inicio > ORCAMENTO_MS) break;

      const marcar = (status: string, texto: string | null) =>
        supabase
          .from('zap_mensagens')
          .update({ transcrito_em: new Date().toISOString(), transcricao_status: status, texto })
          .eq('instance_name', m.instance_name)
          .eq('id', m.id);

      try {
        const midia = await baixarMidia(m.instance_name, m.id, m.remote_jid, m.from_me);
        if (!midia) {
          // Perda definitiva, não falha transitória: marcamos para nunca mais
          // tentar. É o destino da maior parte do áudio histórico.
          await marcar('midia_expirada', null);
          contagem.expirados++;
          continue;
        }

        const { dados, uso } = await transcrever(midia.base64, midia.mimetype);
        tokensEntrada += uso.entrada;
        tokensSaida += uso.saida;

        if (!dados.tem_fala || !dados.texto.trim()) {
          await marcar('sem_fala', null);
          contagem.sem_fala++;
        } else {
          await marcar('ok', dados.texto.trim());
          contagem.ok++;
        }
      } catch (e) {
        contagem.erros++;
        const retentavel = e instanceof ErroIA ? e.retentavel : true;
        // Erro retentável NÃO marca `transcrito_em`: o áudio continua pendente e
        // volta na próxima rodada. Erro definitivo é marcado para não travar a fila.
        if (!retentavel) await marcar('erro', null);
        console.error(`transcrever ${m.id}:`, (e as Error).message);
      }
    }

    return json({
      ok: true,
      ...contagem,
      tokens: { entrada: tokensEntrada, saida: tokensSaida },
    });
  } catch (e) {
    console.error('zap-transcrever:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
