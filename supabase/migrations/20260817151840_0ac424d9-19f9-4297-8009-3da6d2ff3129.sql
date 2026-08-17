CREATE TABLE public.insight_resolucoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid NOT NULL UNIQUE,
  numero_orcamento text,
  cliente text,
  consultor text,
  observacao text NOT NULL,
  resolvido_por uuid,
  resolvido_por_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_resolucoes TO authenticated;
GRANT ALL ON public.insight_resolucoes TO service_role;

ALTER TABLE public.insight_resolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver resolucoes" ON public.insight_resolucoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem criar resolucoes" ON public.insight_resolucoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar resolucoes" ON public.insight_resolucoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem remover resolucoes" ON public.insight_resolucoes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_insight_resolucoes_updated_at
BEFORE UPDATE ON public.insight_resolucoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();