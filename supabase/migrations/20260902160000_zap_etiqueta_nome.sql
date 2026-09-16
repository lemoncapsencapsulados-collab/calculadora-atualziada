-- Nome do contato na própria associação de etiqueta.
--
-- Descoberto ao cruzar os dados: das 631 associações vindas da Evolution, só
-- 121 casam com alguém em `zap_contatos`. Não é falha de ingestão — na conta do
-- Emmanuel, 1.532 chats `@lid` existem mas apenas 877 têm mensagem na própria
-- Evolution, e nós temos 879. Os demais são conversas que o WhatsApp lista e
-- cujo conteúdo a Evolution nunca sincronizou.
--
-- Esses contatos precisam aparecer na análise por etiqueta — o pedido era
-- entender a base pelas etiquetas, e metade dela está aí. Mas NÃO podem entrar
-- em `zap_contatos`: aquela tabela é a base de quem tem conversa, e somar
-- contato sem nenhuma mensagem mudaria toda métrica de atendimento já apurada.
--
-- Então o nome vem junto da associação. Denormalizado de propósito.
alter table public.zap_contato_etiquetas
  add column if not exists nome text;

comment on column public.zap_contato_etiquetas.nome is
  'Nome vindo de Chat.name da Evolution. Existe porque parte dos contatos etiquetados não tem conversa em zap_contatos.';

-- `create or replace` não muda tipo de retorno: as colunas novas exigem drop.
drop function if exists public.zap_base_por_etiqueta(text);

-- Base por etiqueta, agora contando TODA a carteira etiquetada e separando o
-- que tem conversa do que não tem. A distinção importa: uma etiqueta cheia de
-- contatos sem conversa é carteira que o consultor marcou e nunca trabalhou.
create or replace function public.zap_base_por_etiqueta(
  p_instance text default null
)
returns table (
  label_id text,
  etiqueta text,
  cor text,
  contatos bigint,
  com_conversa bigint,
  sem_conversa bigint,
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
    count(*)::bigint,
    count(c.remote_jid)::bigint,
    count(*) filter (where c.remote_jid is null)::bigint,
    count(*) filter (where c.remote_jid is not null and exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me
    ))::bigint,
    count(*) filter (where c.remote_jid is not null and not exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me
    ))::bigint,
    count(*) filter (where c.telefone is not null)::bigint,
    count(a.remote_jid)::bigint,
    -- Onde a etiqueta do consultor e a etapa da IA discordam costuma estar o
    -- lead se perdendo: 'EM NEGOCIAÇÃO' cheio de 'sem_resposta' é carteira
    -- parada que alguém ainda considera viva.
    mode() within group (order by a.etapa_funil),
    max(c.ultima_mensagem_at)
  from public.zap_etiquetas e
  join public.zap_contato_etiquetas ce
    on ce.instance_name = e.instance_name and ce.label_id = e.label_id
  left join public.zap_contatos c
    on c.instance_name = ce.instance_name and c.remote_jid = ce.remote_jid
  left join public.zap_conversa_analise a
    on a.instance_name = ce.instance_name and a.remote_jid = ce.remote_jid
  where (p_instance is null or e.instance_name = p_instance)
  group by e.label_id, e.nome, e.cor
  order by count(*) desc;
$funcao$;

-- Contatos de uma etiqueta, para o filtro do ZapVendas.
create or replace function public.zap_contatos_por_etiqueta(
  p_label_id text,
  p_instance text default null
)
returns table (
  instance_name text,
  remote_jid text,
  nome text,
  telefone text,
  tem_conversa boolean,
  atendido boolean,
  total_mensagens integer,
  ultima_mensagem_at timestamptz,
  etapa_ia text,
  sentimento text
)
language sql
stable
security invoker
as $funcao$
  select
    ce.instance_name,
    ce.remote_jid,
    coalesce(c.nome, ce.nome),
    c.telefone,
    c.remote_jid is not null,
    coalesce(exists (
      select 1 from public.zap_mensagens m
      where m.instance_name = ce.instance_name and m.remote_jid = ce.remote_jid and m.from_me
    ), false),
    coalesce(c.total_mensagens, 0),
    c.ultima_mensagem_at,
    a.etapa_funil,
    a.sentimento
  from public.zap_contato_etiquetas ce
  left join public.zap_contatos c
    on c.instance_name = ce.instance_name and c.remote_jid = ce.remote_jid
  left join public.zap_conversa_analise a
    on a.instance_name = ce.instance_name and a.remote_jid = ce.remote_jid
  where ce.label_id = p_label_id
    and (p_instance is null or ce.instance_name = p_instance)
  order by c.ultima_mensagem_at desc nulls last;
$funcao$;

grant execute on function public.zap_base_por_etiqueta(text) to authenticated;
grant execute on function public.zap_contatos_por_etiqueta(text, text) to authenticated;
