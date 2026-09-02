-- Escopa a fila de análise ao consultor selecionado e exclui contatos internos.
--
-- DOIS problemas, ambos observados no uso real:
--
-- 1. O botão "Começar análise com IA" fica numa tela filtrada por consultor,
--    mas analisava TODOS do período. O usuário disparou com EVERTON na tela,
--    viu o contador subir até ~800 e entendeu que eram todas dele — eram 453 do
--    Guilherme mais 350 do EVERTON. Interface que mente sobre o próprio escopo.
--
-- 2. A fila não filtrava contatos internos. Ou seja: pagou-se ao modelo para ler
--    conversa com colega de trabalho, que nunca vira venda e não entra em
--    nenhuma métrica depois.
--
-- `p_usuario_id` nulo mantém o comportamento antigo (todos), para o cron e para
-- qualquer chamada que queira o período inteiro.

drop function if exists public.zap_conversas_para_analisar(timestamptz, timestamptz, integer, integer);
drop function if exists public.zap_custo_estimado(timestamptz, timestamptz);

create or replace function public.zap_conversas_para_analisar(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_versao integer default 1,
  p_limite integer default 50,
  p_usuario_id uuid default null
)
returns table (
  instance_name text,
  remote_jid text,
  ultima_mensagem timestamptz,
  mensagens bigint
)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid
    from public.zap_contatos c
    join public.zap_instancias i
      on i.instance_name = c.instance_name and i.usuario_id is not null
    -- Interno fora da fila: analisar conversa com colega gasta dinheiro e não
    -- alimenta métrica nenhuma.
    where c.classificacao <> 'interno'
      and (p_usuario_id is null or i.usuario_id = p_usuario_id)
  )
  select
    m.instance_name, m.remote_jid,
    max(m.momento) as ultima_mensagem,
    count(*) as mensagens
  from public.zap_mensagens m
  join elegiveis e on e.instance_name = m.instance_name and e.remote_jid = m.remote_jid
  left join public.zap_conversa_analise a
    on a.instance_name = m.instance_name
   and a.remote_jid = m.remote_jid
   and a.versao_prompt = p_versao
  -- A conversa entra pelo período, mas é analisada INTEIRA: recortar as
  -- mensagens pela janela entregaria ao modelo um diálogo começando no meio.
  where exists (
    select 1 from public.zap_mensagens m2
    where m2.instance_name = m.instance_name
      and m2.remote_jid = m.remote_jid
      and m2.momento >= p_inicio and m2.momento <= p_fim
  )
  group by m.instance_name, m.remote_jid, a.analisado_ate
  -- Parênteses obrigatórios: `and` liga mais forte que `or`.
  having (a.analisado_ate is null or max(m.momento) > a.analisado_ate)
     and count(*) >= 3
  order by max(m.momento) desc
  limit p_limite;
end
$funcao$;

grant execute on function public.zap_conversas_para_analisar(timestamptz, timestamptz, integer, integer, uuid) to authenticated;

create or replace function public.zap_custo_estimado(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid default null
)
returns table (
  audios_pendentes bigint,
  minutos_pendentes numeric,
  audios_expirados bigint,
  custo_transcricao_usd numeric,
  conversas_para_analisar bigint,
  custo_analise_usd numeric
)
language plpgsql
stable
as $funcao$
#variable_conflict use_column
begin
  return query
  with elegiveis as materialized (
    select c.instance_name, c.remote_jid
    from public.zap_contatos c
    join public.zap_instancias i
      on i.instance_name = c.instance_name and i.usuario_id is not null
    where c.classificacao <> 'interno'
      and (p_usuario_id is null or i.usuario_id = p_usuario_id)
  ),
  audio as materialized (
    select
      count(*) filter (where m.transcrito_em is null) as pendentes,
      coalesce(sum(m.duracao_segundos) filter (where m.transcrito_em is null), 0) as seg_pendentes,
      count(*) filter (where m.transcricao_status = 'midia_expirada') as expirados
    from public.zap_mensagens m
    join elegiveis e on e.instance_name = m.instance_name and e.remote_jid = m.remote_jid
    where m.tipo = 'audio' and m.momento >= p_inicio and m.momento <= p_fim
  ),
  conversas as materialized (
    select count(*) as n, coalesce(sum(c.mensagens), 0) as msgs
    from public.zap_conversas_para_analisar(p_inicio, p_fim, 1, 100000, p_usuario_id) c
  )
  select
    audio.pendentes,
    round(audio.seg_pendentes / 60.0, 1),
    audio.expirados,
    -- Zero enquanto a transcrição não tem provedor configurado.
    0::numeric,
    conversas.n,
    -- Constantes medidas: 55 tokens por mensagem e ~600 de saída por veredito.
    -- Preços Claude Sonnet 5: US$ 2,00 entrada / US$ 10,00 saída por 1M.
    round((
      (conversas.msgs * 55 + conversas.n * 1000) / 1000000.0 * 2.00
      + conversas.n * 600 / 1000000.0 * 10.00
    )::numeric, 2)
  from audio, conversas;
end
$funcao$;

grant execute on function public.zap_custo_estimado(timestamptz, timestamptz, uuid) to authenticated;
