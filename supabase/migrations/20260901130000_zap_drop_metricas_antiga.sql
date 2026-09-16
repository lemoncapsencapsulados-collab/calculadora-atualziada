-- Remove a assinatura antiga de `zap_metricas_consultor`.
--
-- A versão nova tem um terceiro parâmetro com default (`p_incluir_internos`), o
-- que criou uma SOBRECARGA: com as duas no banco, o PostgREST não consegue
-- escolher entre elas e devolve PGRST203 para toda chamada com dois argumentos
-- — ou seja, o painel inteiro para.
--
-- Default não resolve ambiguidade: para o Postgres, `f(a,b)` e `f(a,b,c=x)`
-- são igualmente aplicáveis a uma chamada com dois argumentos.
drop function if exists public.zap_metricas_consultor(timestamptz, timestamptz);
