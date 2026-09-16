-- Calibra a estimativa de custo com medição real.
--
-- A fórmula anterior assumia ~20 tokens por mensagem e ~600 de saída. A
-- primeira análise executada de fato (565 mensagens) gastou 31.359 tokens de
-- entrada e 746 de saída — 55,5 por mensagem. Uma estimativa que erra 3x para
-- baixo é pior que nenhuma: ela autoriza um gasto que não é o real.

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
    -- Constantes MEDIDAS, não estimadas. A primeira análise real (conversa de
    -- 565 mensagens) consumiu 31.359 tokens de entrada e 746 de saída: 55,5
    -- tokens por mensagem, quase 3x o palpite inicial de 20. Mensagem de
    -- WhatsApp carrega carimbo de data, rótulo de quem fala e quebra de linha
    -- além do texto — e é isso que a conta ignorava.
    round((
      (conversas.msgs * 55 + conversas.n * 1000) / 1000000.0 * 5.00
      + conversas.n * 750 / 1000000.0 * 25.00
    )::numeric, 2)
  from audio, conversas;
$$;

grant execute on function public.zap_custo_estimado(timestamptz, timestamptz) to authenticated;
