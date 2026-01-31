-- Create orcamentos table for budget management
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_orcamento TEXT NOT NULL,
  nome_cliente TEXT NOT NULL,
  itens_producao JSONB NOT NULL DEFAULT '[]'::jsonb,
  servicos_marca JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_producao NUMERIC NOT NULL DEFAULT 0,
  subtotal_servicos NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  validade_dias INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (same pattern as other tables)
CREATE POLICY "Permitir leitura pública de orcamentos"
ON public.orcamentos
FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção pública de orcamentos"
ON public.orcamentos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de orcamentos"
ON public.orcamentos
FOR UPDATE
USING (true);

CREATE POLICY "Permitir exclusão pública de orcamentos"
ON public.orcamentos
FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_orcamentos_updated_at
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();