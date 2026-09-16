
CREATE TABLE public.contratos_zapsign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  zapsign_token text NOT NULL UNIQUE,
  zapsign_open_id text,
  template_id text,
  ambiente text NOT NULL DEFAULT 'producao' CHECK (ambiente IN ('producao','sandbox')),
  signer_name text,
  signer_email text,
  signer_phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','refused','expired')),
  signed_at timestamptz,
  signed_file_url text,
  signed_file_path text,
  webhook_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratos_zapsign_orcamento ON public.contratos_zapsign(orcamento_id);
CREATE INDEX idx_contratos_zapsign_pedido ON public.contratos_zapsign(pedido_id);
CREATE INDEX idx_contratos_zapsign_cliente ON public.contratos_zapsign(cliente_id);
CREATE INDEX idx_contratos_zapsign_status ON public.contratos_zapsign(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_zapsign TO authenticated;
GRANT ALL ON public.contratos_zapsign TO service_role;

ALTER TABLE public.contratos_zapsign ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_contratos_zapsign" ON public.contratos_zapsign FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_contratos_zapsign" ON public.contratos_zapsign FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_contratos_zapsign" ON public.contratos_zapsign FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_contratos_zapsign" ON public.contratos_zapsign FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_contratos_zapsign_updated_at
BEFORE UPDATE ON public.contratos_zapsign
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-anexa contrato assinado quando o pedido é criado a partir de um orçamento
CREATE OR REPLACE FUNCTION public.aplicar_contrato_assinado_em_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  IF NEW.orcamento_id IS NULL THEN
    RETURN NEW;
  END IF;
  FOR c IN
    SELECT * FROM public.contratos_zapsign
    WHERE orcamento_id = NEW.orcamento_id
      AND status = 'signed'
      AND signed_file_url IS NOT NULL
  LOOP
    -- Vincula o pedido
    UPDATE public.contratos_zapsign SET pedido_id = NEW.id WHERE id = c.id;
    -- Cria anexo do tipo contrato, se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_anexos
      WHERE pedido_id = NEW.id AND tipo = 'contrato' AND arquivo_url = c.signed_file_url
    ) THEN
      INSERT INTO public.pedido_anexos (pedido_id, tipo, arquivo_url, arquivo_nome)
      VALUES (NEW.id, 'contrato', c.signed_file_url, COALESCE('Contrato assinado - ' || c.signer_name, 'Contrato ZapSign') || '.pdf');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_contrato_assinado_em_pedido ON public.pedidos;
CREATE TRIGGER trg_aplicar_contrato_assinado_em_pedido
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.aplicar_contrato_assinado_em_pedido();
