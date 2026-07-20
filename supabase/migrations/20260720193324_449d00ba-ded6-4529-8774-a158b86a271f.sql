CREATE TABLE public.frete_logistica_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_produto text NOT NULL UNIQUE,
  taxa_manuseio numeric(15,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frete_logistica_config TO authenticated;
GRANT ALL ON public.frete_logistica_config TO service_role;

ALTER TABLE public.frete_logistica_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view frete_logistica_config" ON public.frete_logistica_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert frete_logistica_config" ON public.frete_logistica_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update frete_logistica_config" ON public.frete_logistica_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete frete_logistica_config" ON public.frete_logistica_config FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_frete_logistica_config_updated_at
  BEFORE UPDATE ON public.frete_logistica_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.frete_logistica_config (tipo_produto, taxa_manuseio)
VALUES ('Encapsulado', 0), ('Líquido', 0), ('Gummy', 0), ('Solúvel', 0)
ON CONFLICT (tipo_produto) DO NOTHING;