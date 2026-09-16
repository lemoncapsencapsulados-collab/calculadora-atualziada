CREATE TABLE public.monetizze_consultas_salvas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultor_id UUID NOT NULL,
  consultor_nome TEXT NOT NULL,
  mes TEXT NOT NULL,
  filtro_produto_nome TEXT,
  filtro_produto_codigo TEXT,
  quantidade_vendida INTEGER NOT NULL DEFAULT 0,
  faturamento_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  comissao_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  percentual NUMERIC(6,3) NOT NULL DEFAULT 1,
  valor_consultor NUMERIC(15,2) NOT NULL DEFAULT 0,
  por_produto JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monetizze_consultas_salvas TO authenticated;
GRANT ALL ON public.monetizze_consultas_salvas TO service_role;
ALTER TABLE public.monetizze_consultas_salvas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage monetizze consultas" ON public.monetizze_consultas_salvas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_monetizze_consultas_updated BEFORE UPDATE ON public.monetizze_consultas_salvas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_monetizze_consultor ON public.monetizze_consultas_salvas(consultor_id, mes DESC);