
ALTER TABLE public.contrato_modelos
  ADD COLUMN IF NOT EXISTS docx_path text,
  ADD COLUMN IF NOT EXISTS docx_nome text,
  ADD COLUMN IF NOT EXISTS docx_size_bytes integer,
  ADD COLUMN IF NOT EXISTS variaveis jsonb DEFAULT '[]'::jsonb;

-- Permite usuários autenticados ler/escrever documentos modelo no bucket contratos sob 'modelos/'
DO $$ BEGIN
  CREATE POLICY "auth read contratos modelos"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = 'modelos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth write contratos modelos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'contratos' AND (storage.foldername(name))[1] = 'modelos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth update contratos modelos"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = 'modelos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth delete contratos modelos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = 'modelos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
