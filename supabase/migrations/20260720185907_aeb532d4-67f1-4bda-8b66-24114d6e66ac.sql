
-- Tabela principal de cotações de frete
CREATE TABLE public.frete_cotacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('estoque_proprio', 'pod')),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  ativa BOOLEAN NOT NULL DEFAULT true,
  -- Estoque Próprio
  nome_produtor TEXT,
  nome_produto TEXT,
  tipo_produto TEXT,
  quantidade_unidades INTEGER,
  valor_frete NUMERIC(15,6),
  status TEXT CHECK (status IN ('pendente', 'confirmado')),
  observacoes_internas TEXT,
  -- POD
  pod_plano INTEGER,
  pod_preco_por_envio NUMERIC(15,6),
  pod_preco_editado_manualmente BOOLEAN DEFAULT false,
  pod_quantidade_envios_estimada INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_frete_cotacoes_orcamento ON public.frete_cotacoes(orcamento_id) WHERE ativa = true;
CREATE INDEX idx_frete_cotacoes_tipo ON public.frete_cotacoes(tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frete_cotacoes TO authenticated;
GRANT ALL ON public.frete_cotacoes TO service_role;

ALTER TABLE public.frete_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view frete_cotacoes"
  ON public.frete_cotacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert frete_cotacoes"
  ON public.frete_cotacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update frete_cotacoes"
  ON public.frete_cotacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete frete_cotacoes"
  ON public.frete_cotacoes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_frete_cotacoes_updated_at
  BEFORE UPDATE ON public.frete_cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de preços POD
CREATE TABLE public.frete_pod_precos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_produto TEXT NOT NULL,
  plano INTEGER NOT NULL,
  preco NUMERIC(15,6) NOT NULL,
  faixa_peso TEXT,
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_frete_pod_precos_ativo
  ON public.frete_pod_precos(tipo_produto, plano)
  WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frete_pod_precos TO authenticated;
GRANT ALL ON public.frete_pod_precos TO service_role;

ALTER TABLE public.frete_pod_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view frete_pod_precos"
  ON public.frete_pod_precos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert frete_pod_precos"
  ON public.frete_pod_precos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update frete_pod_precos"
  ON public.frete_pod_precos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete frete_pod_precos"
  ON public.frete_pod_precos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_frete_pod_precos_updated_at
  BEFORE UPDATE ON public.frete_pod_precos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de alterações de preços POD
CREATE TABLE public.frete_pod_precos_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preco_id UUID REFERENCES public.frete_pod_precos(id) ON DELETE SET NULL,
  tipo_produto TEXT NOT NULL,
  plano INTEGER NOT NULL,
  preco_anterior NUMERIC(15,6),
  preco_novo NUMERIC(15,6) NOT NULL,
  alterado_por UUID REFERENCES auth.users(id),
  alterado_por_email TEXT,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_frete_pod_historico_preco ON public.frete_pod_precos_historico(preco_id);

GRANT SELECT, INSERT ON public.frete_pod_precos_historico TO authenticated;
GRANT ALL ON public.frete_pod_precos_historico TO service_role;

ALTER TABLE public.frete_pod_precos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view frete_pod_precos_historico"
  ON public.frete_pod_precos_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert frete_pod_precos_historico"
  ON public.frete_pod_precos_historico FOR INSERT TO authenticated WITH CHECK (true);

-- Seed inicial: Líquido e Encapsulado
INSERT INTO public.frete_pod_precos (tipo_produto, plano, preco, faixa_peso) VALUES
  ('Líquido', 1, 24.00, '0-300g'),
  ('Líquido', 2, 24.00, '0-300g'),
  ('Líquido', 3, 24.00, '0-300g'),
  ('Líquido', 5, 24.00, '0-300g'),
  ('Líquido', 6, 24.00, '0-300g'),
  ('Líquido', 8, 30.00, '301-500g'),
  ('Líquido', 9, 30.00, '301-500g'),
  ('Líquido', 10, 30.00, '301-500g'),
  ('Líquido', 12, 41.20, '501-1000g'),
  ('Líquido', 20, 41.20, '501-1000g'),
  ('Líquido', 50, 41.20, '501-1000g'),
  ('Encapsulado', 1, 24.00, '0-300g'),
  ('Encapsulado', 2, 24.00, '0-300g'),
  ('Encapsulado', 3, 24.00, '0-300g'),
  ('Encapsulado', 5, 29.40, '301-500g'),
  ('Encapsulado', 6, 29.40, '301-500g'),
  ('Encapsulado', 8, 29.40, '301-500g'),
  ('Encapsulado', 9, 35.70, '501-1000g'),
  ('Encapsulado', 10, 35.70, '501-1000g'),
  ('Encapsulado', 12, 35.70, '501-1000g'),
  ('Encapsulado', 20, 35.70, '501-1000g'),
  ('Encapsulado', 50, 35.70, '501-1000g');
