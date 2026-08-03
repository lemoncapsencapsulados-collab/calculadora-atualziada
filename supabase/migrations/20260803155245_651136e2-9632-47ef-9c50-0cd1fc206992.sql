INSERT INTO public.clickup_demandas_config (tipo, ativo, list_id, list_nome, prefixo_nome, status_inicial)
VALUES ('rotulo', true, '901109948667', 'DESIGN / RÓTULOS', 'Rótulo - ', 'demanda vendedores')
ON CONFLICT (tipo) DO UPDATE SET list_id = EXCLUDED.list_id, list_nome = EXCLUDED.list_nome, status_inicial = EXCLUDED.status_inicial, ativo = true, updated_at = now();