-- Etiquetas do WhatsApp e fila de atendimento.
--
-- POR QUE AS ETIQUETAS VÊM DO BANCO DA EVOLUTION, E NÃO DA API DELA:
-- `/label/findLabels` devolve a lista de etiquetas, mas nenhuma rota REST
-- devolve QUEM está em cada uma. Verificado nesta instalação: 404 nas rotas
-- específicas e zero campos de etiqueta em 918 chats varridos. O vínculo existe
-- em `Chat.labels` (jsonb) no Postgres da Evolution — 560 chats etiquetados.
-- Como esse Postgres não é exposto para fora da VPS, quem lê é um serviço lá
-- dentro, que empurra para cá.
--
-- POR QUE ISSO IMPORTA: as etiquetas são o funil que o time mantém à mão —
-- LEAD, EM NEGOCIAÇÃO, reunião, PAGO, PEDIDO ENVIADO, PERDIDO, FAZER FOLLOW UP
-- FRIO. Cruzar isso com a `etapa_funil` que a IA infere mostra onde as duas
-- discordam, e é aí que costuma haver lead se perdendo sem ninguém ver.

-- ---------------------------------------------------------------------------
-- Catálogo de etiquetas
-- ---------------------------------------------------------------------------
create table if not exists public.zap_etiquetas (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  -- `labelId` da Evolution. É o que aparece dentro de `Chat.labels`.
  label_id text not null,
  nome text not null,
  cor text,
  atualizado_em timestamptz not null default now(),
  unique (instance_name, label_id)
);

-- ---------------------------------------------------------------------------
-- Associação contato <-> etiqueta
-- ---------------------------------------------------------------------------
-- Um contato pode ter várias etiquetas, então é tabela de ligação e não coluna.
-- `remote_jid` é o mesmo `@lid` de `zap_contatos`: o join é direto.
create table if not exists public.zap_contato_etiquetas (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  label_id text not null,
  atualizado_em timestamptz not null default now(),
  unique (instance_name, remote_jid, label_id)
);

create index if not exists idx_contato_etiq_jid
  on public.zap_contato_etiquetas (instance_name, remote_jid);
create index if not exists idx_contato_etiq_label
  on public.zap_contato_etiquetas (instance_name, label_id);

-- ---------------------------------------------------------------------------
-- RLS: mesmo papel do resto do ZapVendas, e sempre em subconsulta escalar.
-- ---------------------------------------------------------------------------
alter table public.zap_etiquetas          enable row level security;
alter table public.zap_contato_etiquetas  enable row level security;

drop policy if exists "zapvendas le etiquetas" on public.zap_etiquetas;
drop policy if exists "zapvendas le contato_etiquetas" on public.zap_contato_etiquetas;

create policy "zapvendas le etiquetas" on public.zap_etiquetas
  for select to authenticated using ((select has_role('zapvendas'::app_role)));
create policy "zapvendas le contato_etiquetas" on public.zap_contato_etiquetas
  for select to authenticated using ((select has_role('zapvendas'::app_role)));

grant select on public.zap_etiquetas         to authenticated;
grant select on public.zap_contato_etiquetas to authenticated;
grant all    on public.zap_etiquetas         to service_role;
grant all    on public.zap_contato_etiquetas to service_role;

-- ---------------------------------------------------------------------------
-- Fila de atendimento: quem escreveu e nunca foi respondido
-- ---------------------------------------------------------------------------
-- O pedido era "os números de atendimento certinho, com o contato de quem ficou
-- sem atendimento". O telefone só existe para parte dos contatos — o WhatsApp
-- migrou para `@lid`, que não carrega o número, e `key.remoteJidAlt` (onde ele
-- vem) só aparece em mensagens recentes. Por isso a fila devolve o telefone
-- QUANDO existe e, sempre, o nome e o identificador da conversa: com o `@lid` o
-- painel abre a conversa direto, que é o que resolve na prática.
create or replace function public.zap_fila_atendimento(
  p_inicio timestamptz default null,
  p_fim timestamptz default null,
  p_instance text default null
)
returns table (
  instance_name text,
  remote_jid text,
  nome text,
  telefone text,
  primeira_mensagem_at timestamptz,
  ultima_mensagem_at timestamptz,
  total_mensagens integer,
  horas_esperando numeric,
  etiquetas text[]
)
language sql
stable
security invoker
as $funcao$
  select
    c.instance_name,
    c.remote_jid,
    c.nome,
    c.telefone,
    c.primeira_mensagem_at,
    c.ultima_mensagem_at,
    c.total_mensagens,
    round(extract(epoch from (now() - c.primeira_mensagem_at)) / 3600, 1),
    coalesce(
      array_agg(e.nome order by e.nome) filter (where e.nome is not null),
      '{}'
    )
  from public.zap_contatos c
  left join public.zap_contato_etiquetas ce
    on ce.instance_name = c.instance_name and ce.remote_jid = c.remote_jid
  left join public.zap_etiquetas e
    on e.instance_name = ce.instance_name and e.label_id = ce.label_id
  where
    -- Nunca respondido pelo time: nenhuma mensagem `from_me` nesta conversa.
    not exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = c.instance_name
        and m.remote_jid = c.remote_jid
        and m.from_me
    )
    and (p_instance is null or c.instance_name = p_instance)
    and (p_inicio is null or c.primeira_mensagem_at >= p_inicio)
    and (p_fim    is null or c.primeira_mensagem_at <= p_fim)
  group by c.instance_name, c.remote_jid, c.nome, c.telefone,
           c.primeira_mensagem_at, c.ultima_mensagem_at, c.total_mensagens
  order by c.primeira_mensagem_at;
$funcao$;

-- ---------------------------------------------------------------------------
-- Base de contatos por etiqueta
-- ---------------------------------------------------------------------------
-- Responde "como está a base pelas etiquetas": quantos em cada uma, quantos
-- foram atendidos, e como a etiqueta que o consultor marcou à mão se compara
-- com a etapa que a IA inferiu.
create or replace function public.zap_base_por_etiqueta(
  p_instance text default null
)
returns table (
  label_id text,
  etiqueta text,
  cor text,
  contatos bigint,
  atendidos bigint,
  sem_atendimento bigint,
  com_telefone bigint,
  analisados bigint,
  etapa_ia_mais_comum text,
  ultima_atividade timestamptz
)
language sql
stable
security invoker
as $funcao$
  select
    e.label_id,
    e.nome,
    e.cor,
    count(distinct c.remote_jid)::bigint,
    count(distinct c.remote_jid) filter (where exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me
    ))::bigint,
    count(distinct c.remote_jid) filter (where not exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me
    ))::bigint,
    count(distinct c.remote_jid) filter (where c.telefone is not null)::bigint,
    count(distinct a.remote_jid)::bigint,
    -- A etapa que a IA mais atribuiu dentro desta etiqueta. Divergir do nome da
    -- etiqueta é sinal, não erro: 'EM NEGOCIAO' cheio de 'sem_resposta' é
    -- carteira parada que o consultor ainda considera viva.
    mode() within group (order by a.etapa_funil),
    max(c.ultima_mensagem_at)
  from public.zap_etiquetas e
  join public.zap_contato_etiquetas ce
    on ce.instance_name = e.instance_name and ce.label_id = e.label_id
  join public.zap_contatos c
    on c.instance_name = ce.instance_name and c.remote_jid = ce.remote_jid
  left join public.zap_conversa_analise a
    on a.instance_name = c.instance_name and a.remote_jid = c.remote_jid
  where (p_instance is null or e.instance_name = p_instance)
  group by e.label_id, e.nome, e.cor
  order by count(distinct c.remote_jid) desc;
$funcao$;

grant execute on function public.zap_fila_atendimento(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.zap_base_por_etiqueta(text) to authenticated;
