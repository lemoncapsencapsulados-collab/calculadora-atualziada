-- Add new columns to configuracao_custos
ALTER TABLE public.configuracao_custos
  ADD COLUMN IF NOT EXISTS taxa_perca numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS folha_producao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS folha_administrativa numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_encapsulados numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_soluvel numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_gummy numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_liquido numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mao_obra_direta_por_tipo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS despesas_admin_por_tipo jsonb NOT NULL DEFAULT '{}'::jsonb;

-- History table
CREATE TABLE IF NOT EXISTS public.historico_configuracao_custos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuracao_id uuid,
  usuario_email text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_anterior jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_configuracao_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_historico_configuracao_custos"
  ON public.historico_configuracao_custos
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_insert_historico_configuracao_custos"
  ON public.historico_configuracao_custos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_historico_config_custos_created_at
  ON public.historico_configuracao_custos (created_at DESC);