
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS status_contrato text NOT NULL DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS contrato_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS contrato_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS vhsys_liquidado_em date,
  ADD COLUMN IF NOT EXISTS vhsys_valor_pago numeric;

COMMENT ON COLUMN public.orcamentos.status_contrato IS 'Status do contrato ZapSign: nenhum | enviado | assinado | recusado';
