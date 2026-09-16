
ALTER TABLE public.configuracao_custos
  ADD COLUMN IF NOT EXISTS energia_por_tipo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS despesas_admin_lista jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill energia_por_tipo com o valor legado de energia_eletrica para todos os tipos
UPDATE public.configuracao_custos
SET energia_por_tipo = jsonb_build_object(
  'encapsulados', COALESCE(energia_eletrica, 0),
  'soluvel',      COALESCE(energia_eletrica, 0),
  'gummy',        COALESCE(energia_eletrica, 0),
  'liquido',      COALESCE(energia_eletrica, 0)
)
WHERE energia_por_tipo = '{}'::jsonb;

-- Backfill despesas_admin_lista com uma linha "Folha Administrativa" usando o valor atual
UPDATE public.configuracao_custos
SET despesas_admin_lista = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'nome', 'Folha Administrativa',
    'custo_mensal', COALESCE(folha_administrativa, 0)
  )
)
WHERE despesas_admin_lista = '[]'::jsonb
  AND COALESCE(folha_administrativa, 0) > 0;
