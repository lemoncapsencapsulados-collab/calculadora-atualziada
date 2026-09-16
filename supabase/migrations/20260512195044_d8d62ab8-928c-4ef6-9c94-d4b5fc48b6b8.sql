ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS historico_vhsys jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedidos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos';
  END IF;
END$$;