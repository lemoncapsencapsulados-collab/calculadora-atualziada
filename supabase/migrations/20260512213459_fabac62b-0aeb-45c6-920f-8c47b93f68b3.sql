-- Restringir EXECUTE de funções SECURITY DEFINER a postgres/service_role
REVOKE EXECUTE ON FUNCTION public.unaccent(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_mp_name(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_normalized_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_insumo_name(text) FROM PUBLIC, anon, authenticated;

-- Restringir listagem do bucket pedidos-anexos apenas para usuários autenticados
DROP POLICY IF EXISTS "Authenticated users can read pedidos-anexos" ON storage.objects;
CREATE POLICY "Authenticated users can read pedidos-anexos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pedidos-anexos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can upload pedidos-anexos" ON storage.objects;
CREATE POLICY "Authenticated users can upload pedidos-anexos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pedidos-anexos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete pedidos-anexos" ON storage.objects;
CREATE POLICY "Authenticated users can delete pedidos-anexos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pedidos-anexos' AND auth.uid() IS NOT NULL);