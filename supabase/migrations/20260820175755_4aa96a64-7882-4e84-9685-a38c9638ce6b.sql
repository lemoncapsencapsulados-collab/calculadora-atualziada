CREATE TABLE public.meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL UNIQUE,
  nome text,
  access_token text,
  token_expires_at timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage meta_ad_accounts" ON public.meta_ad_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_meta_ad_accounts_updated BEFORE UPDATE ON public.meta_ad_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meta_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id text NOT NULL,
  data date NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  consultor_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, data, campaign_id)
);
CREATE INDEX idx_meta_insights_data ON public.meta_insights (data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_insights TO authenticated;
GRANT ALL ON public.meta_insights TO service_role;
ALTER TABLE public.meta_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage meta_insights" ON public.meta_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_meta_insights_updated BEFORE UPDATE ON public.meta_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();