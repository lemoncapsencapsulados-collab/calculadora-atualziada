-- Materializa os turnos numa tabela, atualizada na ingestão.
--
-- Medido em produção: `zap_metricas_consultor` levava 6,8-7,8 s com 36.874
-- mensagens, e o backfill estava em 59%. A projeção passava de 12 s no acervo
-- completo — a tela ficava presa no esqueleto de carregamento e o usuário
-- concluía, com razão, que estava quebrada.
--
-- A causa não era o SQL, era o desenho: as window functions que reconstroem os
-- turnos varriam TODO o histórico das conversas a cada abertura de painel. Esse
-- cálculo depende só das mensagens, que não mudam depois de gravadas — então
-- refazê-lo a cada leitura é trabalho jogado fora.
--
-- Agora ele acontece uma vez por conversa, no momento da escrita, e o painel lê
-- uma tabela pequena e indexada. O tamanho da tabela é ~1 turno a cada 3-4
-- mensagens, então cresce bem devagar em relação ao acervo.

create table if not exists public.zap_turnos_cache (
  instance_name text not null,
  remote_jid text not null,
  turno integer not null,
  from_me boolean not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  mensagens integer not null,
  primary key (instance_name, remote_jid, turno)
);

create index if not exists idx_zap_turnos_cache_inicio
  on public.zap_turnos_cache (inicio);

grant select on public.zap_turnos_cache to authenticated;
grant all on public.zap_turnos_cache to service_role;
alter table public.zap_turnos_cache enable row level security;

drop policy if exists "zapvendas le zap_turnos_cache" on public.zap_turnos_cache;
create policy "zapvendas le zap_turnos_cache" on public.zap_turnos_cache
  for select to authenticated using (public.has_role('zapvendas'));

-- ---------------------------------------------------------------------------
-- Recálculo de UMA conversa
-- ---------------------------------------------------------------------------
-- Chamada pela ingestão depois de gravar mensagens. Apaga e reinsere os turnos
-- daquela conversa: mais simples e mais seguro que tentar atualizar
-- incrementalmente, porque uma mensagem antiga chegando pelo backfill pode
-- renumerar todos os turnos seguintes.
create or replace function public.zap_recalcular_turnos(
  p_instance text,
  p_jid text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linhas integer;
begin
  delete from public.zap_turnos_cache
   where instance_name = p_instance and remote_jid = p_jid;

  insert into public.zap_turnos_cache (instance_name, remote_jid, turno, from_me, inicio, fim, mensagens)
  with marcado as (
    select
      instance_name, remote_jid, from_me, momento, id,
      case
        when lag(from_me) over w is distinct from from_me then 1
        -- Silêncio longo do mesmo remetente = nova tentativa, não continuação
        -- da rajada (ver 20260831160000).
        when momento - lag(momento) over w > interval '1 hour' then 1
        else 0
      end as abre_turno
    from public.zap_mensagens
    where instance_name = p_instance and remote_jid = p_jid
    window w as (order by momento, id)
  ),
  numerado as (
    select *,
      sum(abre_turno) over (order by momento, id rows between unbounded preceding and current row) as turno
    from marcado
  )
  select instance_name, remote_jid, turno, from_me,
         min(momento), max(momento), count(*)::integer
  from numerado
  group by instance_name, remote_jid, turno, from_me;

  get diagnostics v_linhas = row_count;
  return v_linhas;
end
$$;

grant execute on function public.zap_recalcular_turnos(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Reconstrução total
-- ---------------------------------------------------------------------------
-- Para a carga inicial e para consertar divergência. Sem isto, uma falha na
-- ingestão deixaria conversas fora do cache — e métrica que ignora conversa em
-- silêncio é pior que métrica lenta.
create or replace function public.zap_recalcular_turnos_todos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversa record;
  v_total integer := 0;
begin
  for v_conversa in
    select distinct instance_name, remote_jid from public.zap_mensagens
  loop
    v_total := v_total + public.zap_recalcular_turnos(v_conversa.instance_name, v_conversa.remote_jid);
  end loop;
  return v_total;
end
$$;

grant execute on function public.zap_recalcular_turnos_todos() to service_role;

-- ---------------------------------------------------------------------------
-- Métricas lendo o cache
-- ---------------------------------------------------------------------------
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
  -- Conversas com atividade na janela, só de instâncias com consultor.
  alvo as (
    select distinct t.instance_name, t.remote_jid
    from public.zap_turnos_cache t
    join public.zap_instancias i
      on i.instance_name = t.instance_name and i.usuario_id is not null
    where t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  -- Turnos INTEIROS dessas conversas: abertura e total são fatos da conversa,
  -- não do recorte.
  turnos as (
    select t.*
    from public.zap_turnos_cache t
    join alvo a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
  ),
  aberturas as (
    select distinct on (instance_name, remote_jid)
      instance_name, remote_jid, from_me as abriu_consultor
    from turnos
    order by instance_name, remote_jid, turno
  ),
  totais as (
    select instance_name, remote_jid, max(turno) as turnos_totais
    from turnos group by instance_name, remote_jid
  ),
  respostas as (
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
  midia as (
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
  percentis as (
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
    max(p.tmr1_med), max(p.tmr1_p90), max(p.cont_med), max(p.cont_p90), max(p.cli_med),
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
$$;

grant execute on function public.zap_metricas_consultor(timestamptz, timestamptz) to authenticated;
