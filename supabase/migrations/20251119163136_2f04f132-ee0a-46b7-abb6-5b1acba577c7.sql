-- Adicionar coluna margem_seguranca à tabela precificacoes
ALTER TABLE precificacoes ADD COLUMN IF NOT EXISTS margem_seguranca numeric NOT NULL DEFAULT 0;