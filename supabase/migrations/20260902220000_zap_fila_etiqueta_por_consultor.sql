-- Fila e carteira por etiqueta, filtradas por consultor.
--
-- Saíram da visão geral da dashboard e passaram a existir só na apresentação,
-- que é sempre de UM consultor. Na visão geral elas somavam a base inteira, o
-- que respondia "quantos leads o time deixou parados" — pergunta legítima, mas
-- não a que a tela se propõe. Dentro da apresentação a mesma informação vira
-- responsabilidade nominal, que é o que faz alguém agir.
--
-- O vínculo consultor -> instância vem de `zap_instancias`.

create or replace function public.zap_fila_por_consultor(
  p_usuario_id uuid,
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  instance_name text,
  remote_jid text,
  identificacao text,
  telefone text,
  primeira_mensagem_at timestamptz,
  horas_esperando numeric,
  total_mensagens integer,
  etiquetas text[]
)
language sql
stable
security invoker
as $funcao$
  select
    c.instance_name,
    c.remote_jid,
    public.zap_identificacao_contato(c.nome, c.telefone, c.remote_jid),
    c.telefone,
    c.primeira_mensagem_at,
    round(extract(epoch from (now() - c.primeira_mensagem_at)) / 3600, 1),
    c.total_mensagens,
    coalesce((
      select array_agg(e.nome order by e.nome)
      from public.zap_contato_etiquetas ce
      join public.zap_etiquetas e
        on e.instance_name = ce.instance_name and e.label_id = ce.label_id
      where ce.instance_name = c.instance_name and ce.remote_jid = c.remote_jid
    ), '{}')
  from public.zap_contatos c
  join public.zap_instancias i
    on i.instance_name = c.instance_name and i.usuario_id = p_usuario_id and i.ativo
  where not exists (
    select 1 from public.zap_mensagens m
    where m.instance_name = c.instance_name
      and m.remote_jid = c.remote_jid
      and m.from_me
  )
  and (p_inicio is null or c.primeira_mensagem_at >= p_inicio)
  and (p_fim    is null or c.primeira_mensagem_at <= p_fim)
  order by c.primeira_mensagem_at;
$funcao$;

create or replace function public.zap_etiquetas_por_consultor(
  p_usuario_id uuid
)
returns table (
  label_id text,
  etiqueta text,
  cor text,
  contatos bigint,
  com_conversa bigint,
  sem_conversa bigint,
  sem_atendimento bigint,
  parados_30d bigint,
  etapa_ia_mais_comum text
)
language sql
stable
security invoker
as $funcao$
  select
    e.label_id,
    e.nome,
    e.cor,
    count(*)::bigint,
    count(c.remote_jid)::bigint,
    count(*) filter (where c.remote_jid is null)::bigint,
    count(*) filter (where c.remote_jid is not null and not exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me
    ))::bigint,
    -- Parado há mais de 30 dias dentro de uma etiqueta de negociação ativa é o
    -- número que costuma doer: é carteira que o consultor considera viva.
    count(*) filter (
      where c.ultima_mensagem_at is not null
        and c.ultima_mensagem_at < now() - interval '30 days'
    )::bigint,
    mode() within group (order by a.etapa_funil)
  from public.zap_etiquetas e
  join public.zap_instancias i
    on i.instance_name = e.instance_name and i.usuario_id = p_usuario_id and i.ativo
  join public.zap_contato_etiquetas ce
    on ce.instance_name = e.instance_name and ce.label_id = e.label_id
  left join public.zap_contatos c
    on c.instance_name = ce.instance_name and c.remote_jid = ce.remote_jid
  left join public.zap_conversa_analise a
    on a.instance_name = ce.instance_name and a.remote_jid = ce.remote_jid
  group by e.label_id, e.nome, e.cor
  order by count(*) desc;
$funcao$;

grant execute on function public.zap_fila_por_consultor(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function public.zap_etiquetas_por_consultor(uuid)
  to authenticated, service_role;
