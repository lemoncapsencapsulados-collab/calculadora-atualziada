import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ZapInstancia,
  ZapInstanciaEvolution,
  ZapInstanciaCombinada,
  ZapChat,
  ZapMensagem,
  RespostaZap,
  TipoMidiaZap,
} from '@/types/zapvendas';

const TABELA_INSTANCIAS = 'zap_instancias' as any;

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
    throw new Error(error.message || 'Falha ao comunicar com o WhatsApp.');
  }

  const resposta = data as RespostaZap<T> | null;
  if (!resposta || resposta.ok !== true) {
    throw new Error(resposta?.error || 'Erro desconhecido ao processar a solicitação.');
  }

  return resposta.data as T;
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

/**
 * Cruza as instâncias cadastradas em `zap_instancias` (dono/número) com o
 * estado de conexão devolvido pela Evolution (`instances.list`), casando
 * pelo nome da instância. Uma instância pode existir só de um lado — os
 * dois casos são tratados sem quebrar.
 */
export function useZapInstancias() {
  return useQuery({
    queryKey: ['zap-instancias'],
    staleTime: 30_000,
    queryFn: async (): Promise<ZapInstanciaCombinada[]> => {
      const [{ data: linhas, error }, evolucao] = await Promise.all([
        (supabase as any).from(TABELA_INSTANCIAS).select('*'),
        invokeZap<ZapInstanciaEvolution[]>('instances.list').catch((erro) => {
          // A Evolution pode estar indisponível; ainda assim mostramos as
          // instâncias cadastradas, com status desconhecido.
          console.error('[zapvendas] erro ao buscar instances.list', erro);
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
          connectionStatus: evo?.connectionStatus ?? 'desconhecido',
          ownerJid: evo?.ownerJid,
          profileName: evo?.profileName,
          profilePicUrl: evo?.profilePicUrl,
        };
      });

      // Instâncias que existem na Evolution mas ainda não foram cadastradas
      // na tabela do Supabase (ex.: criadas fora do fluxo do app).
      (evolucao || []).forEach((evo) => {
        if (!evo?.name || nomesCadastrados.has(evo.name)) return;
        combinadas.push({
          id: null,
          instanceName: evo.name,
          usuarioId: null,
          numero: evo.number ?? null,
          ativo: true,
          connectionStatus: evo.connectionStatus ?? 'desconhecido',
          ownerJid: evo.ownerJid,
          profileName: evo.profileName,
          profilePicUrl: evo.profilePicUrl,
        });
      });

      return combinadas;
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
      const data = await invokeZap<ZapMensagem[]>('messages.list', {
        instanceName,
        remoteJid,
        limit,
      });
      return data || [];
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
      const numero = jidParaTelefone(remoteJid);
      return invokeZap('messages.send', { instanceName, number: numero, text: texto });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['zap-mensagens', variables.instanceName, variables.remoteJid] });
      queryClient.invalidateQueries({ queryKey: ['zap-chats', variables.instanceName] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/** Cria uma instância nova na Evolution (`instances.create`) e a cadastra em `zap_instancias`. */
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
      const data = await invokeZap('instances.create', { instanceName });

      const { error } = await (supabase as any).from(TABELA_INSTANCIAS).insert([
        {
          instance_name: instanceName,
          usuario_id: usuarioId ?? null,
          numero: numero ?? null,
        },
      ]);
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      toast({
        title: 'Instância criada',
        description: 'Escaneie o QR Code para conectar o WhatsApp.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar instância',
        description: error.message,
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
