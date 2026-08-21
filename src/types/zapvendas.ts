// Tipos do módulo ZapVendas (caixa de entrada unificada de WhatsApp).
// Alinhados ao contrato da edge function `zapvendas` e à migration
// `20260821120000_zapvendas.sql`.

/** Linha da tabela `public.zap_instancias` (Supabase). */
export interface ZapInstancia {
  id: string;
  instance_name: string;
  usuario_id: string | null;
  numero: string | null;
  ativo: boolean;
}

/** Instância como devolvida pela Evolution API (`instances.list`). */
export interface ZapInstanciaEvolution {
  name: string;
  connectionStatus: 'open' | 'close' | 'connecting';
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  number?: string;
}

/**
 * Instância combinada: cruza `zap_instancias` (dono/número cadastrado) com
 * o estado de conexão vindo da Evolution. `id` é `null` quando a instância
 * existe na Evolution mas ainda não foi cadastrada na tabela do Supabase —
 * nesse caso `vinculada` é `false` e a edge function recusa (403) qualquer
 * action nela além de `instances.list`, então a UI não deve tratá-la como
 * utilizável (nada de `chats.list`/`instances.qrcode` para ela).
 */
export interface ZapInstanciaCombinada {
  id: string | null;
  instanceName: string;
  usuarioId: string | null;
  numero: string | null;
  /**
   * Espelha `zap_instancias.ativo`: "aparece na lista do ZapVendas e é
   * operável". A edge function exige `ativo: true` (além do vínculo) para
   * qualquer action que não seja `instances.list`. `false` para uma
   * instância nunca vinculada (nunca teve linha) OU para uma vinculada que o
   * operador ocultou de propósito — ver `useDefinirVisibilidadeInstancia`.
   */
  ativo: boolean;
  /** `true` quando existe linha em `zap_instancias` — só então a instância é utilizável pelo ZapVendas. */
  vinculada: boolean;
  connectionStatus: 'open' | 'close' | 'connecting' | 'desconhecido';
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
}

/** Conversa (chat) devolvida por `chats.list`. */
export interface ZapChat {
  id: string;
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  updatedAt?: string;
  lastMessage?: {
    key?: { fromMe?: boolean };
    message?: unknown;
    messageTimestamp?: number;
  };
}

/** Mensagem devolvida por `messages.list`. */
export interface ZapMensagem {
  id: string;
  key: { id: string; fromMe: boolean; remoteJid: string };
  message?: Record<string, unknown>;
  messageTimestamp: number;
  pushName?: string;
  messageType?: string;
}

/** Formato de envelope de resposta da edge function `zapvendas`. */
export interface RespostaZap<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Tipos de mídia identificáveis numa `ZapMensagem`. */
export type TipoMidiaZap = 'imagem' | 'audio' | 'video' | 'documento' | 'texto';

/** Conteúdo de mídia baixado sob demanda (`messages.media`). */
export interface ZapMidia {
  base64: string;
  mimetype: string;
}
