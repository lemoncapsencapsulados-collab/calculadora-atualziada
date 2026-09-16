-- Renomear colunas
ALTER TABLE formulas RENAME COLUMN qtd_capsulas TO quantidade_por_pote;
ALTER TABLE formulas RENAME COLUMN unidade_po TO unidade_soluvel;

-- Atualizar valores existentes
UPDATE formulas SET tipo_produto = 'Solúvel' WHERE tipo_produto = 'Pó';
UPDATE margens_lucro SET tipo_produto = 'Solúvel' WHERE tipo_produto = 'Pó';