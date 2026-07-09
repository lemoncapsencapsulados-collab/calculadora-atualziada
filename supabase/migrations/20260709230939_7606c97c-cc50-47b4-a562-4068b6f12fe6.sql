ALTER TABLE public.contrato_modelos_docx
  ADD COLUMN IF NOT EXISTS email_financeiro text,
  ADD COLUMN IF NOT EXISTS nome_financeiro text;