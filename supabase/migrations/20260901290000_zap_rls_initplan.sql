-- Corrige o custo do RLS nas tabelas do ZapVendas.
--
-- As políticas chamavam `has_role('zapvendas')` como expressão solta. Assim o
-- planejador a trata como filtro de linha e reavalia a função a cada tupla —
-- em zap_mensagens isso significava 66 mil chamadas, cada uma consultando
-- user_roles. O painel levava 63,8s por consulta para quem entra pelo
-- navegador, enquanto o mesmo SQL rodava em 0,85s pela service_role, que
-- ignora RLS. Foi exatamente por isso que os testes de curl nunca acusaram:
-- mediam o caminho errado.
--
-- Envolver em subconsulta escalar torna a chamada um InitPlan: o Postgres a
-- resolve UMA vez por consulta e reaproveita o booleano. Medido em produção
-- com o papel authenticated: 63,772s -> 0,653s.
--
-- A semântica não muda. `has_role` é STABLE, então seu valor já era constante
-- dentro da consulta; o parêntese só informa isso ao planejador. Quem não tem
-- o papel continua sem enxergar linha alguma.

alter policy "zapvendas le zap_mensagens"        on zap_mensagens        using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas le zap_turnos_cache"     on zap_turnos_cache     using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas le zap_contatos"         on zap_contatos         using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas le zap_conversa_analise" on zap_conversa_analise using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas le zap_consultor_parecer" on zap_consultor_parecer using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas le zap_backfill_jobs"    on zap_backfill_jobs    using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas le apresentacoes"        on zap_apresentacoes    using ((select has_role('zapvendas'::app_role)));
alter policy "zapvendas apaga apresentacoes"     on zap_apresentacoes    using ((select has_role('zapvendas'::app_role)));

-- ALL: precisa do with_check junto, senão o INSERT/UPDATE passa a ser negado.
alter policy "zapvendas gerencia instancias" on zap_instancias
  using ((select has_role('zapvendas'::app_role)))
  with check ((select has_role('zapvendas'::app_role)));
