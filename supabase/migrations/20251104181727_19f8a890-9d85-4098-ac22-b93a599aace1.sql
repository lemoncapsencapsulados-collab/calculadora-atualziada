-- Corrigir search_path nas funções para segurança

-- Recriar função normalize_insumo_name com search_path seguro
CREATE OR REPLACE FUNCTION normalize_insumo_name(input_name TEXT) 
RETURNS TEXT 
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- Recriar função set_normalized_name com search_path seguro
CREATE OR REPLACE FUNCTION set_normalized_name()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.normalized_name := normalize_insumo_name(NEW.nome);
  RETURN NEW;
END;
$$;