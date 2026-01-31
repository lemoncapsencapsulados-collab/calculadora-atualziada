-- Add new columns to orcamentos table for consultant, client data and freight details
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS consultor_responsavel TEXT;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS dados_cliente JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS detalhamento_frete JSONB DEFAULT '{}'::jsonb;