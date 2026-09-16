
CREATE TABLE public.clickup_rotulo_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo BOOLEAN NOT NULL DEFAULT true,
  list_id TEXT NOT NULL,
  list_nome TEXT,
  assignee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignee_nomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  prefixo_nome TEXT NOT NULL DEFAULT 'Rótulo - ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clickup_rotulo_config TO authenticated;
GRANT ALL ON public.clickup_rotulo_config TO service_role;

ALTER TABLE public.clickup_rotulo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver clickup_rotulo_config"
  ON public.clickup_rotulo_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir clickup_rotulo_config"
  ON public.clickup_rotulo_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar clickup_rotulo_config"
  ON public.clickup_rotulo_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem deletar clickup_rotulo_config"
  ON public.clickup_rotulo_config FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_clickup_rotulo_config_updated_at
  BEFORE UPDATE ON public.clickup_rotulo_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
