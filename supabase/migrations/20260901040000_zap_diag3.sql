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
  aberturas as (select distinct on (instance_name, remote_jid) instance_name, remote_jid, from_me as ac
    from turnos order by instance_name, remote_jid, turno),
  totais as (select instance_name, remote_jid, max(turno) as tt from turnos group by instance_name, remote_jid)
  select count(*) into n from (
    select i.usuario_id, u.nome, t.instance_name, t.remote_jid,
      bool_or(not a.ac), bool_or(a.ac), bool_or(t.from_me), bool_or(not t.from_me), max(tt.tt)
    from turnos t
    join public.zap_instancias i on i.instance_name=t.instance_name
    join public.usuarios u on u.id=i.usuario_id
    join aberturas a on a.instance_name=t.instance_name and a.remote_jid=t.remote_jid
    join totais tt on tt.instance_name=t.instance_name and tt.remote_jid=t.remote_jid
    where t.inicio >= p_inicio and t.inicio <= p_fim
    group by i.usuario_id, u.nome, t.instance_name, t.remote_jid) c;
  etapa:='7_conversas'; linhas:=n; ms:=extract(epoch from clock_timestamp()-t0)*1000; return next;

  t0 := clock_timestamp();
  select count(*) into n from public.zap_metricas_consultor(p_inicio, p_fim);
  etapa:='8_funcao_inteira'; linhas:=n; ms:=extract(epoch from clock_timestamp()-t0)*1000; return next;
end $$;
grant execute on function public.zap_diag(timestamptz,timestamptz) to service_role;
