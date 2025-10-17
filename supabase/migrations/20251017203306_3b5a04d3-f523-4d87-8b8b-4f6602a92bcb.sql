-- Corrigir a categoria da Cápsula 0 para que apareça na seleção
UPDATE public.embalagens
SET categoria = 'Cápsulas'
WHERE id = 'bb1e1f6f-839c-4d6c-9b5c-053a1ec3e8c4'
AND nome = 'Cápsula 0 (ENCAPSULADOS)';

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.embalagens.categoria IS 'Categoria da embalagem. Use "Cápsulas" para tipos de cápsula.';