
CREATE TABLE public.frete_margem_faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envios_min INTEGER NOT NULL,
  envios_max INTEGER,
  margem_percentual NUMERIC(6,3) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frete_margem_faixas TO authenticated;
GRANT ALL ON public.frete_margem_faixas TO service_role;

ALTER TABLE public.frete_margem_faixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view frete_margem_faixas" ON public.frete_margem_faixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert frete_margem_faixas" ON public.frete_margem_faixas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update frete_margem_faixas" ON public.frete_margem_faixas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete frete_margem_faixas" ON public.frete_margem_faixas FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_frete_margem_faixas_updated_at
  BEFORE UPDATE ON public.frete_margem_faixas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.frete_margem_faixas (envios_min, envios_max, margem_percentual) VALUES
  (0, 50, 15),
  (51, 100, 13),
  (101, 200, 11),
  (201, 1000, 9),
  (1001, NULL, 8);

ALTER TABLE public.frete_cotacoes
  ADD COLUMN IF NOT EXISTS margem_percentual NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS margem_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS imposto_percentual NUMERIC(6,3) NOT NULL DEFAULT 12;
