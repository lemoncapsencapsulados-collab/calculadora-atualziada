-- Força materialização explícita das CTEs de `zap_metricas_consultor`.
--
-- Medido: cada etapa isolada custa entre 18 e 169 ms, somando ~450 ms, mas a
-- função inteira leva 3.973 ms. Partes rápidas e todo lento é a assinatura de
-- CTE sendo reavaliada a cada referência em vez de calculada uma vez.
--
-- O Postgres 12+ decide sozinho entre materializar e inlinear, e aqui decidiu
-- errado. `as materialized` tira a decisão dele.

create or replace function public.zap_metricas_consultor(
  p_inicio timestamptz,
  p_fim timestamptz
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
  resposta_continua_mediana_seg numeric,
  resposta_continua_p90_seg numeric,
  resposta_cliente_mediana_seg numeric,
  vacuo_inicial_pct numeric,
  audios_enviados integer,
  videos_enviados integer,
  contatos_com_link integer
)
language plpgsql
stable
as $funcao$
-- Em plpgsql, cada coluna de RETURNS TABLE vira uma variável — e `usuario_id`,
-- `consultor`, `contatos` colidem com os nomes de coluna usados no corpo. Sem
-- esta diretiva o Postgres recusa a consulta com "column reference is
-- ambiguous". `use_column` manda resolver a favor da coluna, que é o que o
-- corpo sempre quis dizer.
#variable_conflict use_column
begin
  return query
with
  -- Conversas com atividade na janela, só de instâncias com consultor.
  alvo as materialized (
    select distinct t.instance_name, t.remote_jid
    from public.zap_turnos_cache t
    join public.zap_instancias i
      on i.instance_name = t.instance_name and i.usuario_id is not null
    where t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  -- Turnos INTEIROS dessas conversas: abertura e total são fatos da conversa,
  -- não do recorte.
  turnos as materialized (
    select t.*
    from public.zap_turnos_cache t
    join alvo a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
  ),
  aberturas as materialized (
    select distinct on (instance_name, remote_jid)
      instance_name, remote_jid, from_me as abriu_consultor
    from turnos
    order by instance_name, remote_jid, turno
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
    join turnos ant
      on ant.instance_name = t.instance_name
     and ant.remote_jid = t.remote_jid
     and ant.turno = t.turno - 1
    join public.zap_instancias i on i.instance_name = t.instance_name
    where ant.from_me is distinct from t.from_me
      and t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  midia as materialized (
    select
      i.usuario_id,
      count(*) filter (where m.tipo = 'audio' and m.from_me)::integer as audios,
      count(*) filter (where m.tipo = 'video' and m.from_me)::integer as videos,
      count(distinct m.remote_jid) filter (
        where m.from_me and cardinality(m.dominios_links) > 0
      )::integer as com_link
    from public.zap_mensagens m
    join alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
    join public.zap_instancias i on i.instance_name = m.instance_name
    where m.momento >= p_inicio and m.momento <= p_fim
    group by i.usuario_id
  ),
  conversas as materialized (
    select
      i.usuario_id,
      u.nome as consultor,
      t.instance_name,
      t.remote_jid,
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
      percentile_cont(0.5) within group (
        order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end) as tmr1_med,
      percentile_cont(0.9) within group (
        order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end) as tmr1_p90,
      percentile_cont(0.5) within group (
        order by case when respondeu_consultor and not e_primeira_resposta then segundos end) as cont_med,
      percentile_cont(0.9) within group (
        order by case when respondeu_consultor and not e_primeira_resposta then segundos end) as cont_p90,
      percentile_cont(0.5) within group (
        order by case when not respondeu_consultor then segundos end) as cli_med
    from respostas group by usuario_id
  )
  select
    c.usuario_id,
    min(c.consultor),
    count(*)::integer,
    count(*) filter (where c.cliente_iniciou)::integer,
    count(*) filter (where c.consultor_iniciou)::integer,
    count(*) filter (where c.consultor_falou)::integer,
    count(*) filter (where c.cliente_falou and c.consultor_falou)::integer,
    -- Casts explícitos: `percentile_cont` só aceita double precision, então
    -- devolve double precision mesmo recebendo numeric. A versão `language sql`
    -- convertia sozinha na saída; plpgsql exige tipo exato em RETURN QUERY.
    max(p.tmr1_med)::numeric, max(p.tmr1_p90)::numeric,
    max(p.cont_med)::numeric, max(p.cont_p90)::numeric, max(p.cli_med)::numeric,
    case
      when count(*) filter (where c.consultor_iniciou) = 0 then null
      else round(100.0 * count(*) filter (where c.consultor_iniciou and c.ultimo_turno = 1)
                       / count(*) filter (where c.consultor_iniciou), 1)
    end,
    coalesce(max(md.audios), 0), coalesce(max(md.videos), 0), coalesce(max(md.com_link), 0)
  from conversas c
  left join percentis p on p.usuario_id = c.usuario_id
  left join midia md on md.usuario_id = c.usuario_id
  group by c.usuario_id;
end
$funcao$;

grant execute on function public.zap_metricas_consultor(timestamptz, timestamptz) to authenticated;
