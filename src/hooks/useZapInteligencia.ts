import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dados do painel de inteligência do ZapVendas — visão individual do consultor.
 *
 * Tudo que é número vem de SQL. Isso não é só performance: o cálculo de turnos
 * que sustenta TMR1 e tempo de resposta precisa varrer a conversa inteira em
 * ordem, e refazer isso no navegador significaria baixar todas as mensagens de
 * todos os consultores para contar segundos.
 *
 * As consultas por consultor só disparam quando há um selecionado (`enabled`),
 * para a tela não gastar requisição enquanto a lista ainda está carregando.
 */

export interface MetricasConsultor {
  usuario_id: string;
  consultor: string;
  contatos: number;
  contatos_cliente_iniciou: number;
  contatos_consultor_iniciou: number;
  contatos_com_msg_consultor: number;
  contatos_com_resposta_cliente: number;
  tmr1_mediana_seg: number | null;
  tmr1_p90_seg: number | null;
  tmr1_p99_seg: number | null;
  tmr1_media_seg: number | null;
  resposta_continua_mediana_seg: number | null;
  resposta_continua_p90_seg: number | null;
  resposta_continua_p99_seg: number | null;
  resposta_cliente_mediana_seg: number | null;
  resposta_cliente_p90_seg: number | null;
  vacuo_inicial_pct: number | null;
  audios_enviados: number;
  videos_enviados: number;
  imagens_enviadas: number;
  documentos_enviados: number;
  contatos_com_link: number;
  contatos_com_reuniao: number;
  conversas_analisadas: number;
  sentimento_positivo: number;
  sentimento_neutro: number;
  sentimento_negativo: number;
  contatos_internos_excluidos: number;
}

export interface FaixaResposta {
  faixa: string;
  ordem: number;
  respostas: number;
  pct: number;
}

export interface CelulaHeatmap {
  dia_semana: number;
  hora: number;
  mensagens: number;
}

export interface ObjecaoRanking {
  categoria: string;
  total: number;
  superadas: number;
  conversas: number;
}

export interface PontoSerie {
  dia: string;
  contatos: number;
  /** Contato cuja PRIMEIRA mensagem de todas caiu neste dia. */
  contatos_novos: number;
  /** Já existia antes deste dia, mesmo que fora da janela consultada. */
  contatos_recorrentes: number;
  mensagens: number;
  tmr1_novos_seg: number | null;
  tmr1_recorrentes_seg: number | null;
}

export interface AcaoPlano {
  acao: string;
  metrica: string;
  valor_atual: string;
  meta: string;
  prazo: string;
}

export interface EvidenciaConversa {
  /** Como o contato foi identificado. Boa parte da base não tem nome salvo, e
   *  nesses casos vem o telefone ou os dígitos finais do identificador. */
  contato: string;
  observado: string;
  erro: string;
  deveria: string;
}

export interface PontoImpacto {
  titulo: string;
  porque: string;
  /** A métrica que sustenta o ponto. Sem ela a afirmação não é conferível. */
  metrica?: string;
  /** As conversas concretas por trás da conclusão. */
  evidencias?: EvidenciaConversa[];
}

export interface ParecerCompleto {
  eficiencia: string;
  processo: string;
  relacionamento: string;
  comparativo_time?: string | null;
  pontos_impacto?: PontoImpacto[] | null;
  plano_acao: string;
  plano_acao_itens?: AcaoPlano[] | null;
  created_at?: string;
}

export interface CustoEstimado {
  audios_pendentes: number;
  minutos_pendentes: number;
  audios_expirados: number;
  custo_transcricao_usd: number;
  conversas_para_analisar: number;
  custo_analise_usd: number;
}

export interface EtapaFunil {
  rotulo: string;
  valor: number;
  /** `false` quando a etapa depende da IA — o painel marca isso para o leitor. */
  deterministica: boolean;
}

/**
 * @param ativo quando falso, NENHUMA consulta dispara.
 *
 * Existe porque o painel passou a exigir "Fazer pesquisa": o usuário monta
 * consultor e período com calma e só então busca. Sem esse portão, cada tecla
 * digitada numa data dispararia seis consultas ao banco — e a tela piscaria
 * resultados intermediários de períodos que ninguém pediu.
 */
/**
 * Cache do painel.
 *
 * O padrão do React Query descarta o cache em 5 minutos e trata todo dado como
 * velho na hora — por isso sair da tela e voltar reexibia o carregamento. Aqui
 * o dado é histórico: só muda quando o cron ingere mensagem nova, o que
 * acontece a cada 2 minutos e não altera meses fechados.
 *
 * `staleTime` de 10 min evita refetch ao voltar; `gcTime` de 2 h mantém o
 * resultado vivo enquanto a aba estiver aberta, mesmo navegando pelo ERP.
 */
const CACHE = { staleTime: 10 * 60 * 1000, gcTime: 2 * 60 * 60 * 1000 } as const;

export function useZapInteligencia(
  inicio: Date,
  fim: Date,
  usuarioId: string | null,
  ativo = true
) {
  const queryClient = useQueryClient();
  const iso = (d: Date) => d.toISOString();
  const janela = [iso(inicio), iso(fim)] as const;

  const {
    data: metricas = [],
    isLoading: carregandoMetricas,
    isFetching: buscandoMetricas,
    error: erroMetricas,
  } = useQuery({
    enabled: ativo,
    ...CACHE,
    queryKey: ['zap-metricas', ...janela],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_metricas_consultor' as any, {
        p_inicio: janela[0],
        p_fim: janela[1],
      });
      if (error) throw new Error(error.message);
      return (data || []) as MetricasConsultor[];
    },
  });

  /**
   * Mês com mais atendimento, 'yyyy-MM'. A tela abria no mês corrente, e no dia
   * 1º isso significa abrir num mês vazio — justamente quando alguém vai olhar
   * o fechamento do mês anterior.
   */
  /**
   * Lista de consultores para o seletor. Roda SEMPRE, mesmo com o painel
   * inativo: sem ela o campo "Consultor" abriria vazio e não haveria como
   * montar a pesquisa. É consulta leve — uma linha por consultor.
   */
  const { data: consultores = [] } = useQuery({
    queryKey: ['zap-consultores'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zap_instancias' as any)
        .select('usuario_id, usuarios(nome)')
        .not('usuario_id', 'is', null)
        .eq('ativo', true);
      if (error) throw new Error(error.message);
      const vistos = new Map<string, string>();
      for (const r of (data || []) as any[]) {
        if (r.usuario_id && !vistos.has(r.usuario_id)) {
          vistos.set(r.usuario_id, r.usuarios?.nome ?? 'Sem nome');
        }
      }
      return Array.from(vistos, ([usuario_id, consultor]) => ({ usuario_id, consultor }))
        .sort((a, b) => a.consultor.localeCompare(b.consultor));
    },
  });

  const { data: mesComMaisDados = null } = useQuery({
    queryKey: ['zap-mes-movimentado'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_mes_mais_movimentado' as any);
      if (error) throw new Error(error.message);
      return (data as string | null) ?? null;
    },
  });

  // Escopado ao consultor selecionado: o painel inteiro fala de uma pessoa, e o
  // custo mostrado tem de ser o do trabalho que o botão dali dispara.
  // Sem seleção, mostra quem tem mais atendimento. Mora aqui e não na página
  // porque lá dependeria de `metricas`, que só existe depois deste hook.
  const usuarioIdEfetivo = useMemo(
    () => usuarioId ?? metricas[0]?.usuario_id ?? null,
    [usuarioId, metricas]
  );

  const selecionado = useMemo(
    () => metricas.find((m) => m.usuario_id === usuarioIdEfetivo) ?? null,
    [metricas, usuarioIdEfetivo]
  );

  const { data: custo = null } = useQuery({
    ...CACHE,
    queryKey: ['zap-custo', usuarioIdEfetivo, ...janela],
    enabled: ativo && Boolean(usuarioIdEfetivo),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_custo_estimado' as any, {
        p_inicio: janela[0],
        p_fim: janela[1],
        p_usuario_id: usuarioIdEfetivo,
      });
      if (error) throw new Error(error.message);
      return ((data || [])[0] ?? null) as CustoEstimado | null;
    },
  });


  const porConsultor = { ...CACHE, enabled: ativo && Boolean(usuarioIdEfetivo) };
  const argsConsultor = {
    p_inicio: janela[0],
    p_fim: janela[1],
    p_usuario_id: usuarioIdEfetivo,
  };

  const { data: distribuicao = [] } = useQuery({
    ...porConsultor,
    queryKey: ['zap-distribuicao', usuarioIdEfetivo, ...janela],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_distribuicao_resposta' as any, argsConsultor);
      if (error) throw new Error(error.message);
      return (data || []) as FaixaResposta[];
    },
  });

  const { data: heatmap = [] } = useQuery({
    ...porConsultor,
    queryKey: ['zap-heatmap', usuarioIdEfetivo, ...janela],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_heatmap' as any, argsConsultor);
      if (error) throw new Error(error.message);
      return (data || []) as CelulaHeatmap[];
    },
  });

  const { data: objecoes = [] } = useQuery({
    ...porConsultor,
    queryKey: ['zap-objecoes', usuarioIdEfetivo, ...janela],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_objecoes_ranking' as any, argsConsultor);
      if (error) throw new Error(error.message);
      return (data || []) as ObjecaoRanking[];
    },
  });

  const { data: serie = [] } = useQuery({
    ...porConsultor,
    queryKey: ['zap-serie', usuarioIdEfetivo, ...janela],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zap_serie_diaria' as any, argsConsultor);
      if (error) throw new Error(error.message);
      return (data || []) as PontoSerie[];
    },
  });

  /**
   * Parecer já gravado para este consultor neste período exato. Sem isto,
   * recarregar a página o fazia sumir da vista e convidava a pagar de novo pelo
   * mesmo texto.
   */
  const { data: parecerSalvo = null } = useQuery({
    ...porConsultor,
    queryKey: ['zap-parecer', usuarioIdEfetivo, ...janela],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zap_consultor_parecer' as any)
        .select(
          'eficiencia, processo, relacionamento, comparativo_time, pontos_impacto, plano_acao, plano_acao_itens, created_at'
        )
        .eq('usuario_id', usuarioIdEfetivo)
        .eq('periodo_inicio', inicio.toISOString().slice(0, 10))
        .eq('periodo_fim', fim.toISOString().slice(0, 10))
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      // Duplo cast: os tipos gerados do Supabase ainda não incluem esta tabela.
      return (((data || [])[0] ?? null) as unknown) as ParecerCompleto | null;
    },
  });

  /** Refaz as consultas afetadas por uma rodada de análise ou por um parecer novo. */
  const recarregar = useCallback(() => {
    for (const k of ['zap-analises', 'zap-custo', 'zap-parecer', 'zap-objecoes', 'zap-metricas']) {
      queryClient.invalidateQueries({ queryKey: [k] });
    }
  }, [queryClient]);

  /**
   * O funil do consultor. As quatro primeiras etapas saem de contagem direta; a
   * última depende do julgamento da IA sobre a conversa, e por isso vem marcada
   * — misturar as duas origens sem avisar faria o leitor tratar um palpite de
   * modelo com a mesma confiança de uma contagem.
   */
  const funil = useMemo<EtapaFunil[]>(() => {
    if (!selecionado) return [];
    return [
      { rotulo: 'Contatos com conversa', valor: selecionado.contatos, deterministica: true },
      { rotulo: 'Consultor enviou mensagem', valor: selecionado.contatos_com_msg_consultor, deterministica: true },
      { rotulo: 'Cliente respondeu', valor: selecionado.contatos_com_resposta_cliente, deterministica: true },
      { rotulo: 'Recebeu catálogo ou link', valor: selecionado.contatos_com_link, deterministica: true },
      { rotulo: 'Reunião, proposta ou fechamento', valor: selecionado.contatos_com_reuniao, deterministica: false },
    ];
  }, [selecionado]);

  /**
   * Cobertura da análise por IA. Existe para o painel dizer "cobre 167 de 192
   * conversas" em vez de apresentar um recorte parcial como retrato completo.
   */
  const coberturaIA = useMemo(() => {
    const analisadas = selecionado?.conversas_analisadas ?? 0;
    const total = selecionado?.contatos ?? 0;
    return { analisadas, total, pct: total > 0 ? Math.round((analisadas / total) * 100) : 0 };
  }, [selecionado]);

  return {
    metricas,
    consultores,
    usuarioIdEfetivo,
    selecionado,
    funil,
    coberturaIA,
    distribuicao,
    heatmap,
    objecoes,
    serie,
    custo,
    parecerSalvo,
    mesComMaisDados,
    recarregar,
    // `isLoading` e não `isFetching`: o primeiro é "ainda não há dado", o
    // segundo inclui revalidação em segundo plano. Usar o segundo faria a tela
    // de carregamento cobrir resultados já visíveis.
    carregando: carregandoMetricas,
    revalidando: buscandoMetricas,
    // Sem isto, uma falha de permissão ou de RPC chega à tela como lista vazia —
    // igualzinho a "não há dados no período", que é o diagnóstico oposto.
    erro: erroMetricas instanceof Error ? erroMetricas.message : null,
  };
}

/** Segundos para algo legível. Devolve o traço quando não há base para o número. */
export function formatarDuracao(segundos: number | null | undefined): string {
  if (segundos == null) return '—';
  const s = Number(segundos);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
}

/** Percentual com o denominador junto — comparar taxas sem base engana. */
export function taxa(parte: number, todo: number): string {
  if (!todo) return '—';
  return `${((parte / todo) * 100).toFixed(1)}%`;
}
