CREATE TABLE IF NOT EXISTS public.clickup_demandas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  list_id text,
  list_nome text,
  prefixo_nome text,
  assignee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  assignee_nomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clickup_demandas_config TO authenticated;
GRANT ALL ON public.clickup_demandas_config TO service_role;

ALTER TABLE public.clickup_demandas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage clickup demandas config" ON public.clickup_demandas_config;
CREATE POLICY "Authenticated manage clickup demandas config"
ON public.clickup_demandas_config FOR ALL TO authenticated
USING (true) WITH CHECK (true);

ALTER TABLE public.demandas_marca
  ADD COLUMN IF NOT EXISTS clickup_task_id text,
  ADD COLUMN IF NOT EXISTS clickup_task_url text,
  ADD COLUMN IF NOT EXISTS clickup_enviado_em timestamptz;