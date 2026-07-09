
CREATE TABLE public.contrato_modelos_docx (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT,
  html_editado TEXT,
  variaveis_detectadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  versao INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_modelos_docx TO authenticated;
GRANT SELECT ON public.contrato_modelos_docx TO anon;
GRANT ALL ON public.contrato_modelos_docx TO service_role;
ALTER TABLE public.contrato_modelos_docx ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read modelos docx" ON public.contrato_modelos_docx FOR SELECT USING (true);
CREATE POLICY "auth manage modelos docx" ON public.contrato_modelos_docx FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_contrato_modelos_docx_updated BEFORE UPDATE ON public.contrato_modelos_docx FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
