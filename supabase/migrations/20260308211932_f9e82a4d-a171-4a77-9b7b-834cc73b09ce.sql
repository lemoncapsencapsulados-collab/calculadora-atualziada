-- Drop all existing permissive policies and replace with auth-required ones

-- embalagens
DROP POLICY IF EXISTS "Permitir atualização pública de embalagens" ON public.embalagens;
DROP POLICY IF EXISTS "Permitir exclusão pública de embalagens" ON public.embalagens;
DROP POLICY IF EXISTS "Permitir inserção pública de embalagens" ON public.embalagens;
DROP POLICY IF EXISTS "Permitir leitura pública de embalagens" ON public.embalagens;
CREATE POLICY "Authenticated select embalagens" ON public.embalagens FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert embalagens" ON public.embalagens FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update embalagens" ON public.embalagens FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete embalagens" ON public.embalagens FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- formulas
DROP POLICY IF EXISTS "Permitir atualização pública de fórmulas" ON public.formulas;
DROP POLICY IF EXISTS "Permitir exclusão pública de fórmulas" ON public.formulas;
DROP POLICY IF EXISTS "Permitir inserção pública de fórmulas" ON public.formulas;
DROP POLICY IF EXISTS "Permitir leitura pública de fórmulas" ON public.formulas;
CREATE POLICY "Authenticated select formulas" ON public.formulas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert formulas" ON public.formulas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update formulas" ON public.formulas FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete formulas" ON public.formulas FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- materias_primas
DROP POLICY IF EXISTS "Permitir atualização pública de insumos" ON public.materias_primas;
DROP POLICY IF EXISTS "Permitir exclusão pública de insumos" ON public.materias_primas;
DROP POLICY IF EXISTS "Permitir inserção pública de insumos" ON public.materias_primas;
DROP POLICY IF EXISTS "Permitir leitura pública de insumos" ON public.materias_primas;
CREATE POLICY "Authenticated select materias_primas" ON public.materias_primas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert materias_primas" ON public.materias_primas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update materias_primas" ON public.materias_primas FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete materias_primas" ON public.materias_primas FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- pedidos
DROP POLICY IF EXISTS "Permitir atualização pública de pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir exclusão pública de pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir inserção pública de pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir leitura pública de pedidos" ON public.pedidos;
CREATE POLICY "Authenticated select pedidos" ON public.pedidos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert pedidos" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update pedidos" ON public.pedidos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete pedidos" ON public.pedidos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- configuracao_custos
DROP POLICY IF EXISTS "Permitir atualização pública de configuracao_custos" ON public.configuracao_custos;
DROP POLICY IF EXISTS "Permitir exclusão pública de configuracao_custos" ON public.configuracao_custos;
DROP POLICY IF EXISTS "Permitir inserção pública de configuracao_custos" ON public.configuracao_custos;
DROP POLICY IF EXISTS "Permitir leitura pública de configuracao_custos" ON public.configuracao_custos;
CREATE POLICY "Authenticated select configuracao_custos" ON public.configuracao_custos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert configuracao_custos" ON public.configuracao_custos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update configuracao_custos" ON public.configuracao_custos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete configuracao_custos" ON public.configuracao_custos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- margens_lucro
DROP POLICY IF EXISTS "Permitir atualização pública de margens_lucro" ON public.margens_lucro;
DROP POLICY IF EXISTS "Permitir exclusão pública de margens_lucro" ON public.margens_lucro;
DROP POLICY IF EXISTS "Permitir inserção pública de margens_lucro" ON public.margens_lucro;
DROP POLICY IF EXISTS "Permitir leitura pública de margens_lucro" ON public.margens_lucro;
CREATE POLICY "Authenticated select margens_lucro" ON public.margens_lucro FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert margens_lucro" ON public.margens_lucro FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update margens_lucro" ON public.margens_lucro FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete margens_lucro" ON public.margens_lucro FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- precificacoes
DROP POLICY IF EXISTS "Permitir atualização pública de precificacoes" ON public.precificacoes;
DROP POLICY IF EXISTS "Permitir exclusão pública de precificacoes" ON public.precificacoes;
DROP POLICY IF EXISTS "Permitir inserção pública de precificacoes" ON public.precificacoes;
DROP POLICY IF EXISTS "Permitir leitura pública de precificacoes" ON public.precificacoes;
CREATE POLICY "Authenticated select precificacoes" ON public.precificacoes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert precificacoes" ON public.precificacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update precificacoes" ON public.precificacoes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete precificacoes" ON public.precificacoes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- orcamentos
DROP POLICY IF EXISTS "Permitir atualização pública de orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir exclusão pública de orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir inserção pública de orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Permitir leitura pública de orcamentos" ON public.orcamentos;
CREATE POLICY "Authenticated select orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- recompras
DROP POLICY IF EXISTS "Permitir atualizacao publica de recompras" ON public.recompras;
DROP POLICY IF EXISTS "Permitir exclusao publica de recompras" ON public.recompras;
DROP POLICY IF EXISTS "Permitir insercao publica de recompras" ON public.recompras;
DROP POLICY IF EXISTS "Permitir leitura publica de recompras" ON public.recompras;
CREATE POLICY "Authenticated select recompras" ON public.recompras FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert recompras" ON public.recompras FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update recompras" ON public.recompras FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete recompras" ON public.recompras FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- usuarios
DROP POLICY IF EXISTS "Permitir atualizacao publica de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir exclusao publica de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir insercao publica de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura publica de usuarios" ON public.usuarios;
CREATE POLICY "Authenticated select usuarios" ON public.usuarios FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert usuarios" ON public.usuarios FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update usuarios" ON public.usuarios FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete usuarios" ON public.usuarios FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- lotes
DROP POLICY IF EXISTS "Permitir atualizacao publica de lotes" ON public.lotes;
DROP POLICY IF EXISTS "Permitir exclusao publica de lotes" ON public.lotes;
DROP POLICY IF EXISTS "Permitir insercao publica de lotes" ON public.lotes;
DROP POLICY IF EXISTS "Permitir leitura publica de lotes" ON public.lotes;
CREATE POLICY "Authenticated select lotes" ON public.lotes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert lotes" ON public.lotes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update lotes" ON public.lotes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete lotes" ON public.lotes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
