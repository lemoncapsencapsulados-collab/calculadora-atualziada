create or replace function public.zap_diag(p_inicio timestamptz, p_fim timestamptz)
returns table (etapa text, linhas bigint, ms numeric)
language plpgsql stable as $$
declare t0 timestamptz; n bigint;
begin
  t0 := clock_timestamp();
  with alvo as (
    select distinct t.instance_name, t.remote_jid from public.zap_turnos_cache t
    join public.zap_instancias i on i.instance_name=t.instance_name and i.usuario_id is not null
    where t.inicio >= p_inicio and t.inicio <= p_fim),
  turnos as (select t.* from public.zap_turnos_cache t
    join alvo a on a.instance_name=t.instance_name and a.remote_jid=t.remote_jid),
  respostas as (
    select i.usuario_id, t.from_me as rc,
      extract(epoch from (t.inicio-ant.fim))::numeric as seg,
      extract(epoch from (t.inicio-ant.inicio))::numeric as seg0,
      ant.turno=1 as pr
    from turnos t join turnos ant on ant.instance_name=t.instance_name
      and ant.remote_jid=t.remote_jid and ant.turno=t.turno-1
    join public.zap_instancias i on i.instance_name=t.instance_name
    where ant.from_me is distinct from t.from_me and t.inicio >= p_inicio and t.inicio <= p_fim)
  select count(*) into n from (
    select usuario_id,
      percentile_cont(0.5) within group (order by case when rc and pr then seg0 end),
      percentile_cont(0.9) within group (order by case when rc and pr then seg0 end),
      percentile_cont(0.5) within group (order by case when rc and not pr then seg end),
      percentile_cont(0.9) within group (order by case when rc and not pr then seg end),
      percentile_cont(0.5) within group (order by case when not rc then seg end)
    from respostas group by usuario_id) p;
  etapa:='5_percentis'; linhas:=n; ms:=extract(epoch from clock_timestamp()-t0)*1000; return next;

  t0 := clock_timestamp();
  select count(*) into n from public.zap_metricas_consultor(p_inicio, p_fim);
  etapa:='6_funcao_inteira'; linhas:=n; ms:=extract(epoch from clock_timestamp()-t0)*1000; return next;
end $$;
grant execute on function public.zap_diag(timestamptz,timestamptz) to service_role;
