
CREATE TABLE public.contrato_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  template_id text NOT NULL,
  ambiente text NOT NULL DEFAULT 'producao' CHECK (ambiente IN ('producao', 'sandbox')),
  descricao text,
  is_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_modelos TO authenticated;
GRANT ALL ON public.contrato_modelos TO service_role;

ALTER TABLE public.contrato_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select_contrato_modelos ON public.contrato_modelos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_insert_contrato_modelos ON public.contrato_modelos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY auth_update_contrato_modelos ON public.contrato_modelos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_delete_contrato_modelos ON public.contrato_modelos FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_contrato_modelos_updated_at
  BEFORE UPDATE ON public.contrato_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
