-- Métricas por consultor, versão expandida.
--
-- Acrescenta: p99 nos três tempos, contagem de imagem e documento, taxa de
-- reunião, taxas de sentimento, e o filtro de contatos internos.
--
-- `p_incluir_internos` existe para a exclusão ser auditável: quem desconfiar do
-- corte liga o parâmetro e compara os dois números lado a lado, em vez de ter
-- que confiar na minha heurística.
--
-- Continua em plpgsql com CTEs `as materialized`. As duas escolhas são de
-- performance, medidas: `language sql` era inlined pelo PostgREST e degradava o
-- plano (8,3 s), e sem `materialized` o Postgres reavaliava cada CTE a cada
-- referência (4 s). Com as duas, 0,6 s.

create or replace function public.zap_metricas_consultor(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_incluir_internos boolean default false
)
returns table (
  usuario_id uuid,
  consultor text,
  contatos integer,
  contatos_cliente_iniciou integer,
  contatos_consultor_iniciou integer,
  contatos_com_msg_consultor integer,
  contatos_com_resposta_cliente integer,
  tmr1_mediana_seg numeric,
  tmr1_p90_seg numeric,
  tmr1_p99_seg numeric,
  tmr1_media_seg numeric,
  resposta_continua_mediana_seg numeric,
  resposta_continua_p90_seg numeric,
  resposta_continua_p99_seg numeric,
  resposta_cliente_mediana_seg numeric,
  resposta_cliente_p90_seg numeric,
  vacuo_inicial_pct numeric,
  audios_enviados integer,
  videos_enviados integer,
  imagens_enviadas integer,
  documentos_enviados integer,
  contatos_com_link integer,
  contatos_com_reuniao integer,
  conversas_analisadas integer,
  sentimento_positivo integer,
  sentimento_neutro integer,
  sentimento_negativo integer,
  contatos_internos_excluidos integer
)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with
  -- Contatos que entram no cálculo. O filtro de interno mora aqui, uma vez só.
  elegiveis as materialized (
    select c.instance_name, c.remote_jid
    from public.zap_contatos c
    where p_incluir_internos or c.classificacao <> 'interno'
  ),
  alvo as materialized (
    select distinct t.instance_name, t.remote_jid
    from public.zap_turnos_cache t
    join public.zap_instancias i
      on i.instance_name = t.instance_name and i.usuario_id is not null
    join elegiveis e
      on e.instance_name = t.instance_name and e.remote_jid = t.remote_jid
    where t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  turnos as materialized (
    select t.* from public.zap_turnos_cache t
    join alvo a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
  ),
  aberturas as materialized (
    select distinct on (instance_name, remote_jid)
      instance_name, remote_jid, from_me as abriu_consultor
    from turnos order by instance_name, remote_jid, turno
  ),
  totais as materialized (
    select instance_name, remote_jid, max(turno) as turnos_totais
    from turnos group by instance_name, remote_jid
  ),
  respostas as materialized (
    select
      i.usuario_id,
      t.from_me as respondeu_consultor,
      extract(epoch from (t.inicio - ant.fim))::numeric as segundos,
      extract(epoch from (t.inicio - ant.inicio))::numeric as segundos_desde_inicio,
      ant.turno = 1 as e_primeira_resposta
    from turnos t
    join turnos ant on ant.instance_name = t.instance_name
      and ant.remote_jid = t.remote_jid and ant.turno = t.turno - 1
    join public.zap_instancias i on i.instance_name = t.instance_name
    where ant.from_me is distinct from t.from_me
      and t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  midia as materialized (
    select
      i.usuario_id,
      count(*) filter (where m.tipo = 'audio' and m.from_me)::integer as audios,
      count(*) filter (where m.tipo = 'video' and m.from_me)::integer as videos,
      count(*) filter (where m.tipo = 'imagem' and m.from_me)::integer as imagens,
      count(*) filter (where m.tipo = 'documento' and m.from_me)::integer as documentos,
      count(distinct m.remote_jid) filter (
        where m.from_me and cardinality(m.dominios_links) > 0)::integer as com_link
    from public.zap_mensagens m
    join alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
    join public.zap_instancias i on i.instance_name = m.instance_name
    where m.momento >= p_inicio and m.momento <= p_fim
    group by i.usuario_id
  ),
  -- Sentimento e reunião vêm da IA, e só existem para conversa já analisada.
  -- `conversas_analisadas` sai junto para o painel poder mostrar a cobertura em
  -- vez de apresentar um recorte parcial como se fosse o retrato completo.
  analise as materialized (
    select
      i.usuario_id,
      count(*)::integer as analisadas,
      count(*) filter (where an.sentimento = 'positivo')::integer as positivo,
      count(*) filter (where an.sentimento = 'neutro')::integer as neutro,
      count(*) filter (where an.sentimento = 'negativo')::integer as negativo,
      count(*) filter (where an.etapa_funil in
        ('meeting_agendada','proposta','fechado'))::integer as com_reuniao
    from public.zap_conversa_analise an
    join alvo a on a.instance_name = an.instance_name and a.remote_jid = an.remote_jid
    join public.zap_instancias i on i.instance_name = an.instance_name
    where an.versao_prompt = 1
    group by i.usuario_id
  ),
  excluidos as materialized (
    select i.usuario_id, count(distinct (c.instance_name, c.remote_jid))::integer as n
    from public.zap_contatos c
    join public.zap_instancias i on i.instance_name = c.instance_name
    where c.classificacao = 'interno'
    group by i.usuario_id
  ),
  conversas as materialized (
    select
      i.usuario_id, u.nome as consultor, t.instance_name, t.remote_jid,
      bool_or(not a.abriu_consultor) as cliente_iniciou,
      bool_or(a.abriu_consultor) as consultor_iniciou,
      bool_or(t.from_me) as consultor_falou,
      bool_or(not t.from_me) as cliente_falou,
      max(tt.turnos_totais) as ultimo_turno
    from turnos t
    join public.zap_instancias i on i.instance_name = t.instance_name
    join public.usuarios u on u.id = i.usuario_id
    join aberturas a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
    join totais tt on tt.instance_name = t.instance_name and tt.remote_jid = t.remote_jid
    where t.inicio >= p_inicio and t.inicio <= p_fim
    group by i.usuario_id, u.nome, t.instance_name, t.remote_jid
  ),
  percentis as materialized (
    select
      usuario_id,
      percentile_cont(0.5) within group (order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end) as tmr1_med,
      percentile_cont(0.9) within group (order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end) as tmr1_p90,
      percentile_cont(0.99) within group (order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end) as tmr1_p99,
      avg(case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end) as tmr1_media,
      percentile_cont(0.5) within group (order by case when respondeu_consultor and not e_primeira_resposta then segundos end) as cont_med,
      percentile_cont(0.9) within group (order by case when respondeu_consultor and not e_primeira_resposta then segundos end) as cont_p90,
      percentile_cont(0.99) within group (order by case when respondeu_consultor and not e_primeira_resposta then segundos end) as cont_p99,
      percentile_cont(0.5) within group (order by case when not respondeu_consultor then segundos end) as cli_med,
      percentile_cont(0.9) within group (order by case when not respondeu_consultor then segundos end) as cli_p90
    from respostas group by usuario_id
  )
  select
    c.usuario_id, min(c.consultor), count(*)::integer,
    count(*) filter (where c.cliente_iniciou)::integer,
    count(*) filter (where c.consultor_iniciou)::integer,
    count(*) filter (where c.consultor_falou)::integer,
    count(*) filter (where c.cliente_falou and c.consultor_falou)::integer,
    -- Casts explícitos: percentile_cont e avg devolvem double precision.
    max(p.tmr1_med)::numeric, max(p.tmr1_p90)::numeric, max(p.tmr1_p99)::numeric, max(p.tmr1_media)::numeric,
    max(p.cont_med)::numeric, max(p.cont_p90)::numeric, max(p.cont_p99)::numeric,
    max(p.cli_med)::numeric, max(p.cli_p90)::numeric,
    case when count(*) filter (where c.consultor_iniciou) = 0 then null
      else round(100.0 * count(*) filter (where c.consultor_iniciou and c.ultimo_turno = 1)
                       / count(*) filter (where c.consultor_iniciou), 1) end,
    coalesce(max(md.audios), 0), coalesce(max(md.videos), 0),
    coalesce(max(md.imagens), 0), coalesce(max(md.documentos), 0),
    coalesce(max(md.com_link), 0),
    coalesce(max(an.com_reuniao), 0), coalesce(max(an.analisadas), 0),
    coalesce(max(an.positivo), 0), coalesce(max(an.neutro), 0), coalesce(max(an.negativo), 0),
    coalesce(max(ex.n), 0)
  from conversas c
  left join percentis p on p.usuario_id = c.usuario_id
  left join midia md on md.usuario_id = c.usuario_id
  left join analise an on an.usuario_id = c.usuario_id
  left join excluidos ex on ex.usuario_id = c.usuario_id
  group by c.usuario_id;
end
$funcao$;

grant execute on function public.zap_metricas_consultor(timestamptz, timestamptz, boolean) to authenticated;
