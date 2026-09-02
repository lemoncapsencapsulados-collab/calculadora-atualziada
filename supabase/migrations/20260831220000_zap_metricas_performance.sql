-- Faz `zap_metricas_consultor` calcular os turnos UMA vez.
--
-- Medido em produção com 20.530 mensagens: 4,3 s por chamada, contra 0,35 s da
-- função de custo. A tela ficava visivelmente presa carregando, e o backfill
-- estava em 40% — o tempo cresceria junto com o acervo.
--
-- A causa: a função referenciava a view `zap_turnos` em quatro pontos
-- (aberturas, totais, conversas e, através de `zap_respostas`, duas vezes mais).
-- Cada referência reexecuta as window functions sobre a tabela inteira. Agora o
-- cálculo entra como CTE única e todo o resto deriva dela.
--
-- Duas outras economias, ambas por filtrar cedo:
--   - só instâncias vinculadas a um consultor entram (as demais não produzem
--     linha no resultado de qualquer forma);
--   - só conversas com alguma mensagem na janela entram no cálculo de turnos.
--
-- As views `zap_turnos` e `zap_respostas` continuam existindo para consulta
-- exploratória; esta função simplesmente deixou de depender delas.

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
language sql
stable
as $$
  with
  -- Conversas que tiveram atividade na janela. Tudo mais se limita a estas.
  alvo as (
    select distinct m.instance_name, m.remote_jid
    from public.zap_mensagens m
    join public.zap_instancias i
      on i.instance_name = m.instance_name and i.usuario_id is not null
    where m.momento >= p_inicio and m.momento <= p_fim
  ),
  -- Mensagens INTEIRAS dessas conversas: abertura e total de turnos são fatos
  -- da conversa, não do recorte, então não dá para cortar pela janela aqui.
  msgs as (
    select m.*
    from public.zap_mensagens m
    join alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
  ),
  marcado as (
    select
      instance_name, remote_jid, from_me, momento, id,
      case
        when lag(from_me) over w is distinct from from_me then 1
        -- Mesmo remetente após silêncio longo: nova tentativa, não continuação
        -- da rajada. Uma hora é o limiar (ver 20260831160000).
        when momento - lag(momento) over w > interval '1 hour' then 1
        else 0
      end as abre_turno
    from msgs
    window w as (partition by instance_name, remote_jid order by momento, id)
  ),
  numerado as (
    select *,
      sum(abre_turno) over (
        partition by instance_name, remote_jid order by momento, id
        rows between unbounded preceding and current row
      ) as turno
    from marcado
  ),
  -- O CÁLCULO DE TURNOS, uma vez só. Tudo abaixo lê daqui.
  turnos as (
    select
      instance_name, remote_jid, turno, from_me,
      min(momento) as inicio, max(momento) as fim
    from numerado
    group by instance_name, remote_jid, turno, from_me
  ),
  aberturas as (
    select distinct on (instance_name, remote_jid)
      instance_name, remote_jid, from_me as abriu_consultor
    from turnos
    order by instance_name, remote_jid, turno
  ),
  totais as (
    select instance_name, remote_jid, max(turno) as turnos_totais
    from turnos
    group by instance_name, remote_jid
  ),
  respostas as (
    select
      i.usuario_id,
      t.from_me as respondeu_consultor,
      -- Duas bases: do FIM da rajada anterior (tempo que a pessoa teve para
      -- reagir) e do INÍCIO dela (quanto o interlocutor esperou desde que
      -- falou — a definição de TMR1).
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
  midia as (
    select
      i.usuario_id,
      count(*) filter (where m.tipo = 'audio' and m.from_me)::integer as audios,
      count(*) filter (where m.tipo = 'video' and m.from_me)::integer as videos,
      count(distinct m.remote_jid) filter (
        where m.from_me and cardinality(m.dominios_links) > 0
      )::integer as com_link
    from msgs m
    join public.zap_instancias i on i.instance_name = m.instance_name
    where m.momento >= p_inicio and m.momento <= p_fim
    group by i.usuario_id
  ),
  conversas as (
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
  -- Percentis agregados de uma vez, em vez de uma subconsulta correlacionada
  -- por coluna e por consultor (eram cinco varreduras separadas de `respostas`).
  percentis as (
    select
      usuario_id,
      percentile_cont(0.5) within group (
        order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end
      ) as tmr1_med,
      percentile_cont(0.9) within group (
        order by case when respondeu_consultor and e_primeira_resposta then segundos_desde_inicio end
      ) as tmr1_p90,
      percentile_cont(0.5) within group (
        order by case when respondeu_consultor and not e_primeira_resposta then segundos end
      ) as cont_med,
      percentile_cont(0.9) within group (
        order by case when respondeu_consultor and not e_primeira_resposta then segundos end
      ) as cont_p90,
      percentile_cont(0.5) within group (
        order by case when not respondeu_consultor then segundos end
      ) as cli_med
    from respostas
    group by usuario_id
  )
  select
    c.usuario_id,
    min(c.consultor) as consultor,
    count(*)::integer,
    count(*) filter (where c.cliente_iniciou)::integer,
    count(*) filter (where c.consultor_iniciou)::integer,
    count(*) filter (where c.consultor_falou)::integer,
    count(*) filter (where c.cliente_falou and c.consultor_falou)::integer,
    max(p.tmr1_med),
    max(p.tmr1_p90),
    max(p.cont_med),
    max(p.cont_p90),
    max(p.cli_med),
    case
      when count(*) filter (where c.consultor_iniciou) = 0 then null
      else round(
        100.0 * count(*) filter (where c.consultor_iniciou and c.ultimo_turno = 1)
              / count(*) filter (where c.consultor_iniciou), 1)
    end,
    coalesce(max(md.audios), 0),
    coalesce(max(md.videos), 0),
    coalesce(max(md.com_link), 0)
  from conversas c
  left join percentis p on p.usuario_id = c.usuario_id
  left join midia md on md.usuario_id = c.usuario_id
  group by c.usuario_id;
$$;

grant execute on function public.zap_metricas_consultor(timestamptz, timestamptz) to authenticated;
