// Transcrição de áudio pela OpenAI — DORMENTE.
//
// A análise de texto migrou para a Anthropic (`anthropic.ts`). Este arquivo
// sobrevive porque a Anthropic não aceita áudio: quando a transcrição for
// habilitada, é aqui que ela acontece, com `OPENAI_API_KEY` própria.
//
// Enquanto o secret não existir, `zap-transcrever` falha de forma explícita
// ("OPENAI_API_KEY não configurada") em vez de silenciosamente não fazer nada.

const BASE = 'https://api.openai.com/v1';

/** ~US$ 0,003 por minuto de áudio — metade do Whisper. */
const MODELO_AUDIO = Deno.env.get('OPENAI_MODEL_AUDIO') || 'gpt-4o-mini-transcribe';

const TIMEOUT_MS = 120_000;

export interface Uso {
  entrada: number;
  saida: number;
}

export interface RespostaIA<T> {
  dados: T;
  uso: Uso;
}

export class ErroIA extends Error {
  constructor(message: string, readonly status: number, readonly retentavel: boolean) {
    super(message);
    this.name = 'ErroIA';
  }
}

function chave(): string {
  const k = (Deno.env.get('OPENAI_API_KEY') || '').trim();
  if (!k) throw new ErroIA('OPENAI_API_KEY não configurada', 500, false);
  return k;
}

async function comTimeout(url: string, init: RequestInit): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Converte base64 em bytes sem estourar a pilha em áudios grandes. */
function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Extensão que a OpenAI aceita, deduzida do mimetype que a Evolution informa. */
function extensaoDe(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('wav')) return 'wav';
  if (m.includes('webm')) return 'webm';
  return 'ogg';
}

/**
 * Transcreve um áudio pelo endpoint dedicado de fala.
 *
 * Devolve o mesmo formato que a versão Gemini (`tem_fala` + `texto`) para o
 * chamador não mudar. `tem_fala: false` distingue "áudio sem voz" de "ainda não
 * transcrito" — sem isso, um áudio mudo voltaria para a fila para sempre.
 */
export async function transcrever(
  base64: string,
  mimeType: string
): Promise<RespostaIA<{ texto: string; tem_fala: boolean }>> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([base64ParaBytes(base64)], { type: mimeType }),
    `audio.${extensaoDe(mimeType)}`
  );
  form.append('model', MODELO_AUDIO);
  // Fixar o idioma melhora a precisão e evita o modelo "traduzir" gíria rural
  // para um português neutro.
  form.append('language', 'pt');

  // Mesma razão do `gerarJson`: fora do try, para não virar "falha de rede".
  const autorizacao = `Bearer ${chave()}`;

  let res: Response;
  try {
    res = await comTimeout(`${BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: autorizacao },
      body: form,
    });
  } catch (e) {
    throw new ErroIA(`falha de rede: ${(e as Error).message}`, 0, true);
  }

  if (!res.ok) {
    const detalhe = (await res.text()).slice(0, 500);
    const retentavel = res.status === 429 || res.status >= 500;
    throw new ErroIA(`OpenAI transcrição ${res.status}: ${detalhe}`, res.status, retentavel);
  }

  const j = await res.json();
  const texto = typeof j?.text === 'string' ? j.text.trim() : '';

  return {
    dados: { texto, tem_fala: texto.length > 0 },
    uso: {
      // O endpoint de transcrição nem sempre reporta uso; o custo real é por
      // minuto de áudio, e a duração já está em `zap_mensagens.duracao_segundos`.
      entrada: Number(j?.usage?.input_tokens) || 0,
      saida: Number(j?.usage?.output_tokens) || 0,
    },
  };
}
