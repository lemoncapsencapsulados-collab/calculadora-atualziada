-- Tabela de recompras (vendas recorrentes)
CREATE TABLE public.recompras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente TEXT NOT NULL,
  consultor_responsavel TEXT NOT NULL,
  data_recompra TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  produtos JSONB NOT NULL DEFAULT '[]',
  quantidade_total INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.recompras ENABLE ROW LEVEL SECURITY;

-- Politicas RLS (permissivas para workspace compartilhado)
CREATE POLICY "Permitir leitura publica de recompras"
  ON public.recompras FOR SELECT USING (true);

CREATE POLICY "Permitir insercao publica de recompras"
  ON public.recompras FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualizacao publica de recompras"
  ON public.recompras FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusao publica de recompras"
  ON public.recompras FOR DELETE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_recompras_updated_at
  BEFORE UPDATE ON public.recompras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();