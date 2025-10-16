-- Criar tabela de pedidos de produção
CREATE TABLE public.pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  
  -- Dados do pedido
  numero_pedido TEXT NOT NULL UNIQUE,
  data_pedido TIMESTAMP WITH TIME ZONE NOT NULL,
  data_entrega TIMESTAMP WITH TIME ZONE NOT NULL,
  quantidade_produto NUMERIC NOT NULL,
  unidade_produto TEXT NOT NULL,
  
  -- Campo de observações detalhadas (cor de pote, tampa, etc)
  observacoes TEXT,
  
  -- Status do pedido
  status TEXT NOT NULL DEFAULT 'aguardando_producao' 
    CHECK (status IN ('aguardando_producao', 'no_estoque', 'enviado', 'concluido')),
  
  -- Snapshot da fórmula original (preserva histórico)
  formula_snapshot JSONB NOT NULL,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_pedidos_formula_id ON public.pedidos(formula_id);
CREATE INDEX idx_pedidos_status ON public.pedidos(status);
CREATE INDEX idx_pedidos_data_pedido ON public.pedidos(data_pedido DESC);
CREATE INDEX idx_pedidos_numero ON public.pedidos(numero_pedido);

-- Trigger para updated_at
CREATE TRIGGER update_pedidos_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de pedidos"
ON public.pedidos FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública de pedidos"
ON public.pedidos FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de pedidos"
ON public.pedidos FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusão pública de pedidos"
ON public.pedidos FOR DELETE USING (true);