
-- Tabela clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  tipo_pessoa text NOT NULL DEFAULT 'pf',
  razao_social text,
  cpf text,
  cnpj text,
  rg text,
  email text,
  endereco text,
  cep text,
  cidade text,
  estado text,
  estado_civil text,
  inscricao_estadual text,
  inscricao_municipal text,
  endereco_cnpj text,
  cep_cnpj text,
  cidade_cnpj text,
  estado_cnpj text,
  telefone_cnpj text,
  email_cnpj text,
  forma_venda text,
  responsavel_pj jsonb DEFAULT '{}',
  pessoas_fisicas jsonb DEFAULT '[]',
  dados_extras jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_clientes" ON public.clientes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_clientes" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_clientes" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Referências opcionais
ALTER TABLE public.formulas ADD COLUMN cliente_id uuid REFERENCES public.clientes(id);
ALTER TABLE public.orcamentos ADD COLUMN cliente_id uuid REFERENCES public.clientes(id);
