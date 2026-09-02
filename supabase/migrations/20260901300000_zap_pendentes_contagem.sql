-- Contagem da fila de análise sem trazer a fila.
--
-- `zap-analisar` terminava cada rodada chamando zap_conversas_para_analisar com
-- p_limite = 100000 só para medir `restantes`. Isso agrega o acervo inteiro e
-- devolve milhares de linhas pela rede a cada rodada — trabalho pago para
-- produzir um único número, repetido dezenas de vezes durante uma varredura.
--
-- Aqui o limite fica no banco e só o contador atravessa.

create or replace function public.zap_conversas_pendentes(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_versao integer default 1,
  p_usuario_id uuid default null
) returns bigint
language sql
stable
as $$
  select count(*)::bigint
  from public.zap_conversas_para_analisar(p_inicio, p_fim, p_versao, 2147483647, p_usuario_id);
$$;

grant execute on function public.zap_conversas_pendentes(timestamptz, timestamptz, integer, uuid)
  to authenticated, service_role;
