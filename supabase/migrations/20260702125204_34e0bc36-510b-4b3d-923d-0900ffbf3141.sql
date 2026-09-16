
-- Tabela de registros de investimento em anúncios
CREATE TABLE public.ad_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  investimento_total numeric(15,2) NOT NULL CHECK (investimento_total >= 0),
  objetivo_campanha text NOT NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_investments TO authenticated;
GRANT ALL ON public.ad_investments TO service_role;
ALTER TABLE public.ad_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can read ad_investments" ON public.ad_investments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert ad_investments" ON public.ad_investments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can update ad_investments" ON public.ad_investments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can delete ad_investments" ON public.ad_investments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_ad_investments_updated_at
  BEFORE UPDATE ON public.ad_investments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ad_investments_periodo_idx ON public.ad_investments (data_inicio, data_fim);

-- Distribuição por consultor
CREATE TABLE public.ad_investment_consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_investment_id uuid NOT NULL REFERENCES public.ad_investments(id) ON DELETE CASCADE,
  consultor_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  consultor_nome_snapshot text NOT NULL,
  leads_recebidos integer NOT NULL DEFAULT 0 CHECK (leads_recebidos >= 0),
  investimento_direcionado numeric(15,2) NOT NULL DEFAULT 0 CHECK (investimento_direcionado >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_investment_id, consultor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_investment_consultores TO authenticated;
GRANT ALL ON public.ad_investment_consultores TO service_role;
ALTER TABLE public.ad_investment_consultores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can read aic" ON public.ad_investment_consultores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert aic" ON public.ad_investment_consultores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can update aic" ON public.ad_investment_consultores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can delete aic" ON public.ad_investment_consultores FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_aic_updated_at
  BEFORE UPDATE ON public.ad_investment_consultores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX aic_investment_idx ON public.ad_investment_consultores (ad_investment_id);
CREATE INDEX aic_consultor_idx ON public.ad_investment_consultores (consultor_id);
