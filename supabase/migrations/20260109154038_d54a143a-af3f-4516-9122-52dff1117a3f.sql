-- Add unidades_por_dose column to formulas table
ALTER TABLE public.formulas ADD COLUMN IF NOT EXISTS unidades_por_dose NUMERIC DEFAULT NULL;