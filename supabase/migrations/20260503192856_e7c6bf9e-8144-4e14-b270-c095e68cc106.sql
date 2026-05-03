ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS historico_contatos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: para orçamentos com data_envio existente, criar item de envio
UPDATE public.orcamentos
SET historico_contatos = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'data', to_char(data_envio, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'tipo', 'envio',
    'observacao', ''
  )
)
WHERE data_envio IS NOT NULL
  AND (historico_contatos IS NULL OR historico_contatos = '[]'::jsonb);

-- Backfill: anexar observacoes_internas como contato
UPDATE public.orcamentos
SET historico_contatos = historico_contatos || jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'data', to_char(COALESCE(updated_at, now()), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
    'tipo', 'contato',
    'observacao', observacoes_internas
  )
)
WHERE observacoes_internas IS NOT NULL
  AND length(trim(observacoes_internas)) > 0;