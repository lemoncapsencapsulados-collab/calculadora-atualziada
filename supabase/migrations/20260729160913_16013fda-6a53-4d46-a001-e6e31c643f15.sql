CREATE TABLE public.demandas_marca (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('rotulo','criativos','banner','monetizze')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida')),
  cliente_nome text NOT NULL,
  vendedor_nome text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas_marca TO authenticated;
GRANT ALL ON public.demandas_marca TO service_role;

ALTER TABLE public.demandas_marca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view demandas_marca" ON public.demandas_marca FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert demandas_marca" ON public.demandas_marca FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update demandas_marca" ON public.demandas_marca FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete demandas_marca" ON public.demandas_marca FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_demandas_marca_pedido ON public.demandas_marca (pedido_id);

CREATE TRIGGER update_demandas_marca_updated_at
BEFORE UPDATE ON public.demandas_marca
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();