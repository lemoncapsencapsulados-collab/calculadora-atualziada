CREATE TABLE public.intermediadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL DEFAULT '',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intermediadores TO authenticated;
GRANT ALL ON public.intermediadores TO service_role;

ALTER TABLE public.intermediadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select intermediadores" ON public.intermediadores FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert intermediadores" ON public.intermediadores FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update intermediadores" ON public.intermediadores FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete intermediadores" ON public.intermediadores FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_intermediadores_updated_at
BEFORE UPDATE ON public.intermediadores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();