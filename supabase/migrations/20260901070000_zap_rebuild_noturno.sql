-- Reconstrução noturna do cache de turnos.
--
-- Aconteceu de verdade: o `zap-backfill` foi deployado antes de eu incluir a
-- manutenção do cache nele, e 427 das 1.377 conversas ficaram fora — 31% do
-- acervo invisível para o painel, sem erro, sem aviso, com números que pareciam
-- perfeitamente plausíveis.
--
-- Cache que só se atualiza pelo caminho incremental depende de esse caminho
-- nunca falhar. Este job limita a divergência a 24 horas, custe o que custar —
-- e custa pouco: 1,3 s para 1.377 conversas.
--
-- Não precisa de service_role nem de HTTP: é chamada SQL direta, dentro do
-- banco. Por isso não passa pela função `zap_agendar`.
select cron.unschedule('zap-turnos-rebuild')
where exists (select 1 from cron.job where jobname = 'zap-turnos-rebuild');

select cron.schedule(
  'zap-turnos-rebuild',
  -- 5h UTC = 2h de Brasília, antes da semeadura das 3h.
  '0 5 * * *',
  'select public.zap_recalcular_turnos_todos()'
);
