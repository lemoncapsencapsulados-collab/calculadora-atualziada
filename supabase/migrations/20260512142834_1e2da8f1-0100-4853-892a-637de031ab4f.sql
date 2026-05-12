ALTER TABLE public.pedido_anexos ADD COLUMN IF NOT EXISTS ordem integer;
CREATE INDEX IF NOT EXISTS idx_pedido_anexos_pedido_tipo_ordem ON public.pedido_anexos(pedido_id, tipo, ordem);