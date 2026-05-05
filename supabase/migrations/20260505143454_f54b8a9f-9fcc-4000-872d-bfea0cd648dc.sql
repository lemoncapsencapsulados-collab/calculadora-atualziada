
-- Tabela de prazos de preço (janela de 20 dias após alteração de custos)
CREATE TABLE public.prazo_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historico_id uuid,
  configuracao_id uuid,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz NOT NULL,
  aplicado boolean NOT NULL DEFAULT false,
  aplicado_em timestamptz,
  orcamentos_recalculados integer NOT NULL DEFAULT 0,
  precificacoes_recalculadas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prazo_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select_prazo_precos ON public.prazo_precos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_insert_prazo_precos ON public.prazo_precos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY auth_update_prazo_precos ON public.prazo_precos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_prazo_precos_pendentes ON public.prazo_precos (aplicado, data_fim);

-- Colunas em orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS prazo_preco_id uuid,
  ADD COLUMN IF NOT EXISTS preco_recalculado_em timestamptz,
  ADD COLUMN IF NOT EXISTS preco_anterior_recalculo numeric;

CREATE INDEX IF NOT EXISTS idx_orcamentos_prazo_preco_id ON public.orcamentos (prazo_preco_id);

-- Colunas em precificacoes
ALTER TABLE public.precificacoes
  ADD COLUMN IF NOT EXISTS prazo_preco_id uuid,
  ADD COLUMN IF NOT EXISTS preco_recalculado_em timestamptz,
  ADD COLUMN IF NOT EXISTS preco_anterior_recalculo numeric;

CREATE INDEX IF NOT EXISTS idx_precificacoes_prazo_preco_id ON public.precificacoes (prazo_preco_id);

-- Coluna em formulas (apenas notificação visual)
ALTER TABLE public.formulas
  ADD COLUMN IF NOT EXISTS prazo_preco_id uuid;

CREATE INDEX IF NOT EXISTS idx_formulas_prazo_preco_id ON public.formulas (prazo_preco_id);
