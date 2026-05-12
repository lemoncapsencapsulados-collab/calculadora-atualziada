ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pagamento_alteracoes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Authenticated update pedido_anexos ordem"
ON public.pedido_anexos
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);