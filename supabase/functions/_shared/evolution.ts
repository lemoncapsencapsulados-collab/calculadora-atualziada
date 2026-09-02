// Acesso à Evolution API para os jobs de ingestão.
//
// Separado do `zapvendas/index.ts` de propósito: aquela função é o proxy do
// front, com validação de sessão e de vínculo de instância a cada chamada. Aqui
// quem chama é o cron, com service_role, sobre instâncias que já vieram do banco.

const URL_BASE = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
const API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

/** A Evolution v2.3.7 ignora `limit` em findMessages: quem define o tamanho da página é `offset`. */
const TAMANHO_PAGINA = 100;

export class ErroEvolution extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ErroEvolution';
  }
}

async function chamar(path: string, corpo?: unknown): Promise<any> {
  if (!URL_BASE || !API_KEY) throw new ErroEvolution('EVOLUTION_API_URL/KEY não configurados', 500);

  const res = await fetch(`${URL_BASE}${path}`, {
    method: 'POST',
    headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  });

  const texto = await res.text();
  let payload: any = null;
  try {
    payload = texto ? JSON.parse(texto) : null;
  } catch {
    payload = texto;
  }

  if (!res.ok) {
    const msg = payload?.response?.message || payload?.message || `Evolution respondeu ${res.status}`;
    throw new ErroEvolution(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status);
  }
  return payload;
}

/** Retorno cru do findChats — usado pelo diagnóstico, que precisa ver o que a
 *  Evolution realmente devolve antes de qualquer filtro nosso. */
export async function listarConversasBrutas(instancia: string): Promise<any[]> {
  const dados = await chamar(`/chat/findChats/${encodeURIComponent(instancia)}`);
  return Array.isArray(dados) ? dados : dados?.chats || [];
}

export async function estadoConexao(instancia: string): Promise<string> {
  const url = `${URL_BASE}/instance/connectionState/${encodeURIComponent(instancia)}`;
  const res = await fetch(url, { headers: { apikey: API_KEY } });
  const j = await res.json().catch(() => null);
  return j?.instance?.state || j?.state || `http ${res.status}`;
}

export async function listarConversas(instancia: string): Promise<string[]> {
  const lista = await listarConversasBrutas(instancia);
  const jids = new Set<string>();
  for (const c of lista) {
    const jid = c?.remoteJid || c?.id;
    if (typeof jid !== 'string' || !jid.includes('@')) continue;

    // Grupos ficam de fora: não são atendimento individual e poluiriam toda
    // métrica por contato com conversas de dezenas de pessoas.
    if (jid.endsWith('@g.us')) continue;
    if (jid === 'status@broadcast') continue;

    // DOIS formatos de contato individual, não um. O WhatsApp migrou para LID
    // (Linked ID) e hoje a maioria dos contatos chega como `@lid`; só os
    // antigos vêm como `@s.whatsapp.net`. Aceitar apenas o formato antigo
    // descartava silenciosamente quase todas as conversas.
    if (!jid.endsWith('@lid') && !jid.endsWith('@s.whatsapp.net')) continue;

    // `0@s.whatsapp.net` é um placeholder de sistema, não um contato.
    const local = jid.split('@')[0];
    if (!local || local === '0') continue;

    jids.add(jid);
  }
  return Array.from(jids);
}

/** Uma página de mensagens da conversa, da mais nova para a mais antiga. */
export async function listarMensagens(
  instancia: string,
  remoteJid: string,
  pagina: number
): Promise<any[]> {
  const dados = await chamar(`/chat/findMessages/${encodeURIComponent(instancia)}`, {
    where: { key: { remoteJid } },
    offset: TAMANHO_PAGINA,
    page: pagina,
  });
  if (Array.isArray(dados)) return dados;
  return dados?.messages?.records || [];
}

export interface Midia {
  base64: string;
  mimetype: string;
}

/**
 * Baixa a mídia de uma mensagem. Devolve `null` quando a mídia EXPIROU — a URL
 * do CDN do WhatsApp vive ~14-30 dias e esta Evolution não guarda cópia
 * (S3_ENABLED=false). Não é erro transitório: é perda definitiva, e quem chama
 * precisa marcar o áudio como irrecuperável em vez de reenfileirar.
 */
export async function baixarMidia(
  instancia: string,
  messageId: string,
  remoteJid: string,
  fromMe: boolean
): Promise<Midia | null> {
  try {
    const dados = await chamar(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
      message: { key: { id: messageId, remoteJid, fromMe } },
    });
    const base64 = dados?.base64;
    if (typeof base64 !== 'string' || !base64) return null;
    return { base64, mimetype: dados?.mimetype || 'audio/ogg' };
  } catch (e) {
    if (e instanceof ErroEvolution && e.status === 400 && /failed to fetch stream/i.test(e.message)) {
      return null;
    }
    throw e;
  }
}
