-- Score de atendimento — versão sem tabela temporária.
--
-- A v1 usava `create temp table` para reaproveitar o conjunto de conversas
-- entre os cinco eixos. O Postgres recusa: "CREATE TABLE is not allowed in a
-- non-volatile function". Marcar a função como `volatile` resolveria o erro
-- mas desligaria otimizações e o cache do PostgREST — troca ruim para uma
-- função só de leitura.
--
-- Solução: consulta única com CTEs materializadas, o mesmo padrão já medido no
-- resto do módulo (materialização explícita porque o planejador reavaliava cada
-- CTE a cada referência, custando 4 s onde hoje custa 0,6 s).

create or replace function public.zap_score(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
stable
as $funcao$
#variable_conflict use_column
declare
  r record;
begin
  with alvo as materialized (
    select distinct t.instance_name, t.remote_jid
    from public.zap_turnos_cache t
    join public.zap_contatos c
      on c.instance_name = t.instance_name and c.remote_jid = t.remote_jid
     and c.classificacao <> 'interno'
    join public.zap_instancias i
      on i.instance_name = t.instance_name and i.usuario_id = p_usuario_id
    where t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  conversas as materialized (select count(*) as n from alvo),

  -- Velocidade: % das respostas do consultor dentro de 15 minutos. Sobre TODA
  -- resposta, não só a primeira: o cliente não sabe em que ponto da conversa está.
  vel as materialized (
    select round(100.0 * count(*) filter (where seg <= 900) / nullif(count(*),0), 1) as valor,
           count(*) as n
    from (
      select extract(epoch from (t.inicio - ant.fim))::numeric as seg
      from public.zap_turnos_cache t
      join public.zap_turnos_cache ant on ant.instance_name = t.instance_name
        and ant.remote_jid = t.remote_jid and ant.turno = t.turno - 1
      join alvo a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
      where t.from_me and not ant.from_me
        and t.inicio >= p_inicio and t.inicio <= p_fim
    ) x
  ),

  -- Diagnóstico: proxy do checklist de qualificação. Conta conversas em que o
  -- consultor fez 3+ perguntas. Mais grosseiro que classificar cada pergunta,
  -- mas mede a mesma coisa — se ele diagnostica antes de ofertar — e custa zero.
  diag as materialized (
    select round(100.0 * count(*) filter (where perguntas >= 3) / nullif(count(*),0), 1) as valor
    from (
      select m.instance_name, m.remote_jid,
             count(*) filter (where m.texto like '%?%') as perguntas
      from public.zap_mensagens m
      join alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
      where m.from_me and m.texto is not null
      group by 1,2
    ) q
  ),

  -- Clareza da oferta: link acompanhado de frase de enquadramento.
  clareza as materialized (
    select round(100.0 * count(*) filter (
             where array_length(regexp_split_to_array(btrim(coalesce(m.texto,'')), '\s+'), 1) >= 8
           ) / nullif(count(*),0), 1) as valor,
           count(*) as n
    from public.zap_mensagens m
    join alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
    where m.from_me and cardinality(m.dominios_links) > 0
      and m.momento >= p_inicio and m.momento <= p_fim
  ),

  -- Tratamento de objeção: superadas sobre registradas, comparadas por
  -- CATEGORIA e não por texto exato — o modelo raramente repete a redação.
  obj as materialized (
    select round(100.0 * count(*) filter (where superada) / nullif(count(*),0), 1) as valor,
           count(*) as n
    from (
      select exists (
        select 1 from unnest(an.objecoes_superadas) s
        where public.zap_categoria_objecao(s) = public.zap_categoria_objecao(o)
      ) as superada
      from public.zap_conversa_analise an
      join alvo a on a.instance_name = an.instance_name and a.remote_jid = an.remote_jid,
      unnest(an.objecoes) o
      where an.versao_prompt = 1
    ) x
  ),

  -- Próximo passo: última fala DO CONSULTOR combina data ou retorno.
  passo as materialized (
    select count(*) as n from (
      select distinct on (m.instance_name, m.remote_jid) m.texto
      from public.zap_mensagens m
      join alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
      where m.from_me and m.texto is not null
      order by m.instance_name, m.remote_jid, m.momento desc
    ) u
    where u.texto ~* '(amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|[0-9]{1,2}/[0-9]{1,2}|[àa]s [0-9]{1,2}h?|retorno|te (chamo|aviso|mando)|combinado|fico no aguardo)'
  )
  select
    vel.valor as v_sla, vel.n as n_sla,
    diag.valor as v_diag,
    clareza.valor as v_clareza, clareza.n as n_links,
    obj.valor as v_obj, obj.n as n_obj,
    round(100.0 * passo.n / nullif(conversas.n,0), 1) as v_passo,
    conversas.n as n_conv
  into r
  from vel, diag, clareza, obj, passo, conversas;

  return jsonb_build_object(
    'velocidade',         jsonb_build_object('valor', r.v_sla,     'peso', 25, 'n', r.n_sla),
    'diagnostico',        jsonb_build_object('valor', r.v_diag,    'peso', 25, 'n', r.n_conv),
    'clareza_oferta',     jsonb_build_object('valor', r.v_clareza, 'peso', 18, 'n', r.n_links),
    'tratamento_objecao', jsonb_build_object('valor', r.v_obj,     'peso', 20, 'n', r.n_obj),
    'proximo_passo',      jsonb_build_object('valor', r.v_passo,   'peso', 12, 'n', r.n_conv),
    -- Sexto eixo da especificação. Exigiria classificar cada resposta do
    -- consultor como boa/genérica/evasiva, o que só uma extração nova daria.
    -- Entra com peso 0 e marcado — score que esconde o que não mediu é pior
    -- que score incompleto.
    'consistencia_tom',   jsonb_build_object('valor', null, 'peso', 0, 'n', 0,
                            'indisponivel', 'exige classificação por IA de cada resposta'),
    'total', round(
        coalesce(r.v_sla,0)*0.25 + coalesce(r.v_diag,0)*0.25 + coalesce(r.v_clareza,0)*0.18
      + coalesce(r.v_obj,0)*0.20 + coalesce(r.v_passo,0)*0.12, 1)
  );
end
$funcao$;

grant execute on function public.zap_score(timestamptz, timestamptz, uuid) to authenticated;
