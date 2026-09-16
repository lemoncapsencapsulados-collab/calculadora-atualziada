
-- Create storage bucket for order attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos-anexos', 'pedidos-anexos', true);

-- Storage policies for authenticated users
CREATE POLICY "Authenticated users can upload pedidos-anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pedidos-anexos');

CREATE POLICY "Authenticated users can read pedidos-anexos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pedidos-anexos');

CREATE POLICY "Authenticated users can delete pedidos-anexos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pedidos-anexos');

-- Create pedido_anexos table
CREATE TABLE public.pedido_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('contrato', 'comprovante')),
  arquivo_url text NOT NULL,
  arquivo_nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pedido_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select pedido_anexos"
ON public.pedido_anexos FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert pedido_anexos"
ON public.pedido_anexos FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete pedido_anexos"
ON public.pedido_anexos FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
