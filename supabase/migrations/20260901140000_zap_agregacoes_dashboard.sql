-- Agregações para os gráficos do painel individual.
--
-- Quatro funções, todas em plpgsql com CTEs materializadas pelo mesmo motivo já
-- medido: `language sql` é inlined pelo PostgREST e degrada o plano.
--
-- Todas respeitam `classificacao <> 'interno'` e aceitam `p_usuario_id` nulo
-- para dar o número do time inteiro — é o que permite comparar o consultor com
-- a média dos colegas sem uma segunda consulta.

-- ---------------------------------------------------------------------------
-- 1. Distribuição das respostas do consultor por faixa de tempo
-- ---------------------------------------------------------------------------
-- Faixas fixas em vez de histograma automático: elas correspondem a como a área
-- comercial pensa ("respondeu na hora", "respondeu no dia", "abandonou"), e
-- faixas estáveis permitem comparar consultores e períodos.
create or replace function public.zap_distribuicao_resposta(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid default null
)
returns table (faixa text, ordem integer, respostas bigint, pct numeric)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid from public.zap_contatos c
    where c.classificacao <> 'interno'
  ),
  turnos as materialized (
    select t.* from public.zap_turnos_cache t
    join elegiveis e on e.instance_name = t.instance_name and e.remote_jid = t.remote_jid
    join public.zap_instancias i on i.instance_name = t.instance_name and i.usuario_id is not null
    where p_usuario_id is null or i.usuario_id = p_usuario_id
  ),
  respostas as materialized (
    select extract(epoch from (t.inicio - ant.fim))::numeric as seg
    from turnos t
    join turnos ant on ant.instance_name = t.instance_name
      and ant.remote_jid = t.remote_jid and ant.turno = t.turno - 1
    where t.from_me and not ant.from_me
      and t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  classificado as materialized (
    select case
      when seg < 60 then 'Até 1 min'
      when seg < 300 then '1 a 5 min'
      when seg < 1800 then '5 a 30 min'
      when seg < 7200 then '30 min a 2h'
      when seg < 43200 then '2h a 12h'
      else 'Mais de 12h' end as faixa,
      case
        when seg < 60 then 1 when seg < 300 then 2 when seg < 1800 then 3
        when seg < 7200 then 4 when seg < 43200 then 5 else 6 end as ordem
    from respostas
  )
  select c.faixa, c.ordem, count(*),
         round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1)
  from classificado c group by c.faixa, c.ordem order by c.ordem;
end
$funcao$;

grant execute on function public.zap_distribuicao_resposta(timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Heatmap hora do dia x dia da semana
-- ---------------------------------------------------------------------------
-- Em America/Sao_Paulo, não UTC: um mapa de calor em UTC mostraria o expediente
-- deslocado em três horas e sugeriria que o time trabalha de madrugada.
create or replace function public.zap_heatmap(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid default null
)
returns table (dia_semana integer, hora integer, mensagens bigint)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid from public.zap_contatos c
    where c.classificacao <> 'interno'
  )
  select
    extract(dow from m.momento at time zone 'America/Sao_Paulo')::integer,
    extract(hour from m.momento at time zone 'America/Sao_Paulo')::integer,
    count(*)
  from public.zap_mensagens m
  join elegiveis e on e.instance_name = m.instance_name and e.remote_jid = m.remote_jid
  join public.zap_instancias i on i.instance_name = m.instance_name and i.usuario_id is not null
  where m.momento >= p_inicio and m.momento <= p_fim
    and (p_usuario_id is null or i.usuario_id = p_usuario_id)
  group by 1, 2;
end
$funcao$;

grant execute on function public.zap_heatmap(timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ranking de objeções, já normalizadas por categoria
-- ---------------------------------------------------------------------------
-- Usa `zap_categoria_objecao` para colapsar as 155 variações de texto livre em
-- categorias. Sem isso o ranking é uma lista de itens com frequência 1.
--
-- `superadas` conta quando a mesma categoria aparece em `objecoes_superadas` da
-- mesma conversa — comparação por CATEGORIA, não por texto exato, porque o
-- modelo raramente repete a redação entre os dois campos.
create or replace function public.zap_objecoes_ranking(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid default null
)
returns table (categoria text, total bigint, superadas bigint, conversas bigint)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid from public.zap_contatos c
    where c.classificacao <> 'interno'
  ),
  base as materialized (
    select an.instance_name, an.remote_jid, an.objecoes, an.objecoes_superadas
    from public.zap_conversa_analise an
    join elegiveis e on e.instance_name = an.instance_name and e.remote_jid = an.remote_jid
    join public.zap_instancias i on i.instance_name = an.instance_name and i.usuario_id is not null
    join public.zap_turnos_cache t on t.instance_name = an.instance_name
      and t.remote_jid = an.remote_jid and t.turno = 1
    where an.versao_prompt = 1
      and t.inicio >= p_inicio and t.inicio <= p_fim
      and (p_usuario_id is null or i.usuario_id = p_usuario_id)
  ),
  expandido as materialized (
    select b.instance_name, b.remote_jid,
      public.zap_categoria_objecao(o) as categoria,
      exists (
        select 1 from unnest(b.objecoes_superadas) s
        where public.zap_categoria_objecao(s) = public.zap_categoria_objecao(o)
      ) as foi_superada
    from base b, unnest(b.objecoes) o
  )
  select x.categoria, count(*), count(*) filter (where x.foi_superada),
         count(distinct (x.instance_name, x.remote_jid))
  from expandido x group by x.categoria order by count(*) desc;
end
$funcao$;

grant execute on function public.zap_objecoes_ranking(timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Série temporal diária
-- ---------------------------------------------------------------------------
-- Mostra a evolução dentro do período escolhido. Sem ela, um mês inteiro vira
-- um único número e some a informação de quando o problema aconteceu.
create or replace function public.zap_serie_diaria(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid default null
)
returns table (dia date, contatos bigint, mensagens bigint, tmr1_mediana_seg numeric)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid from public.zap_contatos c
    where c.classificacao <> 'interno'
  ),
  turnos as materialized (
    select t.* from public.zap_turnos_cache t
    join elegiveis e on e.instance_name = t.instance_name and e.remote_jid = t.remote_jid
    join public.zap_instancias i on i.instance_name = t.instance_name and i.usuario_id is not null
    where (p_usuario_id is null or i.usuario_id = p_usuario_id)
      and t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  primeiras as materialized (
    select (t.inicio at time zone 'America/Sao_Paulo')::date as dia,
           extract(epoch from (t.inicio - ant.inicio))::numeric as seg
    from turnos t
    join public.zap_turnos_cache ant on ant.instance_name = t.instance_name
      and ant.remote_jid = t.remote_jid and ant.turno = t.turno - 1
    where t.from_me and not ant.from_me and ant.turno = 1
  ),
  atividade as materialized (
    select (t.inicio at time zone 'America/Sao_Paulo')::date as dia,
           count(distinct (t.instance_name, t.remote_jid)) as contatos,
           sum(t.mensagens) as mensagens
    from turnos t group by 1
  )
  select a.dia, a.contatos, a.mensagens,
         (select percentile_cont(0.5) within group (order by p.seg)
            from primeiras p where p.dia = a.dia)::numeric
  from atividade a order by a.dia;
end
$funcao$;

grant execute on function public.zap_serie_diaria(timestamptz, timestamptz, uuid) to authenticated;
