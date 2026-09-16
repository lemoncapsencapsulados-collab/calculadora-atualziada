-- Reprecifica a estimativa para a OpenAI.
--
-- A troca de provedor muda a matemática da transcrição, não só os números: o
-- Gemini cobrava tokens de áudio (32 por segundo) mais os tokens do texto
-- gerado; a OpenAI cobra por MINUTO de áudio, e o transcrito não é cobrado à
-- parte. A conta some da fórmula em vez de mudar de constante.
--
-- Preços (developers.openai.com/api/docs/pricing, ago/2026):
--   gpt-4o-mini-transcribe .... US$ 0,003 / minuto de áudio
--   gpt-5.6-luna .............. US$ 0,20 / 1M entrada, US$ 1,20 / 1M saída

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
    -- Cobrança por minuto, direta. Áudio sem duração informada pela Evolution
    -- fica de fora da conta e aparece como surpresa pequena na fatura — é
    -- preferível a inventar uma duração média e errar para mais.
    round((audio.seg_pendentes / 60.0 * 0.003)::numeric, 2),
    conversas.n,
    -- ~20 tokens por mensagem de entrada mais ~1000 de prompt por conversa,
    -- e ~600 tokens de saída por veredito.
    round((
      (conversas.msgs * 20 + conversas.n * 1000) / 1000000.0 * 0.20
      + conversas.n * 600 / 1000000.0 * 1.20
    )::numeric, 2)
  from audio, conversas;
$$;

grant execute on function public.zap_custo_estimado(timestamptz, timestamptz) to authenticated;
