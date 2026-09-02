-- Score de atendimento (§4.4) dentro do objeto único de métricas.
--
-- Cinco dos seis eixos saem do dado existente. "Consistência de tom" exigiria
-- classificar cada resposta do consultor como boa/genérica/evasiva — só uma
-- extração nova por IA daria isso, e o combinado é não reanalisar. O eixo entra
-- no objeto marcado como indisponível, com peso 0, e o total é normalizado
-- sobre os cinco medidos.
--
-- Score que esconde o que não mediu é pior que score incompleto: quem lê
-- precisa saber que 100 aqui significa "ótimo nos cinco eixos medidos".

create or replace function public.zap_relatorio(
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
  v jsonb;
begin
  with
  -- Contatos elegíveis: exclui interno marcado à mão ou pela heurística.
  elegiveis as materialized (
    select c.instance_name, c.remote_jid
    from public.zap_contatos c
    join public.zap_instancias i
      on i.instance_name = c.instance_name and i.usuario_id = p_usuario_id
    where c.classificacao <> 'interno'
  ),
  turnos as materialized (
    select t.*
    from public.zap_turnos_cache t
    join elegiveis e on e.instance_name = t.instance_name and e.remote_jid = t.remote_jid
  ),
  -- Conversas com atividade na janela.
  ativas as materialized (
    select distinct t.instance_name, t.remote_jid
    from turnos t where t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  -- Análise da IA já gravada, com perfil derivado por regra.
  analise as materialized (
    select a.instance_name, a.remote_jid, a.sentimento, a.etapa_funil, a.resumo,
           a.objecoes, a.objecoes_superadas,
           public.zap_perfil_contato(a.resumo, a.etapa_funil) as perfil
    from public.zap_conversa_analise a
    join ativas v on v.instance_name = a.instance_name and v.remote_jid = a.remote_jid
    where a.versao_prompt = 1
  ),
  -- ---- Velocidade -------------------------------------------------------
  respostas as materialized (
    select
      t.from_me as do_consultor,
      ant.turno = 1 as e_primeira,
      extract(epoch from (t.inicio - ant.fim))::numeric as seg,
      extract(epoch from (t.inicio - ant.inicio))::numeric as seg_desde_inicio
    from turnos t
    join turnos ant on ant.instance_name = t.instance_name
      and ant.remote_jid = t.remote_jid and ant.turno = t.turno - 1
    where ant.from_me is distinct from t.from_me
      and t.inicio >= p_inicio and t.inicio <= p_fim
  ),
  velocidade as materialized (
    select
      count(*) filter (where do_consultor and e_primeira) as n_primeira,
      percentile_cont(0.5) within group (order by case when do_consultor and e_primeira then seg_desde_inicio end) as tmr1_p50,
      percentile_cont(0.9) within group (order by case when do_consultor and e_primeira then seg_desde_inicio end) as tmr1_p90,
      max(case when do_consultor and e_primeira then seg_desde_inicio end) as tmr1_pior,
      count(*) filter (where do_consultor and not e_primeira) as n_fluxo,
      percentile_cont(0.5) within group (order by case when do_consultor and not e_primeira then seg end) as fluxo_p50,
      percentile_cont(0.9) within group (order by case when do_consultor and not e_primeira then seg end) as fluxo_p90,
      count(*) filter (where not do_consultor) as n_cliente,
      percentile_cont(0.5) within group (order by case when not do_consultor then seg end) as cliente_p50,
      -- SLA de 15 minutos sobre TODA resposta do consultor, não só a primeira:
      -- o cliente não sabe se está na primeira ou na décima mensagem.
      count(*) filter (where do_consultor and seg <= 900) as dentro_sla,
      count(*) filter (where do_consultor) as total_consultor
    from respostas
  ),
  -- Fila parada: última mensagem é do CLIENTE e ninguém respondeu.
  fila as materialized (
    select t.instance_name, t.remote_jid, max(t.fim) as parado_desde
    from turnos t
    join ativas v on v.instance_name = t.instance_name and v.remote_jid = t.remote_jid
    group by t.instance_name, t.remote_jid
    having bool_and(true)
       and (array_agg(t.from_me order by t.turno desc))[1] = false
       and max(t.fim) < p_fim - interval '2 hours'
  ),
  -- ---- Comportamento do consultor, direto das mensagens -----------------
  msgs as materialized (
    select m.*, row_number() over (
             partition by m.instance_name, m.remote_jid, m.from_me order by m.momento
           ) as ordem_do_lado
    from public.zap_mensagens m
    join ativas v on v.instance_name = m.instance_name and v.remote_jid = m.remote_jid
  ),
  comportamento as materialized (
    select
      -- Preço nas três primeiras falas do consultor, antes de qualificar. É o
      -- indicador crítico do funil B2B: quem manda tabela cedo atrai
      -- especulador e perde a conversa de diagnóstico.
      -- Cinco primeiras falas, não três: a tabela costuma vir logo depois da
      -- apresentação. Medido só sobre TEXTO — se o consultor fala preço por
      -- áudio, isto não enxerga, e o painel avisa enquanto houver áudio sem
      -- transcrição.
      count(distinct (instance_name, remote_jid)) filter (
        where from_me and ordem_do_lado <= 5
          and texto ~* '(r *\$ *[0-9]|[0-9]+ *reais|valor unit|pre[çc]o|tabela de pre|custa)'
      ) as com_preco_cedo,
      -- Link solto: mensagem com URL e quase nenhuma palavra em volta.
      count(*) filter (
        where from_me and cardinality(dominios_links) > 0
          and array_length(regexp_split_to_array(btrim(coalesce(texto,'')), '\s+'), 1) < 8
      ) as links_sem_contexto,
      count(*) filter (where from_me and cardinality(dominios_links) > 0) as links_total
    from msgs
  ),
  -- Diagnóstico: conversas em que o consultor fez 3+ perguntas antes de falar
  -- preço. É proxy do checklist de qualificação da especificação, que exigiria
  -- extração nova por IA; aqui sai de contar '?' nas mensagens dele. Mais
  -- grosseiro, custo zero, e mede a mesma coisa: se ele diagnostica antes de
  -- ofertar.
  diagnostico as materialized (
    select count(*) as n from (
      select instance_name, remote_jid,
             count(*) filter (where texto like '%?%') as perguntas
      from msgs
      where from_me and texto is not null and ordem_do_lado <= 8
      group by instance_name, remote_jid
    ) q where q.perguntas >= 3
  ),
  -- Próximo passo combinado: data, dia da semana ou promessa de retorno na
  -- última fala do consultor.
  -- Última mensagem DO CONSULTOR, não a última da conversa. A regra anterior
  -- olhava a última mensagem absoluta e achou 5 casos em 357: em 68 conversas
  -- quem fala por último é o cliente, e o combinado feito antes disso ficava
  -- invisível.
  proximo_passo as materialized (
    select count(*) as n from (
      select distinct on (instance_name, remote_jid) instance_name, remote_jid, texto
      from msgs where from_me and texto is not null
      order by instance_name, remote_jid, momento desc
    ) u
    where u.texto ~* '(amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|[0-9]{1,2}/[0-9]{1,2}|[àa]s [0-9]{1,2}h?|retorno|te (chamo|aviso|mando)|combinado|fico no aguardo|qualquer d[úu]vida me chama)'
  ),
  -- Respostas que o consultor repete entre conversas diferentes. Normalizadas
  -- em minúsculas e sem pontuação; só conta se aparecer em 2+ contatos.
  -- Respostas de script que o consultor repete entre conversas.
  --
  -- A v1 devolvia URLs com a pontuação removida ("httpscatalogolemoncapscombr"),
  -- ilegíveis e sem valor: link repetido é distribuição de catálogo, não roteiro
  -- de atendimento. Agora mensagens que são essencialmente um link ficam de fora
  -- e o texto preserva a pontuação.
  repetidas as materialized (
    select lower(regexp_replace(btrim(texto), '\s+', ' ', 'g')) as trecho,
           count(*) as ocorrencias,
           count(distinct (instance_name, remote_jid)) as contatos
    from msgs
    where from_me and texto is not null
      and cardinality(dominios_links) = 0
      and length(btrim(texto)) between 25 and 220
    group by 1
    having count(distinct (instance_name, remote_jid)) >= 2
    order by count(*) desc limit 10
  ),
  -- ---- Funil etapa a etapa ---------------------------------------------
  por_conversa as materialized (
    select
      t.instance_name, t.remote_jid,
      bool_or(t.from_me) as consultor_falou,
      bool_or(not t.from_me) as cliente_falou,
      max(t.turno) as turnos
    from turnos t
    join ativas v on v.instance_name = t.instance_name and v.remote_jid = t.remote_jid
    group by t.instance_name, t.remote_jid
  ),
  com_link as materialized (
    select count(distinct (m.instance_name, m.remote_jid)) as n
    from msgs m where m.from_me and cardinality(m.dominios_links) > 0
  ),
  etapas as materialized (
    select
      count(*) filter (where etapa_funil in ('meeting_agendada','proposta','fechado')) as reuniao,
      count(*) filter (where etapa_funil in ('proposta','fechado')) as proposta,
      count(*) filter (where etapa_funil = 'fechado') as fechado,
      count(*) filter (where etapa_funil = 'perdido') as perdido
    from analise
  ),
  -- Funil limpo: sem fornecedor, interno, fora de perfil e revendedor.
  limpo as materialized (
    select
      count(*) as contatos,
      count(*) filter (where etapa_funil in ('meeting_agendada','proposta','fechado')) as reuniao,
      count(*) filter (where etapa_funil in ('proposta','fechado')) as proposta,
      count(*) filter (where etapa_funil = 'fechado') as fechado
    from analise
    where perfil not in ('fornecedor_ou_interno','fora_de_perfil','revendedor_pronto')
  ),
  carteira as materialized (
    select perfil, count(*) as n from analise group by perfil
  ),
  objecoes as materialized (
    select public.zap_categoria_objecao(o) as categoria,
           count(*) as total,
           count(*) filter (where exists (
             select 1 from unnest(a.objecoes_superadas) s
             where public.zap_categoria_objecao(s) = public.zap_categoria_objecao(o))) as superadas,
           count(distinct (a.instance_name, a.remote_jid)) as conversas
    from analise a, unnest(a.objecoes) o
    group by 1 order by count(*) desc
  ),
  sentimentos as materialized (
    select sentimento, count(*) as n from analise group by sentimento
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'base', jsonb_build_object(
      'contatos', (select count(*) from por_conversa),
      'analisadas', (select count(*) from analise),
      'cobertura_analise_pct', round(100.0 * (select count(*) from analise)
                                     / nullif((select count(*) from por_conversa),0), 1)
    ),
    'velocidade', (select jsonb_build_object(
        'tmr1_p50_seg', round(tmr1_p50::numeric,1), 'tmr1_p90_seg', round(tmr1_p90::numeric,1),
        'tmr1_pior_seg', round(tmr1_pior::numeric,1), 'tmr1_n', n_primeira,
        'fluxo_p50_seg', round(fluxo_p50::numeric,1), 'fluxo_p90_seg', round(fluxo_p90::numeric,1),
        'fluxo_n', n_fluxo,
        'cliente_p50_seg', round(cliente_p50::numeric,1), 'cliente_n', n_cliente,
        'sla_15min_pct', round(100.0 * dentro_sla / nullif(total_consultor,0), 1),
        'sla_n', total_consultor
      ) from velocidade),
    'fila_parada', jsonb_build_object(
      'n', (select count(*) from fila),
      'top', (select coalesce(jsonb_agg(jsonb_build_object(
                'contato', remote_jid, 'parado_desde', parado_desde,
                'horas', round(extract(epoch from (p_fim - parado_desde))/3600.0, 1))
                order by parado_desde), '[]'::jsonb)
              from (select * from fila order by parado_desde limit 10) f)
    ),
    'funil', jsonb_build_object(
      'contatos', (select count(*) from por_conversa),
      'consultor_falou', (select count(*) filter (where consultor_falou) from por_conversa),
      'cliente_respondeu', (select count(*) filter (where cliente_falou and consultor_falou) from por_conversa),
      'recebeu_link', (select n from com_link),
      'reuniao', (select reuniao from etapas),
      'proposta', (select proposta from etapas),
      'fechado', (select fechado from etapas),
      'perdido', (select perdido from etapas)
    ),
    'funil_limpo', (select jsonb_build_object(
        'contatos', contatos, 'reuniao', reuniao, 'proposta', proposta, 'fechado', fechado)
      from limpo),
    'carteira', (select coalesce(jsonb_object_agg(perfil, n), '{}'::jsonb) from carteira),
    'comportamento', (select jsonb_build_object(
        'preco_antes_de_qualificar', com_preco_cedo,
        'links_sem_contexto', links_sem_contexto,
        'links_total', links_total,
        'proximo_passo_definido', (select n from proximo_passo)
      ) from comportamento),
    'score', (
      -- Cinco eixos dos seis da especificação. "Consistência de tom" exigiria
      -- classificar cada resposta como boa/genérica/evasiva, o que só uma
      -- extração nova daria — fica de fora e o score é normalizado sobre os
      -- cinco medidos, com o peso declarado no próprio objeto.
      select jsonb_build_object(
        'velocidade', jsonb_build_object('valor', round(coalesce(v.sla_15min_pct,0),1), 'peso', 25, 'n', v.sla_n),
        'diagnostico', jsonb_build_object(
          'valor', round(100.0 * dg.n / nullif(pc.n,0), 1), 'peso', 25, 'n', pc.n),
        'clareza_oferta', jsonb_build_object(
          'valor', round(100.0 * (cp.links_total - cp.links_sem_contexto) / nullif(cp.links_total,0), 1),
          'peso', 18, 'n', cp.links_total),
        'tratamento_objecao', jsonb_build_object(
          'valor', round(100.0 * ob.superadas / nullif(ob.total,0), 1), 'peso', 20, 'n', ob.total),
        'proximo_passo', jsonb_build_object(
          'valor', round(100.0 * pp.n / nullif(pc.n,0), 1), 'peso', 12, 'n', pc.n),
        'consistencia_tom', jsonb_build_object('valor', null, 'peso', 0, 'n', 0,
          'indisponivel', 'exige classificação por IA de cada resposta'),
        'total', round(
            coalesce(v.sla_15min_pct,0) * 0.25
          + coalesce(100.0 * dg.n / nullif(pc.n,0), 0) * 0.25
          + coalesce(100.0 * (cp.links_total - cp.links_sem_contexto) / nullif(cp.links_total,0), 0) * 0.18
          + coalesce(100.0 * ob.superadas / nullif(ob.total,0), 0) * 0.20
          + coalesce(100.0 * pp.n / nullif(pc.n,0), 0) * 0.12, 1)
      )
      from (select sla_15min_pct, total_consultor as sla_n from velocidade) v,
           diagnostico dg,
           (select count(*) as n from por_conversa) pc,
           comportamento cp,
           proximo_passo pp,
           (select coalesce(sum(total),0) as total, coalesce(sum(superadas),0) as superadas from objecoes) ob
    ),
    'respostas_repetidas', (select coalesce(jsonb_agg(jsonb_build_object(
        'trecho', left(trecho, 120), 'ocorrencias', ocorrencias, 'contatos', contatos)), '[]'::jsonb)
      from repetidas),
    'objecoes', (select coalesce(jsonb_agg(jsonb_build_object(
        'categoria', categoria, 'total', total, 'superadas', superadas, 'conversas', conversas)), '[]'::jsonb)
      from objecoes),
    'sentimento', (select coalesce(jsonb_object_agg(sentimento, n), '{}'::jsonb) from sentimentos)
  ) into v;

  return v;
end
$funcao$;

grant execute on function public.zap_relatorio(timestamptz, timestamptz, uuid) to authenticated;
