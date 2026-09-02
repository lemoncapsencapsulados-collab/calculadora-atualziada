-- Remove a função de diagnóstico temporária.
--
-- Ela existiu para localizar o gargalo de 8s do painel, comparando o tempo de
-- cada etapa isoladamente contra o da função inteira. Foi ela que revelou que
-- as partes somavam 450 ms enquanto o todo levava 3.973 ms — a pista que levou
-- à materialização das CTEs. Cumprido o papel, sai: função de instrumentação
-- esquecida em produção vira código que ninguém sabe se pode apagar.
drop function if exists public.zap_diag(timestamptz, timestamptz);
