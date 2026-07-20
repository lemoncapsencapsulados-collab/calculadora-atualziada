
ALTER TABLE public.frete_pod_precos
  ADD COLUMN IF NOT EXISTS taxa_manuseio numeric(15,6) NOT NULL DEFAULT 0;

ALTER TABLE public.frete_pod_precos_historico
  ADD COLUMN IF NOT EXISTS taxa_manuseio_anterior numeric(15,6),
  ADD COLUMN IF NOT EXISTS taxa_manuseio_nova numeric(15,6);

-- Backfill: copia taxa por tipo para cada plano
UPDATE public.frete_pod_precos p
SET taxa_manuseio = c.taxa_manuseio
FROM public.frete_logistica_config c
WHERE c.tipo_produto = p.tipo_produto
  AND p.taxa_manuseio = 0;

DROP TABLE IF EXISTS public.frete_logistica_config CASCADE;
