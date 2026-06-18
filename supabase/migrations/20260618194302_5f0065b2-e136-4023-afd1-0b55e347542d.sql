
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_installment_id text,
  ADD COLUMN IF NOT EXISTS asaas_parcelas_total integer,
  ADD COLUMN IF NOT EXISTS pagamentos_recebidos jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orcamentos_asaas_payment_id ON public.orcamentos(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_asaas_installment_id ON public.orcamentos(asaas_installment_id);

CREATE TABLE IF NOT EXISTS public.asaas_webhook_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  cpf_cnpj text,
  valor numeric,
  asaas_payment_id text,
  asaas_customer_id text,
  motivo text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_webhook_pendentes TO authenticated;
GRANT ALL ON public.asaas_webhook_pendentes TO service_role;

ALTER TABLE public.asaas_webhook_pendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pendentes" ON public.asaas_webhook_pendentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update pendentes" ON public.asaas_webhook_pendentes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete pendentes" ON public.asaas_webhook_pendentes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_asaas_pendentes_updated_at
BEFORE UPDATE ON public.asaas_webhook_pendentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_asaas_pendentes_resolved ON public.asaas_webhook_pendentes(resolved, created_at DESC);
