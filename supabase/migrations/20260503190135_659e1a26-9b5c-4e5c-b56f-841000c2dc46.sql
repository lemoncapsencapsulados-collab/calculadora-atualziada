ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS data_envio timestamp with time zone,
  ADD COLUMN IF NOT EXISTS observacoes_internas text;