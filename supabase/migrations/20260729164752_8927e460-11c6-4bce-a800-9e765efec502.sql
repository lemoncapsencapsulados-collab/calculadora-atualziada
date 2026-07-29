ALTER TABLE public.demandas_marca REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas_marca;