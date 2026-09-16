-- Permite excluir apresentações pela interface.
--
-- A tabela nasceu só com policy de SELECT, para reforçar a imutabilidade: uma
-- apresentação não deve ser EDITADA, senão comparar ciclos vira ficção.
--
-- Excluir é diferente de editar. O histórico acumula rápido — quatro versões do
-- mesmo período em vinte minutos, durante os testes — e uma lista poluída faz
-- ninguém achar a versão que importa. Apagar uma versão inteira não reescreve o
-- passado; só o remove.
drop policy if exists "zapvendas apaga apresentacoes" on public.zap_apresentacoes;
create policy "zapvendas apaga apresentacoes" on public.zap_apresentacoes
  for delete to authenticated using (public.has_role('zapvendas'));

grant delete on public.zap_apresentacoes to authenticated;
