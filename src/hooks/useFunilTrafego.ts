import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dados da página de Funis de Tráfego Pago.
 *
 * Uma query por RPC, agregação toda no banco — mesmo formato de
 * `useZapInteligencia`. O navegador não recalcula funil: baixar linha crua e
 * refazer a conta na tela é como a página de anúncios atual acabou com números
 * que ninguém consegue auditar.
 */

export type NivelHierarquia = 'campanha' | 'conjunto' | 'anuncio';
export type Recorte = 'plataforma_posicionamento' | 'idade_genero';

export interface FiltrosTrafego {
  inicio: string; // yyyy-mm-dd
  fim: string;
  conta: string | null;
}

export interface PeriodoTrafego {
  periodo: 'atual' | 'anterior';
  inicio: string;
  fim: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  cliques_link: number;
  leads: number;
  /** Lead de formulário na landing (Pixel). Funil diferente do de conversa. */
  leads_formulario: number;
  /** Conversa de WhatsApp iniciada direto do anúncio (Click-to-WhatsApp). */
  conversas: number;
  visitas_landing: number;
  video_views: number;
  engajamento: number;
  anuncios: number;
  campanhas: number;
  ctr: number | null;
  ctr_link: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  custo_por_conversa: number | null;
  custo_por_visita: number | null;
  taxa_chegada_landing: number | null;
}

export interface PontoSerie {
  data: string;
  investimento: number;
  impressoes: number;
  cliques_link: number;
  leads: number;
  leads_formulario: number;
  conversas: number;
  cpl: number | null;
  ctr_link: number | null;
}

export interface EventoMeta {
  evento: string;
  total: number;
  anuncios: number;
  custo_por_evento: number | null;
}

export interface LinhaHierarquia {
  id: string;
  nome: string;
  pai_id: string | null;
  investimento: number;
  impressoes: number;
  cliques: number;
  cliques_link: number;
  leads: number;
  leads_formulario: number;
  conversas: number;
  visitas_landing: number;
  ctr: number | null;
  ctr_link: number | null;
  cpl: number | null;
  cpc: number | null;
  cpm: number | null;
  custo_por_conversa: number | null;
  /** Média das frequências diárias, NÃO a frequência do período: esta exigiria
   *  o alcance real, que não se obtém somando dias. */
  frequencia_media: number | null;
}

export interface LinhaCriativo {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  titulo: string | null;
  corpo: string | null;
  cta: string | null;
  url_destino: string | null;
  image_url: string | null;
  vigente_desde: string;
  vigente_ate: string | null;
  no_ar: boolean;
  dias_no_periodo: number;
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  ctr: number | null;
  cpl: number | null;
}

export interface LinhaRecorte {
  chave_1: string;
  chave_2: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number | null;
  participacao: number | null;
}

export interface StatusColeta {
  ad_account_id: string;
  ultima_coleta: string | null;
  dia_mais_recente: string | null;
  jobs_pendentes: number;
  jobs_em_erro: number;
}

const CINCO_MIN = 5 * 60 * 1000;

/**
 * As RPCs novas ainda não estão nos tipos gerados do Supabase, então a chamada
 * precisa escapar da tipagem. Escapa por uma interface mínima em vez de `any`:
 * o retorno continua tipado em `T` no ponto de uso, e o buraco fica limitado a
 * esta função em vez de vazar para cada chamada.
 */
interface ClienteRpc {
  rpc(
    nome: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await (supabase as unknown as ClienteRpc).rpc(nome, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useFunilTrafego(filtros: FiltrosTrafego) {
  const argsPeriodo = {
    p_inicio: filtros.inicio,
    p_fim: filtros.fim,
    p_conta: filtros.conta,
  };
  const chave = [filtros.inicio, filtros.fim, filtros.conta];

  const visaoGeral = useQuery({
    queryKey: ['trafego-visao-geral', ...chave],
    queryFn: () => rpc<PeriodoTrafego>('trafego_visao_geral', argsPeriodo),
    staleTime: CINCO_MIN,
  });

  const status = useQuery({
    queryKey: ['trafego-status', filtros.conta],
    queryFn: () => rpc<StatusColeta>('trafego_status', { p_conta: filtros.conta }),
    staleTime: CINCO_MIN,
  });

  const criativos = useQuery({
    queryKey: ['trafego-criativos', ...chave],
    queryFn: () => rpc<LinhaCriativo>('trafego_criativos', argsPeriodo),
    staleTime: CINCO_MIN,
  });

  const serie = useQuery({
    queryKey: ['trafego-serie', ...chave],
    queryFn: () => rpc<PontoSerie>('trafego_serie_diaria', argsPeriodo),
    staleTime: CINCO_MIN,
  });

  const eventos = useQuery({
    queryKey: ['trafego-eventos', ...chave],
    queryFn: () => rpc<EventoMeta>('trafego_eventos', argsPeriodo),
    staleTime: CINCO_MIN,
  });

  const atual = visaoGeral.data?.find((p) => p.periodo === 'atual') ?? null;
  const anterior = visaoGeral.data?.find((p) => p.periodo === 'anterior') ?? null;

  return {
    atual,
    anterior,
    criativos: criativos.data ?? [],
    serie: serie.data ?? [],
    eventos: eventos.data ?? [],
    status: status.data?.[0] ?? null,
    carregando: visaoGeral.isLoading || criativos.isLoading,
    erro: (visaoGeral.error || criativos.error || status.error) as Error | null,
  };
}

/** Separado do hook principal porque a hierarquia é navegável: cada descida de
 *  nível é uma consulta nova, e recarregar a página inteira a cada clique seria
 *  desperdício. */
export function useHierarquiaTrafego(
  filtros: FiltrosTrafego,
  nivel: NivelHierarquia,
  paiId: string | null
) {
  return useQuery({
    queryKey: ['trafego-hierarquia', filtros.inicio, filtros.fim, filtros.conta, nivel, paiId],
    queryFn: () =>
      rpc<LinhaHierarquia>('trafego_hierarquia', {
        p_inicio: filtros.inicio,
        p_fim: filtros.fim,
        p_conta: filtros.conta,
        p_nivel: nivel,
        p_pai: paiId,
      }),
    staleTime: CINCO_MIN,
  });
}

export function useRecorteTrafego(filtros: FiltrosTrafego, recorte: Recorte) {
  return useQuery({
    queryKey: ['trafego-recorte', filtros.inicio, filtros.fim, filtros.conta, recorte],
    queryFn: () =>
      rpc<LinhaRecorte>('trafego_recorte', {
        p_inicio: filtros.inicio,
        p_fim: filtros.fim,
        p_recorte: recorte,
        p_conta: filtros.conta,
      }),
    staleTime: CINCO_MIN,
  });
}
