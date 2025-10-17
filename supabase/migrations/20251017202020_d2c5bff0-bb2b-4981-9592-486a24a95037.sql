-- Atualizar preço da Cápsula 0 para R$ 0,02
UPDATE public.embalagens 
SET preco_unitario = 0.02
WHERE id = 'bb1e1f6f-839c-4d6c-9b5c-053a1ec3e8c4' 
AND nome = 'Cápsula 0 (ENCAPSULADOS)';