
CREATE POLICY "modelos docx read" ON storage.objects FOR SELECT USING (bucket_id = 'contratos-modelos-docx');
CREATE POLICY "modelos docx insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contratos-modelos-docx');
CREATE POLICY "modelos docx update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contratos-modelos-docx');
CREATE POLICY "modelos docx delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contratos-modelos-docx');
