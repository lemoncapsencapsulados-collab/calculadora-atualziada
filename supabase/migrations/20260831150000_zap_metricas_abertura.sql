-- Corrige a atribuição de abertura de conversa nas métricas por consultor.
--
-- Bug observado com dados reais: `contatos` mostrava 20 enquanto
-- `cliente_iniciou + consultor_iniciou` somava 18. A causa era ler "quem abriu"
-- dentro da janela do período — uma conversa iniciada em maio e ainda ativa em
-- agosto tem o turno 1 fora da janela e não contava para ninguém. O mesmo
-- viciava a taxa de vácuo inicial, que olhava o último turno DA JANELA em vez
-- do último turno da conversa.
--
-- Abertura e total de turnos são fatos da conversa, não do recorte. A janela
-- continua definindo QUAIS conversas entram; só não define mais quem abriu.

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
  -- Etapas 2 e 3 do funil de atendimento. Determinísticas: não dependem da IA.
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
  -- Quem abriu a conversa e quantos turnos ela teve NO TOTAL — apurados sobre a
  -- conversa inteira, nunca sobre a janela. Uma conversa que começou em maio e
  -- segue ativa em agosto tem o turno 1 fora do período: se a abertura fosse
  -- lida só dentro da janela, ela não contaria como iniciada por ninguém, e
  -- `contatos` deixaria de bater com a soma das suas partes — o tipo de furo
  -- que faz quem lê o painel parar de confiar nele.
  with aberturas as (
    select distinct on (instance_name, remote_jid)
      instance_name, remote_jid, from_me as abriu_consultor
    from public.zap_turnos
    order by instance_name, remote_jid, turno
  ),
  totais as (
    select instance_name, remote_jid, max(turno) as turnos_totais
    from public.zap_turnos
    group by instance_name, remote_jid
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
    from public.zap_turnos t
    join public.zap_instancias i on i.instance_name = t.instance_name
    join public.usuarios u on u.id = i.usuario_id
    join aberturas a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
    join totais tt on tt.instance_name = t.instance_name and tt.remote_jid = t.remote_jid
    -- A JANELA continua definindo QUAIS conversas entram (as que tiveram
    -- atividade no período); ela só não define mais quem abriu.
    where t.inicio >= p_inicio and t.inicio <= p_fim
    group by i.usuario_id, u.nome, t.instance_name, t.remote_jid
  ),
  respostas as (
    select c.usuario_id, r.*
    from public.zap_respostas r
    join conversas c
      on c.instance_name = r.instance_name and c.remote_jid = r.remote_jid
    where r.respondido_em >= p_inicio and r.respondido_em <= p_fim
  ),
  midia as (
    select
      c.usuario_id,
      count(*) filter (where m.tipo = 'audio' and m.from_me)::integer as audios,
      count(*) filter (where m.tipo = 'video' and m.from_me)::integer as videos,
      count(distinct m.remote_jid) filter (
        where m.from_me and cardinality(m.dominios_links) > 0
      )::integer as com_link
    from public.zap_mensagens m
    join conversas c
      on c.instance_name = m.instance_name and c.remote_jid = m.remote_jid
    where m.momento >= p_inicio and m.momento <= p_fim
    group by c.usuario_id
  )
  select
    c.usuario_id,
    min(c.consultor) as consultor,
    count(*)::integer as contatos,
    count(*) filter (where c.cliente_iniciou)::integer,
    count(*) filter (where c.consultor_iniciou)::integer,
    count(*) filter (where c.consultor_falou)::integer,
    count(*) filter (where c.cliente_falou and c.consultor_falou)::integer,
    (select percentile_cont(0.5) within group (order by r.segundos_desde_inicio)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and r.e_primeira_resposta),
    (select percentile_cont(0.9) within group (order by r.segundos_desde_inicio)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and r.e_primeira_resposta),
    (select percentile_cont(0.5) within group (order by r.segundos)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and not r.e_primeira_resposta),
    (select percentile_cont(0.9) within group (order by r.segundos)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and not r.e_primeira_resposta),
    (select percentile_cont(0.5) within group (order by r.segundos)
       from respostas r where r.usuario_id = c.usuario_id
        and not r.respondeu_consultor),
    -- Vácuo inicial: consultor abordou e a conversa nunca passou do 1º turno.
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
  left join midia md on md.usuario_id = c.usuario_id
  group by c.usuario_id;
$$;

grant execute on function public.zap_metricas_consultor(timestamptz, timestamptz) to authenticated;
