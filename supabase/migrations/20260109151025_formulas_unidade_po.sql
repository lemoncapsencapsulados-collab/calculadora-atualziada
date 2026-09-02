-- Recuperada de supabase_migrations.schema_migrations do projeto de producao
-- (njfwoguvfozuaghufcgw). Foi aplicada direto no banco, sem passar pelo repo.
-- Conteudo identico ao registrado no ledger; ja esta aplicada em producao.

ALTER TABLE formulas ADD COLUMN IF NOT EXISTS unidade_po TEXT DEFAULT 'mg';