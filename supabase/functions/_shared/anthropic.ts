// Cliente da Anthropic para as funções de texto do ZapVendas.
//
// Terceira troca de provedor deste módulo (Lovable → Gemini → OpenAI →
// Anthropic) e a lógica das funções que o consomem nunca mudou: todas importam
// `gerarJson` e recebem `{ dados, uso }`. É o retorno do desenho que separou
// provedor de aplicação logo no começo.
//
// Texto e IMAGEM. A API da Anthropic não aceita áudio como entrada — não existe
// bloco de conteúdo de áudio, apenas texto, imagem e documento. A transcrição
// continua em `openai.ts`, desligada até ser habilitada.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { prepararSchema } from './jsonSchema.ts';

/**
 * `claude-opus-5` é o padrão. Trocar por um modelo menor (Sonnet, Haiku) é
 * decisão de custo/qualidade de quem opera, não do código — por isso é variável
 * de ambiente e não constante escondida.
 */
const MODELO = Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-5';

/**
 * Esforço de raciocínio. `medium` porque analisar conversa é trabalho de
 * extração e classificação em volume, onde o topo da escala custa caro e
 * acrescenta pouco. Suba para `high` se a detecção de objeção sutil decepcionar.
 *
 * Vazio ou 'none' omite o parâmetro: Haiku 4.5 REJEITA `effort` com erro 400,
 * enquanto Opus 5 e Sonnet 5 o aceitam. Sem essa saída, trocar para o modelo
 * mais barato quebraria a análise inteira com um erro que não menciona o
 * motivo real.
 */
const ESFORCO = (Deno.env.get('ANTHROPIC_EFFORT') ?? 'medium').trim().toLowerCase();

/** Teto generoso de propósito: `max_tokens` é limite, não cobrança — só se paga o que é gerado. */
const MAX_TOKENS = 16000;

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

/**
 * Um pedaço da mensagem do usuário: texto ou imagem.
 *
 * `midia` é o mime type real do arquivo (`image/jpeg`, `image/png`,
 * `image/webp`, `image/gif`). Mandar o mime errado faz a API recusar a imagem,
 * então quem monta a parte lê o tipo do arquivo em vez de assumir JPEG.
 */
export type Parte =
  | { text: string }
  | { imagem: { base64: string; midia: string } };

/**
 * Sem imagem, o conteúdo continua sendo uma string única — é o que as funções
 * do ZapVendas sempre mandaram, e trocar por blocos de texto mudaria a entrada
 * delas sem necessidade.
 */
function conteudo(partes: Parte[]): unknown {
  if (!partes.some((p) => 'imagem' in p)) {
    return partes.map((p) => (p as { text: string }).text).join('\n\n');
  }
  return partes.map((p) =>
    'text' in p
      ? { type: 'text', text: p.text }
      : {
          type: 'image',
          source: { type: 'base64', media_type: p.imagem.midia, data: p.imagem.base64 },
        },
  );
}

let clienteCache: Anthropic | null = null;

function cliente(): Anthropic {
  if (clienteCache) return clienteCache;
  const apiKey = (Deno.env.get('ANTHROPIC_API_KEY') || '').trim();
  if (!apiKey) throw new ErroIA('ANTHROPIC_API_KEY não configurada', 500, false);
  // O SDK já repete 408/409/429/5xx sozinho; `maxRetries` aqui é o total de
  // tentativas dele, e o nosso tratamento abaixo cuida do que sobrar.
  clienteCache = new Anthropic({ apiKey, maxRetries: 2 });
  return clienteCache;
}

/**
 * Uma chamada de texto com saída estruturada garantida pelo schema.
 *
 * Toda chamada nossa consome o resultado como dado (sentimento, objeções,
 * parecer), nunca como prosa livre. Deixar a API validar contra o schema
 * elimina a camada de parsing frágil que nasce quando se pede "responda no
 * formato X" dentro do prompt.
 */
export async function gerarJson<T>(opts: {
  system: string;
  partes: Parte[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  /**
   * Sobrepõe ANTHROPIC_EFFORT nesta chamada. Classificar conversa em volume e
   * escrever um parecer não são a mesma tarefa: a primeira quer velocidade, a
   * segunda quer raciocínio. Uma variável de ambiente única obrigava as duas a
   * pagar o custo da mais cara. 'none' omite o parâmetro.
   */
  esforco?: string;
}): Promise<RespostaIA<T>> {
  const anthropic = cliente();
  const esforco = (opts.esforco ?? ESFORCO).trim().toLowerCase();
  const usaEsforco = esforco !== '' && esforco !== 'none';

  let resposta;
  try {
    resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      system: opts.system,
      messages: [{ role: 'user', content: conteudo(opts.partes) }],
      output_config: {
        ...(usaEsforco ? { effort: esforco as 'low' | 'medium' | 'high' } : {}),
        format: {
          type: 'json_schema',
          schema: prepararSchema(opts.schema as Record<string, any>),
        },
      },
    } as any);
  } catch (e) {
    // Classes tipadas do SDK em vez de comparar texto de mensagem: 429 e 5xx
    // passam de novo; 400 e 401 não têm conserto por repetição.
    if (e instanceof Anthropic.APIError) {
      const retentavel = e.status === 429 || (e.status ?? 500) >= 500;
      throw new ErroIA(`Anthropic ${e.status}: ${e.message}`, e.status ?? 0, retentavel);
    }
    throw new ErroIA(`falha de rede: ${(e as Error).message}`, 0, true);
  }

  // Uma recusa por política chega como HTTP 200 com stop_reason 'refusal' —
  // sem checar isso, o `content` viria vazio e o erro apareceria como JSON
  // inválido, escondendo a causa real.
  if ((resposta as any).stop_reason === 'refusal') {
    const categoria = (resposta as any).stop_details?.category ?? 'sem categoria';
    throw new ErroIA(`conteúdo recusado pelo modelo (${categoria})`, 200, false);
  }

  const bloco = (resposta.content || []).find((b: any) => b.type === 'text') as any;
  const texto = bloco?.text;
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new ErroIA(
      `resposta sem texto (stop_reason: ${(resposta as any).stop_reason ?? 'desconhecido'})`,
      200,
      false
    );
  }

  return {
    dados: JSON.parse(texto) as T,
    uso: {
      entrada: Number(resposta.usage?.input_tokens) || 0,
      saida: Number(resposta.usage?.output_tokens) || 0,
    },
  };
}
