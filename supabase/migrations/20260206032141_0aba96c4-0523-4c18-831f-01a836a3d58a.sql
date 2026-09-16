-- Adicionar coluna de condições de pagamento na tabela orcamentos
ALTER TABLE orcamentos
ADD COLUMN IF NOT EXISTS condicoes_pagamento JSONB DEFAULT NULL;

COMMENT ON COLUMN orcamentos.condicoes_pagamento IS 'Detalhamento das condições de pagamento: entrada e término';