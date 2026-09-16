
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS orcamento_id uuid;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS orcamento_snapshot jsonb;
ALTER TABLE public.pedidos ALTER COLUMN formula_id DROP NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN formula_snapshot DROP NOT NULL;
