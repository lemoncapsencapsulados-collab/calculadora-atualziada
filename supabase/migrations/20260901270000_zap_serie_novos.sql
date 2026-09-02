-- Série diária separando contato NOVO de contato RECORRENTE.
--
-- A versão anterior misturava os dois numa linha só, e isso escondia a
-- pergunta que o gráfico deveria responder: o consultor é lento com quem chega
-- agora, ou com quem já está na carteira? São problemas diferentes e exigem
-- correções diferentes — o primeiro é resposta a lead novo, o segundo é
-- follow-up abandonado.
--
-- "Novo" é o contato cuja PRIMEIRA mensagem de todas caiu naquele dia. Não é
-- "primeira mensagem dentro do período": se alguém falou em maio e voltou em
-- agosto, ele é recorrente mesmo que a janela comece em agosto. Confundir os
-- dois inflaria a aquisição do mês.

-- Drop antes do create: a assinatura de retorno mudou (colunas novas), e
-- `create or replace` recusa mudança de tipo de retorno com SQLSTATE 42P13.
drop function if exists public.zap_serie_diaria(timestamptz, timestamptz, uuid);

create or replace function public.zap_serie_diaria(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid default null
)
returns table (
  dia date,
  contatos bigint,
  contatos_novos bigint,
  contatos_recorrentes bigint,
  mensagens bigint,
  tmr1_novos_seg numeric,
  tmr1_recorrentes_seg numeric
)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid, c.primeira_mensagem_at
    from public.zap_contatos c
    join public.zap_instancias i
      on i.instance_name = c.instance_name and i.usuario_id is not null
    where c.classificacao <> 'interno'
      and (p_usuario_id is null or i.usuario_id = p_usuario_id)
  ),
  turnos as materialized (
    select t.*, e.primeira_mensagem_at
    from public.zap_turnos_cache t
    join elegiveis e on e.instance_name = t.instance_name and e.remote_jid = t.remote_jid
    where t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  -- Atividade do dia, marcando quais contatos nasceram naquele dia.
  atividade as materialized (
    select
      (t.inicio at time zone 'America/Sao_Paulo')::date as dia,
      t.instance_name, t.remote_jid,
      -- Comparação em horário local nos dois lados: em UTC, uma conversa
      -- iniciada às 22h de Brasília cairia no dia seguinte e apareceria como
      -- "nova" no dia errado.
      (t.primeira_mensagem_at at time zone 'America/Sao_Paulo')::date
        = (t.inicio at time zone 'America/Sao_Paulo')::date as e_novo,
      sum(t.mensagens) as msgs
    from turnos t
    group by 1,2,3,4
  ),
  -- Primeira resposta do consultor, já sabendo se o contato era novo.
  primeiras as materialized (
    select
      (t.inicio at time zone 'America/Sao_Paulo')::date as dia,
      extract(epoch from (t.inicio - ant.inicio))::numeric as seg,
      (t.primeira_mensagem_at at time zone 'America/Sao_Paulo')::date
        = (t.inicio at time zone 'America/Sao_Paulo')::date as e_novo
    from turnos t
    join public.zap_turnos_cache ant
      on ant.instance_name = t.instance_name and ant.remote_jid = t.remote_jid
     and ant.turno = t.turno - 1
    where t.from_me and not ant.from_me and ant.turno = 1
  )
  select
    a.dia,
    count(*)::bigint,
    count(*) filter (where a.e_novo)::bigint,
    count(*) filter (where not a.e_novo)::bigint,
    sum(a.msgs)::bigint,
    (select round(percentile_cont(0.5) within group (order by p.seg)::numeric, 1)
       from primeiras p where p.dia = a.dia and p.e_novo),
    (select round(percentile_cont(0.5) within group (order by p.seg)::numeric, 1)
       from primeiras p where p.dia = a.dia and not p.e_novo)
  from atividade a
  group by a.dia
  order by a.dia;
end
$funcao$;

grant execute on function public.zap_serie_diaria(timestamptz, timestamptz, uuid) to authenticated;
