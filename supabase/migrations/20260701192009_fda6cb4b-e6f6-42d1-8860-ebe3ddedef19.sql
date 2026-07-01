
CREATE TABLE public.asaas_eventos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text,
  status text NOT NULL DEFAULT 'sucesso',
  asaas_payment_id text,
  asaas_installment_id text,
  asaas_customer_id text,
  cpf_cnpj text,
  valor numeric,
  orcamento_id uuid,
  pedido_id uuid,
  mensagem text,
  payload jsonb,
  resposta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asaas_eventos_log TO authenticated;
GRANT ALL ON public.asaas_eventos_log TO service_role;
ALTER TABLE public.asaas_eventos_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read asaas logs" ON public.asaas_eventos_log FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_asaas_eventos_log_created ON public.asaas_eventos_log (created_at DESC);
