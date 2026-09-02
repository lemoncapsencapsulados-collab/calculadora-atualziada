-- Ajusta a estimativa para Claude Sonnet 5 (US$ 2,00 entrada / US$ 10,00 saída).
--
-- ATENÇÃO — acoplamento: o modelo é definido pelo secret `ANTHROPIC_MODEL` na
-- Edge Function, e o preço vive aqui, no banco. Trocar um sem o outro faz o
-- painel prometer um valor e a fatura cobrar outro. Ao mudar o modelo, atualize
-- esta função na mesma leva:
--   claude-opus-5    5,00 / 25,00
--   claude-sonnet-5  2,00 / 10,00
--   claude-haiku-4-5 1,00 /  5,00   (e ANTHROPIC_EFFORT=none — Haiku rejeita effort)
--
-- Saída baixada de 750 para 600 tokens: medição com Sonnet na mesma conversa
-- deu 525, contra 746 do Opus. Ele é mais conciso.

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
      (conversas.msgs * 55 + conversas.n * 1000) / 1000000.0 * 2.00
      + conversas.n * 600 / 1000000.0 * 10.00
    )::numeric, 2)
  from audio, conversas;
$$;

grant execute on function public.zap_custo_estimado(timestamptz, timestamptz) to authenticated;
