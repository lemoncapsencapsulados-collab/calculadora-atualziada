-- Tabela de resumos de contrato
CREATE TABLE public.resumos_contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL UNIQUE,
  cliente_id UUID,
  numero_orcamento TEXT NOT NULL,
  nome_cliente TEXT NOT NULL,
  dados_cliente JSONB NOT NULL DEFAULT '{}'::jsonb,
  detalhamento_frete JSONB NOT NULL DEFAULT '{}'::jsonb,
  condicoes_pagamento JSONB,
  detalhes_producao JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_path TEXT NOT NULL,
  pdf_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resumos_contrato_cliente ON public.resumos_contrato(cliente_id);

ALTER TABLE public.resumos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_resumos_contrato" ON public.resumos_contrato
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_resumos_contrato" ON public.resumos_contrato
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_resumos_contrato" ON public.resumos_contrato
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_resumos_contrato" ON public.resumos_contrato
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_resumos_contrato_updated_at
  BEFORE UPDATE ON public.resumos_contrato
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_select_contratos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'contratos' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_contratos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contratos' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_contratos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'contratos' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_contratos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'contratos' AND auth.uid() IS NOT NULL);