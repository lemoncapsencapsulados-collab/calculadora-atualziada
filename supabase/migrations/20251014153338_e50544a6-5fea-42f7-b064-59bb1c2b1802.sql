-- Criar tabela de insumos
CREATE TABLE insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  unidade_compra TEXT NOT NULL,
  preco_compra DECIMAL(10,2) NOT NULL,
  densidade DECIMAL(10,4),
  fornecedor TEXT,
  categoria TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de embalagens
CREATE TABLE embalagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX idx_insumos_nome ON insumos(nome);
CREATE INDEX idx_insumos_categoria ON insumos(categoria);
CREATE INDEX idx_embalagens_nome ON embalagens(nome);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_insumos_updated_at
  BEFORE UPDATE ON insumos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_embalagens_updated_at
  BEFORE UPDATE ON embalagens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE embalagens ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (leitura e escrita para todos)
CREATE POLICY "Permitir leitura pública de insumos"
  ON insumos FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção pública de insumos"
  ON insumos FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de insumos"
  ON insumos FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Permitir exclusão pública de insumos"
  ON insumos FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Permitir leitura pública de embalagens"
  ON embalagens FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção pública de embalagens"
  ON embalagens FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de embalagens"
  ON embalagens FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Permitir exclusão pública de embalagens"
  ON embalagens FOR DELETE
  TO public
  USING (true);

-- Habilitar Realtime
ALTER TABLE insumos REPLICA IDENTITY FULL;
ALTER TABLE embalagens REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE insumos;
ALTER PUBLICATION supabase_realtime ADD TABLE embalagens;