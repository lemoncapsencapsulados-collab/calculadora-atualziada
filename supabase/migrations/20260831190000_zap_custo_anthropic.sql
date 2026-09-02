-- Reprecifica a estimativa para a Anthropic (análise) e sinaliza a transcrição
-- como desligada.
--
-- Preços Claude Opus 5: US$ 5,00 / 1M entrada, US$ 25,00 / 1M saída. É uma
-- ordem de grandeza acima dos provedores anteriores — a estimativa precisa
-- refletir isso, senão o botão promete um valor e a fatura entrega outro.
--
-- A transcrição continua na fórmula, mas devolve 0 enquanto não houver
-- provedor de áudio: a Anthropic não aceita áudio, e `zap-transcrever` está
-- dormente. Zerar em vez de omitir mantém a coluna estável para o front.

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
    -- Zero enquanto a transcrição não tem provedor. Os áudios seguem contados
    -- acima para o painel poder dizer quanto da conversa está fora da leitura.
    0::numeric,
    conversas.n,
    -- ~20 tokens por mensagem mais ~1000 de prompt por conversa na entrada;
    -- ~600 tokens de veredito na saída.
    round((
      (conversas.msgs * 20 + conversas.n * 1000) / 1000000.0 * 5.00
      + conversas.n * 600 / 1000000.0 * 25.00
    )::numeric, 2)
  from audio, conversas;
$$;

grant execute on function public.zap_custo_estimado(timestamptz, timestamptz) to authenticated;
