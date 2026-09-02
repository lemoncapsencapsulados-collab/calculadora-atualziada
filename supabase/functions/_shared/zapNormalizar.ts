// Converte uma mensagem crua da Evolution na linha de `zap_mensagens`.
//
// Existe como módulo compartilhado porque DUAS portas escrevem nessa tabela — o
// webhook (mensagem nova) e o backfill (histórico) — e elas se cruzam no mesmo
// contato. Se cada uma normalizasse por conta própria, a mesma mensagem entraria
// com tipo ou texto diferente dependendo de quem chegou primeiro, e as métricas
// mudariam sozinhas conforme o backfill avançasse.
//
// A lógica espelha `extrairTexto`/`tipoMidia` do front (src/hooks/useZapVendas.ts)
// de propósito: o que o painel mostra e o que a métrica conta têm de ser a mesma
// leitura da mesma mensagem.

export interface MensagemEvolution {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string };
  message?: Record<string, unknown> | null;
  messageTimestamp?: number | string;
  pushName?: string;
}

export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'video' | 'documento' | 'outro';

export interface LinhaMensagem {
  instance_name: string;
  id: string;
  remote_jid: string;
  from_me: boolean;
  momento: string;
  tipo: TipoMensagem;
  texto: string | null;
  duracao_segundos: number | null;
  dominios_links: string[];
}

function conteudo(m: MensagemEvolution): Record<string, any> | null {
  const msg = m?.message;
  return msg && typeof msg === 'object' ? (msg as Record<string, any>) : null;
}

export function tipoDe(m: MensagemEvolution): TipoMensagem {
  const msg = conteudo(m);
  if (!msg) return 'outro';
  if (msg.imageMessage) return 'imagem';
  if (msg.audioMessage) return 'audio';
  if (msg.videoMessage) return 'video';
  if (msg.documentMessage) return 'documento';
  if (typeof msg.conversation === 'string' || msg.extendedTextMessage) return 'texto';
  return 'outro';
}

export function textoDe(m: MensagemEvolution): string {
  const msg = conteudo(m);
  if (!msg) return '';
  if (typeof msg.conversation === 'string') return msg.conversation;
  if (typeof msg.extendedTextMessage?.text === 'string') return msg.extendedTextMessage.text;
  // Legenda de mídia é texto legítimo do consultor — costuma carregar o preço,
  // o nome da fórmula ou a instrução que acompanha a foto.
  if (typeof msg.imageMessage?.caption === 'string') return msg.imageMessage.caption;
  if (typeof msg.videoMessage?.caption === 'string') return msg.videoMessage.caption;
  return '';
}

function duracaoDe(m: MensagemEvolution): number | null {
  const msg = conteudo(m);
  const s = msg?.audioMessage?.seconds ?? msg?.videoMessage?.seconds;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Domínios dos links presentes no texto. Guardamos o domínio, não a URL inteira:
 * é o que responde "mandou catálogo?" e "mandou link de reunião?" sem carregar
 * parâmetros de rastreio ou token que possam estar na query string.
 */
export function dominiosDe(texto: string): string[] {
  if (!texto) return [];
  const encontrados = texto.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  const dominios = new Set<string>();
  for (const bruta of encontrados) {
    try {
      dominios.add(new URL(bruta).hostname.replace(/^www\./i, '').toLowerCase());
    } catch {
      // URL malformada no meio do texto — ignorada, não vale derrubar a ingestão.
    }
  }
  return Array.from(dominios);
}

/**
 * Devolve `null` para mensagens que não têm identidade utilizável. Sem `key.id`
 * o upsert não é idempotente e o backfill duplicaria tudo a cada retomada.
 */
export function normalizar(m: MensagemEvolution, instanceName: string): LinhaMensagem | null {
  const id = m?.key?.id;
  const remoteJid = m?.key?.remoteJid;
  if (!id || !remoteJid) return null;

  // A Evolution manda epoch em segundos, às vezes como string.
  const epoch = Number(m?.messageTimestamp);
  if (!Number.isFinite(epoch) || epoch <= 0) return null;

  const texto = textoDe(m);
  return {
    instance_name: instanceName,
    id,
    remote_jid: remoteJid,
    from_me: Boolean(m?.key?.fromMe),
    momento: new Date(epoch * 1000).toISOString(),
    tipo: tipoDe(m),
    texto: texto || null,
    duracao_segundos: duracaoDe(m),
    dominios_links: dominiosDe(texto),
  };
}
