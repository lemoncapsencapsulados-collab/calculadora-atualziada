
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS id_receita_vhsys bigint,
  ADD COLUMN IF NOT EXISTS pedido_id_gerado uuid;

CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_id_receita_vhsys_uidx
  ON public.orcamentos(id_receita_vhsys)
  WHERE id_receita_vhsys IS NOT NULL;

CREATE INDEX IF NOT EXISTS orcamentos_status_idx ON public.orcamentos(status);

CREATE TABLE IF NOT EXISTS public.vhsys_eventos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL CHECK (origem IN ('webhook','polling','manual')),
  tipo_evento text NOT NULL,
  id_receita_vhsys bigint,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('sucesso','pendente','ignorado','erro')),
  mensagem text,
  payload jsonb,
  resposta_vhsys jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vhsys_eventos_log_created_at_idx ON public.vhsys_eventos_log(created_at DESC);
CREATE INDEX IF NOT EXISTS vhsys_eventos_log_status_idx ON public.vhsys_eventos_log(status);
CREATE INDEX IF NOT EXISTS vhsys_eventos_log_id_receita_idx ON public.vhsys_eventos_log(id_receita_vhsys);

GRANT SELECT ON public.vhsys_eventos_log TO authenticated;
GRANT ALL ON public.vhsys_eventos_log TO service_role;

ALTER TABLE public.vhsys_eventos_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vhsys logs"
  ON public.vhsys_eventos_log
  FOR SELECT
  TO authenticated
  USING (true);
