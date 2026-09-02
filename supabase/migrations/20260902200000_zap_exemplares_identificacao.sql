-- Como o parecer identifica um contato ao citá-lo.
--
-- Levantado nos dados: a Evolution não tem o nome da maioria dos contatos.
-- Na conta do Emmanuel, apenas 34 das 918 conversas trazem um `pushName`
-- utilizável em mensagem recebida. Nas enviadas o campo existe para 777, mas o
-- valor é literalmente "Você" — o rótulo do próprio consultor, não do cliente.
-- A causa é o identificador `@lid`: são contatos que não estão na agenda do
-- aparelho e não definiram nome público.
--
-- Então o parecer precisa citar pelo melhor identificador que exista, nesta
-- ordem: nome real, telefone, e por último os dígitos finais do identificador.
-- Fingir que há nome produziria citação impossível de conferir; esconder a
-- conversa desperdiçaria a evidência.
drop function if exists public.zap_conversas_exemplares(uuid, timestamptz, timestamptz, integer);

create or replace function public.zap_identificacao_contato(
  p_nome text,
  p_telefone text,
  p_remote_jid text
)
returns text
language sql
immutable
as $$
  select case
    -- Nome puramente numérico é o identificador interno disfarçado, não nome.
    when p_nome is not null and btrim(p_nome) <> '' and p_nome !~ '^[0-9]+$'
      then btrim(p_nome)
    when p_telefone is not null and p_telefone <> ''
      then 'telefone ' || p_telefone
    else 'contato ...' || right(split_part(coalesce(p_remote_jid, ''), '@', 1), 6)
  end;
$$;

create or replace function public.zap_conversas_exemplares(
  p_usuario_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_por_categoria integer default 4
)
returns table (
  categoria text,
  instance_name text,
  remote_jid text,
  nome text,
  identificacao text,
  tem_nome_real boolean,
  metrica_rotulo text,
  metrica_valor text,
  etapa_funil text,
  sentimento text,
  objecoes text[],
  objecoes_superadas text[],
  etiquetas text[],
  resumo text,
  ultima_mensagem_at timestamptz,
  dias_parado integer
)
language sql
stable
security invoker
as $funcao$
  with instancias as (
    select i.instance_name
    from public.zap_instancias i
    where i.usuario_id = p_usuario_id and i.ativo
  ),
  conversas as (
    select
      c.instance_name,
      c.remote_jid,
      c.nome,
      public.zap_identificacao_contato(c.nome, c.telefone, c.remote_jid) as identificacao,
      (c.nome is not null and c.nome !~ '^[0-9]+$') as tem_nome_real,
      c.ultima_mensagem_at,
      a.etapa_funil,
      a.sentimento,
      coalesce(a.objecoes, '{}') as objecoes,
      coalesce(a.objecoes_superadas, '{}') as objecoes_superadas,
      a.resumo,
      extract(day from (now() - c.ultima_mensagem_at))::integer as dias_parado,
      coalesce((
        select array_agg(e.nome order by e.nome)
        from public.zap_contato_etiquetas ce
        join public.zap_etiquetas e
          on e.instance_name = ce.instance_name and e.label_id = ce.label_id
        where ce.instance_name = c.instance_name and ce.remote_jid = c.remote_jid
      ), '{}') as etiquetas
    from public.zap_contatos c
    join instancias i on i.instance_name = c.instance_name
    left join public.zap_conversa_analise a
      on a.instance_name = c.instance_name and a.remote_jid = c.remote_jid
    where c.ultima_mensagem_at between p_inicio and p_fim
  ),
  primeira_resposta as (
    select
      t.instance_name,
      t.remote_jid,
      min(t.inicio) filter (where t.from_me and t.turno > 1) -
      min(t.inicio) filter (where not t.from_me and t.turno = 1) as espera
    from public.zap_turnos_cache t
    join instancias i on i.instance_name = t.instance_name
    group by t.instance_name, t.remote_jid
  ),
  candidatas as (
    (select 'demora_primeira_resposta'::text as categoria, c.*,
       'espera pela 1a resposta'::text as metrica_rotulo,
       (round(extract(epoch from pr.espera) / 3600)::text || 'h') as metrica_valor,
       extract(epoch from pr.espera) as ordem
     from conversas c
     join primeira_resposta pr
       on pr.instance_name = c.instance_name and pr.remote_jid = c.remote_jid
     where pr.espera > interval '2 hours'
     order by pr.espera desc limit p_por_categoria)
    union all
    (select 'nunca_respondido'::text, c.*, 'esperando ha'::text,
       (extract(day from (now() - c.ultima_mensagem_at))::integer::text || ' dias'),
       extract(epoch from (now() - c.ultima_mensagem_at))
     from conversas c
     where not exists (
       select 1 from public.zap_mensagens m
       where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me)
     order by c.ultima_mensagem_at limit p_por_categoria)
    union all
    (select 'objecao_aberta'::text, c.*, 'objecoes nao superadas'::text,
       array_to_string(array(
         select unnest(c.objecoes) except select unnest(c.objecoes_superadas)), ', '),
       cardinality(c.objecoes) - cardinality(c.objecoes_superadas)
     from conversas c
     where cardinality(c.objecoes) > cardinality(c.objecoes_superadas)
     order by cardinality(c.objecoes) - cardinality(c.objecoes_superadas) desc,
              c.ultima_mensagem_at desc limit p_por_categoria)
    union all
    (select 'sentimento_negativo'::text, c.*, 'sentimento'::text, 'negativo'::text,
       extract(epoch from c.ultima_mensagem_at)
     from conversas c where c.sentimento = 'negativo'
     order by c.ultima_mensagem_at desc limit p_por_categoria)
    union all
    (select 'parou_apos_catalogo'::text, c.*, 'parado ha'::text,
       (extract(day from (now() - c.ultima_mensagem_at))::integer::text || ' dias'),
       extract(epoch from (now() - c.ultima_mensagem_at))
     from conversas c
     where c.etapa_funil = 'catalogo_enviado'
       and c.ultima_mensagem_at < now() - interval '7 days'
     order by c.ultima_mensagem_at limit p_por_categoria)
    union all
    (select 'etiqueta_diverge'::text, c.*, 'marcado em negociacao, parado ha'::text,
       (extract(day from (now() - c.ultima_mensagem_at))::integer::text || ' dias'),
       extract(epoch from (now() - c.ultima_mensagem_at))
     from conversas c
     where c.etiquetas && array['EM NEGOCIAO', 'EM NEGOCIAÇÃO', 'reunio ', 'Acompanhar']
       and c.ultima_mensagem_at < now() - interval '10 days'
     order by c.ultima_mensagem_at limit p_por_categoria)
  )
  select categoria, instance_name, remote_jid, nome, identificacao, tem_nome_real,
         metrica_rotulo, metrica_valor, etapa_funil, sentimento,
         objecoes, objecoes_superadas, etiquetas, resumo, ultima_mensagem_at, dias_parado
  from candidatas
  order by categoria, ordem desc;
$funcao$;

grant execute on function public.zap_identificacao_contato(text, text, text) to authenticated, service_role;
grant execute on function public.zap_conversas_exemplares(uuid, timestamptz, timestamptz, integer)
  to authenticated, service_role;
