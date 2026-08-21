import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ZapInstancia,
  ZapInstanciaEvolution,
  ZapInstanciaCombinada,
  ZapChat,
  ZapMensagem,
  ZapMidia,
  RespostaZap,
  TipoMidiaZap,
} from '@/types/zapvendas';

const TABELA_INSTANCIAS = 'zap_instancias' as any;

const TAMANHO_MAX_MENSAGEM_ERRO = 500;

/**
 * Converte QUALQUER valor de erro numa mensagem sempre legível — nunca pode
 * devolver "[object Object]". O supabase-js e a Evolution às vezes trazem a
 * "mensagem" como objeto/array aninhado em vez de string (ex.: erros de
 * validação do PostgREST, `response.message` da Evolution); se um caminho
 * fizer `new Error(valorNãoString)` ou `String(objeto)` sem passar por aqui,
 * o toast mostra o objeto cru. Regras, em ordem:
 *  - string → ela mesma (ou a frase padrão, se vazia);
 *  - `Error` → `.message`, se for string não vazia;
 *  - array → mensagens de cada item, juntadas com ", ";
 *  - objeto → tenta `.message`/`.error` (string ou, recursivamente, objeto
 *    aninhado); sem nenhum dos dois, cai em `JSON.stringify` truncado;
 *  - `null`/`undefined` → frase padrão.
 */
export function mensagemDeErro(valor: unknown, profundidade = 0): string {
  const PADRAO = 'Ocorreu um erro inesperado.';

  if (typeof valor === 'string') return valor.trim() || PADRAO;
  if (valor == null) return PADRAO;

  if (valor instanceof Error) {
    return typeof valor.message === 'string' && valor.message.trim() ? valor.message : PADRAO;
  }

  if (Array.isArray(valor)) {
    const partes = valor
      .map((item) => (typeof item === 'string' ? item.trim() : mensagemDeErro(item, profundidade + 1)))
      .filter(Boolean);
    return partes.length ? partes.join(', ') : PADRAO;
  }

  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;

    // Alguns erros aninham a mensagem de verdade num sub-objeto (ex.: a
    // Evolution aninha em `response.message`). Limita a profundidade para
    // nunca entrar em loop com uma estrutura circular incomum.
    if (profundidade < 3) {
      if (obj.message && typeof obj.message === 'object') return mensagemDeErro(obj.message, profundidade + 1);
      if (obj.error && typeof obj.error === 'object') return mensagemDeErro(obj.error, profundidade + 1);
    }

    try {
      const serializado = JSON.stringify(obj);
      if (serializado && serializado !== '{}') {
        return serializado.length > TAMANHO_MAX_MENSAGEM_ERRO
          ? `${serializado.slice(0, TAMANHO_MAX_MENSAGEM_ERRO)}…`
          : serializado;
      }
    } catch {
      // Estrutura não serializável (ex.: referência circular) — cai no fallback abaixo.
    }
    return PADRAO;
  }

  // number, boolean, etc. — casos residuais, nunca vistos na prática.
  return String(valor);
}

/**
 * O `functions.invoke` do supabase-js só lança em resposta não-2xx com a
 * string fixa "Edge Function returned a non-2xx status code" — ele não lê o
 * corpo da resposta. Todo erro da nossa edge function usa status ≠ 200 e
 * carrega a mensagem em `{ ok:false, error }` no corpo; para ela chegar ao
 * usuário, lemos esse corpo aqui a partir de `error.context` (a `Response`
 * crua, que o supabase-js anexa ao erro mas nunca consome).
 */
async function extrairMensagemErroInvoke(error: unknown): Promise<string> {
  const contexto = (error as { context?: Response } | undefined)?.context;
  if (contexto && typeof contexto.clone === 'function') {
    try {
      const corpo = await contexto.clone().json();
      if (corpo && typeof corpo === 'object' && typeof (corpo as any).error === 'string' && (corpo as any).error.trim()) {
        return (corpo as any).error;
      }
    } catch {
      // Corpo não era JSON (ex.: página de erro de um proxy) — cai no fallback abaixo.
    }
  }
  const mensagemBruta = (error as { message?: unknown } | undefined)?.message;
  return mensagemBruta != null ? mensagemDeErro(mensagemBruta) : 'Falha ao comunicar com o WhatsApp.';
}

// ---------------------------------------------------------------------------
// invokeZap — helper central de comunicação com a edge function `zapvendas`.
// Trata os dois níveis de erro possíveis: o erro de transporte do próprio
// `functions.invoke` (rede, HTTP, etc.) e o `{ ok:false, error }` que a
// função devolve no corpo quando a operação falha. Ambos viram um `Error`
// com mensagem legível — nunca um objeto cru.
// ---------------------------------------------------------------------------
export async function invokeZap<T = unknown>(
  action: string,
  params?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('zapvendas', {
    body: { action, ...params },
  });

  if (error) {
    throw new Error(await extrairMensagemErroInvoke(error));
  }

  // Sem `error`, a edge function sempre respondeu HTTP 200 com `{ ok: true, data }`
  // (todo caminho de falha dela usa status ≠ 200, tratado no `if` acima).
  return (data as RespostaZap<T> | null)?.data as T;
}

// ---------------------------------------------------------------------------
// Helpers de mensagem — a Evolution devolve formatos variados e campos
// ausentes; todos são defensivos e nunca lançam exceção.
// ---------------------------------------------------------------------------

/** Extrai o texto legível de uma mensagem, cobrindo os formatos mais comuns. */
export function extrairTexto(m: ZapMensagem | undefined | null): string {
  try {
    const msg = m?.message;
    if (!msg || typeof msg !== 'object') return '';

    const conversation = (msg as any).conversation;
    if (typeof conversation === 'string') return conversation;

    const extendedTexto = (msg as any).extendedTextMessage?.text;
    if (typeof extendedTexto === 'string') return extendedTexto;

    const legendaImagem = (msg as any).imageMessage?.caption;
    if (typeof legendaImagem === 'string') return legendaImagem;

    const legendaVideo = (msg as any).videoMessage?.caption;
    if (typeof legendaVideo === 'string') return legendaVideo;

    return '';
  } catch {
    return '';
  }
}

/** Identifica o tipo de mídia da mensagem, para exibir um rótulo quando não houver texto. */
export function tipoMidia(m: ZapMensagem | undefined | null): TipoMidiaZap {
  try {
    const msg = m?.message;
    if (!msg || typeof msg !== 'object') return 'texto';

    if ((msg as any).imageMessage) return 'imagem';
    if ((msg as any).audioMessage) return 'audio';
    if ((msg as any).videoMessage) return 'video';
    if ((msg as any).documentMessage) return 'documento';

    return 'texto';
  } catch {
    return 'texto';
  }
}

/**
 * Miniatura embutida na própria mensagem de imagem (`jpegThumbnail`), já como
 * data URL — usada como prévia sem custo de rede, antes de baixar a mídia
 * cheia sob demanda.
 */
export function extrairThumbnailImagem(m: ZapMensagem | undefined | null): string | null {
  try {
    const thumb = (m?.message as any)?.imageMessage?.jpegThumbnail;
    if (typeof thumb !== 'string' || !thumb) return null;
    return thumb.startsWith('data:') ? thumb : `data:image/jpeg;base64,${thumb}`;
  } catch {
    return null;
  }
}

/** Nome do arquivo de uma mensagem de documento, quando a Evolution o informa. */
export function extrairNomeArquivo(m: ZapMensagem | undefined | null): string | null {
  try {
    const nome = (m?.message as any)?.documentMessage?.fileName;
    return typeof nome === 'string' && nome ? nome : null;
  } catch {
    return null;
  }
}

/**
 * Normaliza um telefone para casar com `clientes.telefone`: só dígitos,
 * removendo o `55` inicial apenas quando o restante tiver 10 ou 11 dígitos
 * (senão números legítimos que começam com 55 seriam corrompidos).
 */
export function normalizarTelefone(v: string | undefined | null): string {
  const digitos = (v || '').replace(/\D/g, '');
  if (digitos.startsWith('55')) {
    const resto = digitos.slice(2);
    if (resto.length === 10 || resto.length === 11) {
      return resto;
    }
  }
  return digitos;
}

/** Extrai o telefone (ou id) da parte antes do `@` de um `remoteJid`. */
export function jidParaTelefone(jid: string | undefined | null): string {
  if (!jid) return '';
  return jid.split('@')[0] || '';
}

/** Indica se um `remoteJid` é de um grupo (`@g.us`). */
export function ehGrupo(remoteJid: string | undefined | null): boolean {
  return !!remoteJid && remoteJid.endsWith('@g.us');
}

// ---------------------------------------------------------------------------
// Hooks de dados
// ---------------------------------------------------------------------------

/** Resultado de `useZapInstancias`: instâncias combinadas + sinal de que a Evolution não respondeu. */
export interface ResultadoZapInstancias {
  instancias: ZapInstanciaCombinada[];
  /** `true` quando `instances.list` falhou (Evolution fora do ar, rede, etc.) — as instâncias cadastradas ainda aparecem, com status desconhecido. */
  evolutionIndisponivel: boolean;
}

/**
 * Cruza as instâncias cadastradas em `zap_instancias` (dono/número) com o
 * estado de conexão devolvido pela Evolution (`instances.list`), casando
 * pelo nome da instância. Uma instância pode existir só de um lado — os
 * dois casos são tratados sem quebrar.
 *
 * Uma instância que existe na Evolution mas ainda não tem linha em
 * `zap_instancias` (`vinculada: false`) NÃO é utilizável: a edge function
 * recusa (403) qualquer action nela além de `instances.list` — ela é
 * compartilhada com outros sistemas na mesma VPS, então não dá pra tratar
 * "existe na Evolution" como "pertence ao ZapVendas". Por isso ela entra na
 * lista com `ativo: false`, só para permitir que o operador a vincule.
 *
 * `ativo` (a coluna de `zap_instancias`) significa "aparece na lista do
 * ZapVendas" — a edge function também passou a exigi-la (além do vínculo) em
 * toda action que não seja `instances.list`. Uma instância vinculada pode
 * ficar com `ativo: false` (oculta) quando o operador decide escondê-la —
 * ex.: uma instância de outro produto da mesma Evolution que apareceu na
 * lista só para poder ser identificada, mas nunca deveria virar uma conversa
 * do ZapVendas, e que a edge function proíbe apagar de verdade por não ser
 * dono dela. Ocultar é reversível (ver `useDefinirVisibilidadeInstancia`).
 */
export function useZapInstancias() {
  return useQuery({
    queryKey: ['zap-instancias'],
    staleTime: 30_000,
    queryFn: async (): Promise<ResultadoZapInstancias> => {
      let evolutionIndisponivel = false;

      const [{ data: linhas, error }, evolucao] = await Promise.all([
        (supabase as any).from(TABELA_INSTANCIAS).select('*'),
        invokeZap<ZapInstanciaEvolution[]>('instances.list').catch((erro) => {
          // A Evolution pode estar indisponível; ainda assim mostramos as
          // instâncias cadastradas, com status desconhecido.
          console.error('[zapvendas] erro ao buscar instances.list', erro);
          evolutionIndisponivel = true;
          return [] as ZapInstanciaEvolution[];
        }),
      ]);

      if (error) throw error;

      const porNome = new Map<string, ZapInstanciaEvolution>();
      (evolucao || []).forEach((evo) => {
        if (evo?.name) porNome.set(evo.name, evo);
      });

      const nomesCadastrados = new Set<string>();

      const combinadas: ZapInstanciaCombinada[] = ((linhas || []) as ZapInstancia[]).map((linha) => {
        nomesCadastrados.add(linha.instance_name);
        const evo = porNome.get(linha.instance_name);
        return {
          id: linha.id,
          instanceName: linha.instance_name,
          usuarioId: linha.usuario_id,
          numero: linha.numero,
          ativo: linha.ativo,
          vinculada: true,
          connectionStatus: evo?.connectionStatus ?? 'desconhecido',
          ownerJid: evo?.ownerJid,
          profileName: evo?.profileName,
          profilePicUrl: evo?.profilePicUrl,
        };
      });

      // Instâncias que existem na Evolution mas ainda não foram cadastradas
      // na tabela do Supabase (ex.: criadas fora do fluxo do app, ou de outro
      // produto que compartilha a mesma Evolution). Aparecem na lista para que
      // o operador possa identificá-las e vinculá-las, mas `ativo: false` as
      // mantém fora da caixa de entrada — nenhuma action de conversa funciona
      // nelas até existir a linha em `zap_instancias`.
      (evolucao || []).forEach((evo) => {
        if (!evo?.name || nomesCadastrados.has(evo.name)) return;
        combinadas.push({
          id: null,
          instanceName: evo.name,
          usuarioId: null,
          numero: evo.number ?? null,
          ativo: false,
          vinculada: false,
          connectionStatus: evo.connectionStatus ?? 'desconhecido',
          ownerJid: evo.ownerJid,
          profileName: evo.profileName,
          profilePicUrl: evo.profilePicUrl,
        });
      });

      return { instancias: combinadas, evolutionIndisponivel };
    },
  });
}

/** Conversas de uma instância (`chats.list`). */
export function useZapChats(instanceName: string | undefined | null) {
  return useQuery({
    queryKey: ['zap-chats', instanceName],
    enabled: !!instanceName,
    staleTime: 15_000,
    queryFn: async (): Promise<ZapChat[]> => {
      const data = await invokeZap<ZapChat[]>('chats.list', { instanceName });
      return data || [];
    },
  });
}

/** Mensagens de uma conversa (`messages.list`). Só busca com os dois parâmetros presentes. */
export function useZapMensagens(
  instanceName: string | undefined | null,
  remoteJid: string | undefined | null,
  limit = 50
) {
  return useQuery({
    queryKey: ['zap-mensagens', instanceName, remoteJid, limit],
    enabled: !!instanceName && !!remoteJid,
    staleTime: 10_000,
    queryFn: async (): Promise<ZapMensagem[]> => {
      // A Evolution devolve as mensagens embrulhadas em paginação:
      // { messages: { records: [...], total, pages, currentPage } }.
      // Algumas versões podem devolver o array diretamente — aceitamos os
      // dois formatos sem quebrar a tela.
      const bruto = await invokeZap<
        | ZapMensagem[]
        | { messages?: { records?: ZapMensagem[]; total?: number; pages?: number; currentPage?: number } }
      >('messages.list', {
        instanceName,
        remoteJid,
        limit,
      });

      const mensagens: ZapMensagem[] = Array.isArray(bruto)
        ? bruto
        : bruto?.messages?.records ?? [];

      // A Evolution devolve em ordem decrescente (mais recente primeiro);
      // a tela de conversa espera ordem crescente.
      return [...mensagens].sort((a, b) => (a?.messageTimestamp ?? 0) - (b?.messageTimestamp ?? 0));
    },
  });
}

/** Envia uma mensagem de texto (`messages.send`) e invalida conversa/mensagens relacionadas. */
export function useEnviarMensagem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceName,
      remoteJid,
      texto,
    }: {
      instanceName: string;
      remoteJid: string;
      texto: string;
    }) => {
      // Manda o JID completo (com `@s.whatsapp.net`, `@g.us` ou `@lid`) em vez
      // de só a parte numérica: a Evolution aceita o JID inteiro em `number`,
      // e cortar o domínio faz ela reconstruir o destino por heurística — o
      // que envia para o lugar errado em grupos e em JIDs `@lid`.
      return invokeZap('messages.send', { instanceName, number: remoteJid, text: texto });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['zap-mensagens', variables.instanceName, variables.remoteJid] });
      queryClient.invalidateQueries({ queryKey: ['zap-chats', variables.instanceName] });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: mensagemDeErro(error),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Cria uma instância nova na Evolution (`instances.create`). O cadastro em
 * `zap_instancias` acontece dentro da própria edge function, com o
 * service_role, como parte atômica da criação — se o cadastro falhar, ela
 * desfaz a criação na Evolution. Isso evita instância órfã na Evolution (sem
 * linha em `zap_instancias`) e é o que já deixa a instância nova utilizável
 * pelas demais actions, que agora exigem esse vínculo.
 */
export function useCriarInstancia() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceName,
      usuarioId,
      numero,
    }: {
      instanceName: string;
      usuarioId?: string | null;
      numero?: string | null;
    }) => {
      return invokeZap('instances.create', {
        instanceName,
        usuarioId: usuarioId ?? null,
        numero: numero ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      toast({
        title: 'Instância criada',
        description: 'Escaneie o QR Code para conectar o WhatsApp.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao criar instância',
        description: mensagemDeErro(error),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Vincula (ou desvincula) o vendedor dono de uma instância já existente.
 * Faz UPSERT em `zap_instancias` pela chave única `instance_name` — cobre
 * tanto a instância que ainda não tem linha na tabela (criada fora do fluxo
 * do app) quanto a troca de vendedor de uma instância já cadastrada.
 */
export function useVincularVendedor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceName,
      usuarioId,
      numero,
    }: {
      instanceName: string;
      usuarioId: string | null;
      numero?: string | null;
    }) => {
      const { error } = await (supabase as any)
        .from(TABELA_INSTANCIAS)
        .upsert(
          [
            {
              instance_name: instanceName,
              usuario_id: usuarioId,
              // Vincular um vendedor é uma ação explícita de "eu quero usar
              // esta instância no ZapVendas" — se ela estava oculta
              // (`ativo: false`, ver `useDefinirVisibilidadeInstancia`),
              // volta a aparecer na lista.
              ativo: true,
              ...(numero ? { numero } : {}),
            },
          ],
          { onConflict: 'instance_name' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      toast({
        title: 'Vendedor atualizado',
        description: 'A instância foi vinculada com sucesso.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao vincular vendedor',
        description: mensagemDeErro(error),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Ativa/desativa a visibilidade de uma instância na lista do ZapVendas
 * (`zap_instancias.ativo`). NÃO mexe em nada na Evolution — é só um upsert
 * em `zap_instancias`. Serve para dois casos:
 *  - "Ocultar da lista", numa instância NÃO vinculada (ex.: uma instância de
 *    outro produto que compartilha a mesma Evolution): como a edge function
 *    recusa (403) `instances.logout`/`instances.delete` nela — corretamente,
 *    para não permitir apagar algo que não é do ZapVendas — ocultar é a
 *    única forma de tirá-la da lista sem mexer na Evolution.
 *  - "Reexibir", trazendo de volta uma instância que havia sido ocultada.
 *
 * Faz upsert por `onConflict: 'instance_name'` porque a instância pode ainda
 * não ter linha em `zap_instancias` (o caso "não vinculada" acima); ocultá-la
 * cria a linha (com `usuario_id: null`) só com o propósito de marcá-la como
 * oculta.
 */
export function useDefinirVisibilidadeInstancia() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instanceName, ativo }: { instanceName: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from(TABELA_INSTANCIAS)
        .upsert([{ instance_name: instanceName, ativo }], { onConflict: 'instance_name' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      toast({
        title: variables.ativo ? 'Instância reexibida' : 'Instância ocultada',
        description: variables.ativo
          ? 'A instância voltou a aparecer na lista do ZapVendas.'
          : 'A instância saiu da lista do ZapVendas. Nada foi alterado na Evolution.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao alterar visibilidade da instância',
        description: mensagemDeErro(error),
        variant: 'destructive',
      });
    },
  });
}

/** QR Code para conectar uma instância (`instances.qrcode`). */
export function useQrCode(instanceName: string | undefined | null) {
  return useQuery({
    queryKey: ['zap-qrcode', instanceName],
    enabled: !!instanceName,
    staleTime: 0,
    queryFn: async (): Promise<unknown> => {
      return invokeZap('instances.qrcode', { instanceName });
    },
  });
}

/**
 * Desconecta o WhatsApp de uma instância (`instances.logout`) — a instância
 * continua cadastrada e listada, só marcada como desconectada: o histórico é
 * preservado e o vendedor pode reconectar lendo o QR code de novo. Para
 * remover a instância de vez (some da lista, apaga histórico na Evolution),
 * use `useRemoverInstancia`.
 *
 * A edge function já reconhece como sucesso os casos em que a Evolution
 * responde com erro só porque a instância já não tinha sessão ativa (ver
 * comentário em `instances.logout` na edge function) — nesse caso ela volta
 * com `{ jaEstavaDesconectada: true }` e mostramos um toast informativo em
 * vez de um erro.
 */
export function useDesconectarInstancia() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instanceName }: { instanceName: string }) => {
      return invokeZap<{ jaEstavaDesconectada?: boolean }>('instances.logout', { instanceName });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      queryClient.invalidateQueries({ queryKey: ['zap-instancia-estado', variables.instanceName] });
      if (data?.jaEstavaDesconectada) {
        toast({
          title: 'Instância já estava desconectada',
          description: 'Não havia sessão ativa para encerrar.',
        });
      } else {
        toast({
          title: 'WhatsApp desconectado',
          description: 'O vendedor precisará escanear o QR code de novo para reconectar.',
        });
      }
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao desconectar',
        description: mensagemDeErro(error),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Remove uma instância definitivamente: encerra a sessão (`instances.logout`,
 * tolerando o caso de já estar desconectada), apaga a instância na Evolution
 * (`instances.delete`) e só então some da lista. É IRREVERSÍVEL — apaga
 * também o histórico de conversas daquele número na Evolution. Se
 * `instances.delete` falhar, a edge function não remove o cadastro em
 * `zap_instancias` (ver comentário na action, na edge function), então o
 * estado nunca fica meia-boca: ou a instância continua cadastrada e visível,
 * ou some por completo.
 */
export function useRemoverInstancia() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instanceName }: { instanceName: string }) => {
      await invokeZap('instances.logout', { instanceName });
      await invokeZap('instances.delete', { instanceName });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      queryClient.invalidateQueries({ queryKey: ['zap-instancia-estado', variables.instanceName] });
      toast({
        title: 'Instância removida',
        description: 'O número foi apagado do ZapVendas e da Evolution, junto com o histórico de conversas.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao remover instância',
        description: mensagemDeErro(error),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Mídia — busca sob demanda (`messages.media`).
// ---------------------------------------------------------------------------

/** Resultado de uma busca de mídia: ou o conteúdo, ou o sinal de que expirou no WhatsApp. */
export type ResultadoMidia = { expirada: true } | ({ expirada: false } & ZapMidia);

interface ParametrosMidia {
  instanceName: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
}

/**
 * Chama `messages.media` sem passar pelo `invokeZap` genérico: essa action
 * tem um terceiro desfecho possível além de sucesso/erro — "mídia expirada"
 * (`expirada: true`, devolvido com HTTP 200 mesmo sendo `ok:false`, ver
 * comentário na edge function) — que precisa chegar ao chamador sem virar
 * exceção, para a UI mostrar um aviso discreto em vez de um erro.
 */
async function invokeZapMidia(params: ParametrosMidia): Promise<ResultadoMidia> {
  const { data, error } = await supabase.functions.invoke('zapvendas', {
    body: { action: 'messages.media', ...params },
  });

  if (error) {
    throw new Error(await extrairMensagemErroInvoke(error));
  }

  const corpo = data as (RespostaZap<ZapMidia> & { expirada?: boolean }) | null;
  if (corpo?.expirada) return { expirada: true };
  if (!corpo?.ok || !corpo.data?.base64 || !corpo.data?.mimetype) {
    throw new Error(corpo?.error ? mensagemDeErro(corpo.error) : 'Não foi possível carregar a mídia.');
  }
  return { expirada: false, base64: corpo.data.base64, mimetype: corpo.data.mimetype };
}

/**
 * Busca a mídia de UMA mensagem sob demanda — nunca automaticamente: uma
 * conversa pode ter centenas de mídias, então carregar tudo de uma vez seria
 * pesado demais. `enabled: false` deixa cada item da conversa decidir quando
 * baixar (chamando `buscar()`); a chave da query inclui `messageId`, então o
 * cache do React Query evita rebaixar a mesma mídia duas vezes.
 */
export function useMidia(params: ParametrosMidia | null) {
  const query = useQuery({
    queryKey: ['zap-midia', params?.instanceName, params?.messageId],
    enabled: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async (): Promise<ResultadoMidia> => {
      if (!params) throw new Error('Parâmetros de mídia ausentes.');
      return invokeZapMidia(params);
    },
  });

  return {
    midia: query.data && query.data.expirada === false ? query.data : null,
    expirada: query.data?.expirada === true,
    carregando: query.isFetching,
    erro: query.isError ? mensagemDeErro(query.error) : null,
    buscar: () => query.refetch(),
  };
}
