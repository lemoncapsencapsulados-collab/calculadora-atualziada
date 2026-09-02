-- Escopa a análise de IA ao período selecionado no painel.
--
-- Antes, `zap_conversas_para_analisar` varria o acervo inteiro: o filtro de mês
-- da tela governava os cards mas não a IA, então apertar "analisar" gastaria
-- dinheiro com conversas fora do período que a pessoa está olhando — e o custo
-- exibido não teria relação com o que seria cobrado.
--
-- Ambas as funções passam a receber a janela. `zap_custo_estimado` idem, para
-- que o valor mostrado no botão seja exatamente o do trabalho que ele dispara.

drop function if exists public.zap_conversas_para_analisar(integer, integer);
drop function if exists public.zap_custo_estimado();

create or replace function public.zap_conversas_para_analisar(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_versao integer default 1,
  p_limite integer default 50
)
returns table (
  instance_name text,
  remote_jid text,
  ultima_mensagem timestamptz,
  mensagens bigint
)
language sql
stable
as $$
  select
    m.instance_name,
    m.remote_jid,
    max(m.momento) as ultima_mensagem,
    count(*) as mensagens
  from public.zap_mensagens m
  left join public.zap_conversa_analise a
    on a.instance_name = m.instance_name
   and a.remote_jid = m.remote_jid
   and a.versao_prompt = p_versao
  -- A conversa entra pelo período, mas é analisada INTEIRA: recortar as
  -- mensagens pela janela entregaria ao modelo um diálogo começando no meio,
  -- sem a abertura que explica como o consultor abordou.
  where exists (
    select 1 from public.zap_mensagens m2
    where m2.instance_name = m.instance_name
      and m2.remote_jid = m.remote_jid
      and m2.momento >= p_inicio and m2.momento <= p_fim
  )
  group by m.instance_name, m.remote_jid, a.analisado_ate
  -- Parênteses obrigatórios: `and` liga mais forte que `or`, e sem eles a
  -- condição vira "nunca analisada OU (mudou E tem 3+)".
  having (a.analisado_ate is null or max(m.momento) > a.analisado_ate)
  and count(*) >= 3
  order by max(m.momento) desc
  limit p_limite;
$$;

grant execute on function public.zap_conversas_para_analisar(timestamptz, timestamptz, integer, integer) to authenticated;

-- Custo do trabalho pendente DENTRO da janela — é o número que o botão mostra.
-- Preços do Gemini 2.5 Flash (tier pago, ago/2026): áudio $1,00/1M tokens de
-- entrada a 32 tokens/segundo; texto $0,30/1M; saída $2,50/1M.
create or replace function public.zap_custo_estimado(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  audios_pendentes bigint,
  minutos_pendentes numeric,
  audios_expirados bigint,
  custo_transcricao_usd numeric,
  conversas_para_analisar bigint,
  custo_analise_usd numeric
)
language sql
stable
as $$
  with audio as (
    select
      count(*) filter (where transcrito_em is null) as pendentes,
      coalesce(sum(duracao_segundos) filter (where transcrito_em is null), 0) as seg_pendentes,
      count(*) filter (where transcricao_status = 'midia_expirada') as expirados
    from public.zap_mensagens
    where tipo = 'audio' and momento >= p_inicio and momento <= p_fim
  ),
  conversas as (
    select count(*) as n, coalesce(sum(mensagens), 0) as msgs
    from public.zap_conversas_para_analisar(p_inicio, p_fim, 1, 100000)
  )
  select
    audio.pendentes,
    round(audio.seg_pendentes / 60.0, 1),
    audio.expirados,
    round((
      audio.seg_pendentes * 32 / 1000000.0 * 1.00
      + audio.seg_pendentes / 60.0 * 150 * 1.3 / 1000000.0 * 2.50
    )::numeric, 2),
    conversas.n,
    -- ~20 tokens por mensagem de entrada mais ~1000 de prompt por conversa,
    -- e ~600 tokens de saída por veredito.
    round((
      (conversas.msgs * 20 + conversas.n * 1000) / 1000000.0 * 0.30
      + conversas.n * 600 / 1000000.0 * 2.50
    )::numeric, 2)
  from audio, conversas;
$$;

grant execute on function public.zap_custo_estimado(timestamptz, timestamptz) to authenticated;
