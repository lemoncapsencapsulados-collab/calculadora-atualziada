ALTER TABLE public.contrato_modelos
  ADD COLUMN IF NOT EXISTS email_envio text,
  ADD COLUMN IF NOT EXISTS nome_envio text;