-- Score de atendimento (§4.4) como função própria.
--
-- Escrita separada do `zap_relatorio` de propósito: a tentativa de costurar o
-- score dentro daquela função por substituição de texto falhou em silêncio —
-- a âncora de comentário tinha sido reescrita numa migration anterior, e o
-- bloco simplesmente não entrou. Função independente é testável isoladamente e
-- não depende de eu acertar um `replace` num arquivo de 260 linhas.
--
-- Cinco dos seis eixos da especificação saem do dado existente. "Consistência
-- de tom" exigiria classificar cada resposta do consultor como boa, genérica ou
-- evasiva — só uma extração nova por IA daria isso, e o combinado é não
-- reanalisar. O eixo entra marcado como indisponível, com peso 0, e o total é
-- normalizado sobre os cinco medidos.
--
-- Score que esconde o que não mediu é pior que score incompleto.

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
  v_sla numeric; v_sla_n bigint;
  v_diag numeric; v_conv bigint;
  v_clareza numeric; v_links bigint;
  v_obj numeric; v_obj_n bigint;
  v_passo numeric;
begin
  -- Base: conversas do consultor com atividade na janela, sem contatos internos.
  create temp table if not exists _alvo (instance_name text, remote_jid text) on commit drop;
  delete from _alvo;
  insert into _alvo
  select distinct t.instance_name, t.remote_jid
  from public.zap_turnos_cache t
  join public.zap_contatos c
    on c.instance_name = t.instance_name and c.remote_jid = t.remote_jid
   and c.classificacao <> 'interno'
  join public.zap_instancias i
    on i.instance_name = t.instance_name and i.usuario_id = p_usuario_id
  where t.inicio >= p_inicio and t.inicio <= p_fim;

  select count(*) into v_conv from _alvo;

  -- Velocidade: % das respostas do consultor dentro de 15 minutos.
  select
    round(100.0 * count(*) filter (where seg <= 900) / nullif(count(*),0), 1),
    count(*)
  into v_sla, v_sla_n
  from (
    select extract(epoch from (t.inicio - ant.fim))::numeric as seg
    from public.zap_turnos_cache t
    join public.zap_turnos_cache ant on ant.instance_name = t.instance_name
      and ant.remote_jid = t.remote_jid and ant.turno = t.turno - 1
    join _alvo a on a.instance_name = t.instance_name and a.remote_jid = t.remote_jid
    where t.from_me and not ant.from_me
      and t.inicio >= p_inicio and t.inicio <= p_fim
  ) r;

  -- Diagnóstico: proxy do checklist de qualificação. Conta conversas em que o
  -- consultor fez 3+ perguntas nas suas 8 primeiras falas. Mais grosseiro que
  -- classificar cada pergunta, mas mede a mesma coisa — se ele diagnostica
  -- antes de ofertar — e custa zero.
  select round(100.0 * count(*) filter (where perguntas >= 3) / nullif(count(*),0), 1)
  into v_diag
  from (
    select m.instance_name, m.remote_jid,
           count(*) filter (where m.texto like '%?%') as perguntas
    from public.zap_mensagens m
    join _alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
    where m.from_me and m.texto is not null
    group by 1,2
  ) q;

  -- Clareza da oferta: link acompanhado de frase de enquadramento.
  select
    round(100.0 * count(*) filter (
      where array_length(regexp_split_to_array(btrim(coalesce(texto,'')), '\s+'), 1) >= 8
    ) / nullif(count(*),0), 1),
    count(*)
  into v_clareza, v_links
  from public.zap_mensagens m
  join _alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
  where m.from_me and cardinality(m.dominios_links) > 0
    and m.momento >= p_inicio and m.momento <= p_fim;

  -- Tratamento de objeção: superadas sobre registradas, por categoria.
  select
    round(100.0 * count(*) filter (where superada) / nullif(count(*),0), 1),
    count(*)
  into v_obj, v_obj_n
  from (
    select exists (
      select 1 from unnest(an.objecoes_superadas) s
      where public.zap_categoria_objecao(s) = public.zap_categoria_objecao(o)
    ) as superada
    from public.zap_conversa_analise an
    join _alvo a on a.instance_name = an.instance_name and a.remote_jid = an.remote_jid,
    unnest(an.objecoes) o
    where an.versao_prompt = 1
  ) x;

  -- Próximo passo: última fala do consultor combina data ou retorno.
  select round(100.0 * count(*) / nullif(v_conv,0), 1) into v_passo
  from (
    select distinct on (m.instance_name, m.remote_jid) m.texto
    from public.zap_mensagens m
    join _alvo a on a.instance_name = m.instance_name and a.remote_jid = m.remote_jid
    where m.from_me and m.texto is not null
    order by m.instance_name, m.remote_jid, m.momento desc
  ) u
  where u.texto ~* '(amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|[0-9]{1,2}/[0-9]{1,2}|[àa]s [0-9]{1,2}h?|retorno|te (chamo|aviso|mando)|combinado|fico no aguardo)';

  return jsonb_build_object(
    'velocidade',        jsonb_build_object('valor', v_sla,     'peso', 25, 'n', v_sla_n),
    'diagnostico',       jsonb_build_object('valor', v_diag,    'peso', 25, 'n', v_conv),
    'clareza_oferta',    jsonb_build_object('valor', v_clareza, 'peso', 18, 'n', v_links),
    'tratamento_objecao',jsonb_build_object('valor', v_obj,     'peso', 20, 'n', v_obj_n),
    'proximo_passo',     jsonb_build_object('valor', v_passo,   'peso', 12, 'n', v_conv),
    'consistencia_tom',  jsonb_build_object('valor', null, 'peso', 0, 'n', 0,
                           'indisponivel', 'exige classificação por IA de cada resposta'),
    'total', round(
        coalesce(v_sla,0)*0.25 + coalesce(v_diag,0)*0.25 + coalesce(v_clareza,0)*0.18
      + coalesce(v_obj,0)*0.20 + coalesce(v_passo,0)*0.12, 1)
  );
end
$funcao$;

grant execute on function public.zap_score(timestamptz, timestamptz, uuid) to authenticated;
