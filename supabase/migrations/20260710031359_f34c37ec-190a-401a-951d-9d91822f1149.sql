
-- Webhook configs
CREATE TABLE public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  url text NOT NULL,
  eventos text[] NOT NULL DEFAULT '{}',
  secret text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_configs TO authenticated;
GRANT ALL ON public.webhook_configs TO service_role;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read webhook_configs" ON public.webhook_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write webhook_configs" ON public.webhook_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_webhook_configs_updated BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Webhook deliveries
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id uuid REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  evento text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  response_body text,
  error text,
  tentativas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_webhook_deliveries_created ON public.webhook_deliveries (created_at DESC);

-- API keys
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  permissoes text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read api_keys" ON public.api_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write api_keys" ON public.api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_api_keys_updated BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
