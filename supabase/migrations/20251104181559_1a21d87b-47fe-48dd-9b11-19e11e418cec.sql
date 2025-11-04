-- Habilitar extensão unaccent para remover acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Adicionar coluna normalized_name para matching inteligente
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS normalized_name TEXT;

-- Função para normalizar nomes (remover acentos, minúsculas, etc.)
CREATE OR REPLACE FUNCTION normalize_insumo_name(input_name TEXT) 
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Converter para minúsculas e remover acentos
  result := lower(unaccent(trim(input_name)));
  
  -- Substituir caracteres especiais por espaço
  result := regexp_replace(result, '[%/(),.]', ' ', 'g');
  
  -- Remover múltiplos espaços
  result := regexp_replace(result, '\s+', ' ', 'g');
  
  -- Remover termos cosméticos comuns
  result := regexp_replace(result, '\s+(po|liquido|em po|100%|99%|98%|95%|90%|80%|50%|35%|20%|8%)\s*', ' ', 'g');
  result := regexp_replace(result, '\s+(ext|extrato|soluvel)\s*', ' ', 'g');
  
  -- Padronizar "tipo 2" para "tipo ii"
  result := regexp_replace(result, 'tipo\s*2', 'tipo ii', 'g');
  
  -- Remover espaços extras novamente
  result := trim(regexp_replace(result, '\s+', ' ', 'g'));
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para auto-preencher normalized_name ao inserir/atualizar
CREATE OR REPLACE FUNCTION set_normalized_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name := normalize_insumo_name(NEW.nome);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_normalized_name ON insumos;
CREATE TRIGGER trigger_set_normalized_name
  BEFORE INSERT OR UPDATE ON insumos
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_name();

-- Atualizar todos os registros existentes
UPDATE insumos 
SET normalized_name = normalize_insumo_name(nome)
WHERE normalized_name IS NULL OR normalized_name = '';

-- Criar índice para busca rápida (sem unique por enquanto devido a duplicatas)
CREATE INDEX IF NOT EXISTS idx_insumos_normalized_name ON insumos(normalized_name);