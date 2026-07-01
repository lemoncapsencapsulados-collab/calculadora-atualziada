
CREATE TABLE public.braip_consultas_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL,
  consultor_nome text NOT NULL,
  mes text NOT NULL,
  filtro_produto_nome text,
  filtro_produto_codigo text,
  quantidade_vendida integer NOT NULL DEFAULT 0,
  faturamento_total numeric NOT NULL DEFAULT 0,
  comissao_total numeric NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 1,
  valor_consultor numeric NOT NULL DEFAULT 0,
  por_produto jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.braip_consultas_salvas TO authenticated;
GRANT ALL ON public.braip_consultas_salvas TO service_role;

ALTER TABLE public.braip_consultas_salvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage braip consultas"
ON public.braip_consultas_salvas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER braip_consultas_salvas_updated_at
BEFORE UPDATE ON public.braip_consultas_salvas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
