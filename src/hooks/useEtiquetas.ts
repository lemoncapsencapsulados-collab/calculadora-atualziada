import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Etiquetas do WhatsApp — as que os consultores atribuem à mão.
 *
 * Vêm do banco da Evolution, não da API dela: nenhuma rota REST devolve quem
 * está em cada etiqueta (404 nas específicas, zero campos de etiqueta em 918
 * chats varridos). Um serviço na VPS lê `Chat.labels` e empurra para cá a cada
 * 30 minutos.
 *
 * Vale como leitura de negócio porque é o funil que o time mantém na mão —
 * LEAD, EM NEGOCIAÇÃO, reunião, PAGO, PERDIDO — e comparar isso com a etapa que
 * a IA infere mostra onde as duas discordam.
 */

export interface Etiqueta {
  instance_name: string;
  label_id: string;
  nome: string;
  cor: string | null;
}

export interface BaseEtiqueta {
  label_id: string;
  etiqueta: string;
  cor: string | null;
  contatos: number;
  com_conversa: number;
  /** Contatos marcados cuja conversa a Evolution nunca sincronizou. Não é falha
   *  nossa — ela lista o chat e não tem o conteúdo. Sem isso à vista, a base
   *  parece maior do que o que dá para analisar. */
  sem_conversa: number;
  atendidos: number;
  sem_atendimento: number;
  com_telefone: number;
  analisados: number;
  etapa_ia_mais_comum: string | null;
  ultima_atividade: string | null;
}

export interface ContatoEtiquetado {
  instance_name: string;
  remote_jid: string;
  nome: string | null;
  telefone: string | null;
  tem_conversa: boolean;
  atendido: boolean;
  total_mensagens: number;
  ultima_mensagem_at: string | null;
  etapa_ia: string | null;
  sentimento: string | null;
}

export interface ItemFila {
  instance_name: string;
  remote_jid: string;
  nome: string | null;
  telefone: string | null;
  primeira_mensagem_at: string;
  ultima_mensagem_at: string;
  total_mensagens: number;
  horas_esperando: number;
  etiquetas: string[];
}

interface ClienteRpc {
  rpc(
    nome: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

async function rpc<T>(nome: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const { data, error } = await (supabase as unknown as ClienteRpc).rpc(nome, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

const CINCO_MIN = 5 * 60 * 1000;

/** Mapa `instancia|jid -> nomes de etiqueta`, para colorir a lista de conversas
 *  sem uma consulta por linha. */
export function useEtiquetasPorConversa(instancia?: string) {
  const etiquetas = useQuery({
    queryKey: ['zap-etiquetas', instancia ?? 'todas'],
    queryFn: async () => {
      let q = supabase.from('zap_etiquetas' as never).select('instance_name, label_id, nome, cor');
      if (instancia && instancia !== 'todos') q = q.eq('instance_name', instancia);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Etiqueta[];
    },
    staleTime: CINCO_MIN,
  });

  const associacoes = useQuery({
    queryKey: ['zap-assoc-etiquetas', instancia ?? 'todas'],
    queryFn: async () => {
      let q = supabase
        .from('zap_contato_etiquetas' as never)
        .select('instance_name, remote_jid, label_id');
      if (instancia && instancia !== 'todos') q = q.eq('instance_name', instancia);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Array<{
        instance_name: string;
        remote_jid: string;
        label_id: string;
      }>;
    },
    staleTime: CINCO_MIN,
  });

  const porConversa = useMemo(() => {
    const nomePorId = new Map(
      (etiquetas.data ?? []).map((e) => [`${e.instance_name}|${e.label_id}`, e])
    );
    const mapa = new Map<string, Etiqueta[]>();
    for (const a of associacoes.data ?? []) {
      const et = nomePorId.get(`${a.instance_name}|${a.label_id}`);
      if (!et) continue;
      const chave = `${a.instance_name}|${a.remote_jid}`;
      const atual = mapa.get(chave) ?? [];
      atual.push(et);
      mapa.set(chave, atual);
    }
    return mapa;
  }, [etiquetas.data, associacoes.data]);

  return {
    etiquetas: etiquetas.data ?? [],
    porConversa,
    carregando: etiquetas.isLoading || associacoes.isLoading,
  };
}

export function useBasePorEtiqueta(instancia?: string) {
  return useQuery({
    queryKey: ['zap-base-etiqueta', instancia ?? 'todas'],
    queryFn: () =>
      rpc<BaseEtiqueta>('zap_base_por_etiqueta', {
        p_instance: instancia && instancia !== 'todos' ? instancia : null,
      }),
    staleTime: CINCO_MIN,
  });
}

export function useContatosPorEtiqueta(labelId: string | null, instancia?: string) {
  return useQuery({
    queryKey: ['zap-contatos-etiqueta', labelId, instancia ?? 'todas'],
    enabled: !!labelId,
    queryFn: () =>
      rpc<ContatoEtiquetado>('zap_contatos_por_etiqueta', {
        p_label_id: labelId,
        p_instance: instancia && instancia !== 'todos' ? instancia : null,
      }),
    staleTime: CINCO_MIN,
  });
}

/** Quem escreveu e nunca foi respondido. */
export function useFilaAtendimento(instancia?: string) {
  return useQuery({
    queryKey: ['zap-fila', instancia ?? 'todas'],
    queryFn: () =>
      rpc<ItemFila>('zap_fila_atendimento', {
        p_inicio: null,
        p_fim: null,
        p_instance: instancia && instancia !== 'todos' ? instancia : null,
      }),
    staleTime: CINCO_MIN,
  });
}

/** Paleta do WhatsApp por índice de cor. Aproximada de propósito: o que importa
 *  é distinguir etiquetas entre si, não reproduzir o tom exato do app. */
const CORES = [
  '#8696a0', '#e542a3', '#ff8c00', '#00a884', '#f15c6d', '#7f66ff',
  '#0088cc', '#febb00', '#3b7ddd', '#25d366', '#a63cff', '#ff5c8a',
  '#00bcd4', '#9c27b0', '#4caf50', '#ff9800', '#795548', '#607d8b',
  '#e91e63', '#3f51b5',
];

export function corDaEtiqueta(cor: string | null | undefined): string {
  const i = Number(cor);
  return Number.isFinite(i) && i >= 0 ? CORES[i % CORES.length] : CORES[0];
}
