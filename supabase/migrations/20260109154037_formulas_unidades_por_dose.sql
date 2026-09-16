-- Recuperada de supabase_migrations.schema_migrations do projeto de producao
-- (njfwoguvfozuaghufcgw). Foi aplicada direto no banco, sem passar pelo repo.
-- Conteudo identico ao registrado no ledger; ja esta aplicada em producao.

-- Add unidades_por_dose column to formulas table
ALTER TABLE public.formulas ADD COLUMN IF NOT EXISTS unidades_por_dose NUMERIC DEFAULT NULL;