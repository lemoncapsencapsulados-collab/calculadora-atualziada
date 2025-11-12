-- Alterar precisão da coluna preco_compra para suportar mais casas decimais
ALTER TABLE insumos 
ALTER COLUMN preco_compra TYPE numeric(15, 6);

-- Atualizar o preço da Base de Gotas
UPDATE insumos 
SET preco_compra = 0.004 
WHERE nome = 'Base de Gotas';

-- Fazer o mesmo ajuste na tabela embalagens para consistência
ALTER TABLE embalagens 
ALTER COLUMN preco_unitario TYPE numeric(15, 6);