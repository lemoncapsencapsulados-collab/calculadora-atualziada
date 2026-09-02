-- As conversas que sustentam cada afirmação do parecer.
--
-- POR QUE ISTO EXISTE: o `zap-parecer` recebia SÓ agregados — medianas,
-- percentis, contagens, categorias de objeção. Ele nunca via uma conversa.
-- Então não é que a IA esquecesse de citar a evidência: ela não tinha evidência
-- na entrada. Pedir "seja mais específico" no prompt faria a IA inventar
-- exemplos, que é pior que não ter nenhum.
--
-- Esta função escolhe, por categoria de problema, as conversas que mais o
-- exemplificam, junto do número que as coloca ali e do resumo que a camada 1 já
-- produziu. O parecer passa a poder dizer "na conversa X, que esperou 3 dias
-- pela primeira resposta" em vez de "seu tempo de resposta é alto".
--
-- CUSTO: continua lendo só o que a `zap-analisar` já gravou. Nenhuma mensagem
-- crua é relida — é o que mantém o parecer barato o bastante para ser regerado
-- à vontade.

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
  -- O número que colocou esta conversa nesta categoria. É o que amarra a
  -- citação a um fato, em vez de a uma impressão.
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
  -- Conversas do consultor no período, com o contexto que a camada 1 gravou.
  conversas as (
    select
      c.instance_name,
      c.remote_jid,
      c.nome,
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
  -- Tempo até a primeira resposta, por conversa: o primeiro turno do consultor
  -- depois de um primeiro turno do cliente.
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
    -- 1. Demorou demais para a primeira resposta.
    (select
       'demora_primeira_resposta'::text as categoria, c.*,
       'espera pela 1ª resposta'::text as metrica_rotulo,
       (round(extract(epoch from pr.espera) / 3600)::text || 'h') as metrica_valor,
       extract(epoch from pr.espera) as ordem
     from conversas c
     join primeira_resposta pr
       on pr.instance_name = c.instance_name and pr.remote_jid = c.remote_jid
     where pr.espera > interval '2 hours'
     order by pr.espera desc
     limit p_por_categoria)

    union all

    -- 2. Escreveu e nunca foi respondido. É a falha mais cara e a mais simples
    --    de corrigir, então entra sempre que existir.
    (select
       'nunca_respondido'::text, c.*,
       'esperando há'::text,
       (extract(day from (now() - c.ultima_mensagem_at))::integer::text || ' dias'),
       extract(epoch from (now() - c.ultima_mensagem_at))
     from conversas c
     where not exists (
       select 1 from public.zap_mensagens m
       where m.instance_name = c.instance_name and m.remote_jid = c.remote_jid and m.from_me
     )
     order by c.ultima_mensagem_at
     limit p_por_categoria)

    union all

    -- 3. Objeção registrada e não superada. `cardinality` em vez de contar
    --    depois: a que tem mais objeção aberta é a mais ilustrativa.
    (select
       'objecao_aberta'::text, c.*,
       'objeções não superadas'::text,
       array_to_string(
         array(select unnest(c.objecoes) except select unnest(c.objecoes_superadas)), ', '),
       cardinality(c.objecoes) - cardinality(c.objecoes_superadas)
     from conversas c
     where cardinality(c.objecoes) > cardinality(c.objecoes_superadas)
     order by cardinality(c.objecoes) - cardinality(c.objecoes_superadas) desc,
              c.ultima_mensagem_at desc
     limit p_por_categoria)

    union all

    -- 4. Cliente saiu insatisfeito.
    (select
       'sentimento_negativo'::text, c.*,
       'sentimento'::text, 'negativo'::text,
       extract(epoch from c.ultima_mensagem_at)
     from conversas c
     where c.sentimento = 'negativo'
     order by c.ultima_mensagem_at desc
     limit p_por_categoria)

    union all

    -- 5. Recebeu catálogo e a conversa morreu. É o vazamento clássico de meio
    --    de funil: houve interesse, houve envio, e ninguém retomou.
    (select
       'parou_apos_catalogo'::text, c.*,
       'parado há'::text,
       (extract(day from (now() - c.ultima_mensagem_at))::integer::text || ' dias'),
       extract(epoch from (now() - c.ultima_mensagem_at))
     from conversas c
     where c.etapa_funil = 'catalogo_enviado'
       and c.ultima_mensagem_at < now() - interval '7 days'
     order by c.ultima_mensagem_at
     limit p_por_categoria)

    union all

    -- 6. Marcado como negociação em andamento, mas parado. A etiqueta é o que o
    --    consultor ACHA; a data é o que aconteceu. A divergência é o achado.
    (select
       'etiqueta_diverge'::text, c.*,
       'marcado em negociação, parado há'::text,
       (extract(day from (now() - c.ultima_mensagem_at))::integer::text || ' dias'),
       extract(epoch from (now() - c.ultima_mensagem_at))
     from conversas c
     where c.etiquetas && array['EM NEGOCIAO', 'EM NEGOCIAÇÃO', 'reunio ', 'Acompanhar']
       and c.ultima_mensagem_at < now() - interval '10 days'
     order by c.ultima_mensagem_at
     limit p_por_categoria)
  )
  select
    categoria, instance_name, remote_jid, nome,
    metrica_rotulo, metrica_valor,
    etapa_funil, sentimento, objecoes, objecoes_superadas, etiquetas,
    resumo, ultima_mensagem_at, dias_parado
  from candidatas
  order by categoria, ordem desc;
$funcao$;

grant execute on function public.zap_conversas_exemplares(uuid, timestamptz, timestamptz, integer)
  to authenticated, service_role;
