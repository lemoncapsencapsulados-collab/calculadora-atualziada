-- Criar tabela para armazenar fórmulas/cotações
CREATE TABLE public.formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente TEXT NOT NULL,
  nome_formula TEXT NOT NULL,
  tipo_produto TEXT NOT NULL,
  qtd_capsulas NUMERIC NOT NULL,
  itens JSONB NOT NULL,
  embalagens JSONB NOT NULL,
  total_mp NUMERIC NOT NULL,
  total_embalagem NUMERIC NOT NULL,
  custo_total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimizar buscas
CREATE INDEX idx_formulas_cliente ON public.formulas(cliente);
CREATE INDEX idx_formulas_nome ON public.formulas(nome_formula);
CREATE INDEX idx_formulas_created_at ON public.formulas(created_at DESC);

-- RLS (Row Level Security) - acesso público
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de fórmulas"
  ON public.formulas FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção pública de fórmulas"
  ON public.formulas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de fórmulas"
  ON public.formulas FOR UPDATE
  USING (true);

CREATE POLICY "Permitir exclusão pública de fórmulas"
  ON public.formulas FOR DELETE
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_formulas_updated_at
  BEFORE UPDATE ON public.formulas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();