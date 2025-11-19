-- Criar tabela de configuração de custos fixos
CREATE TABLE IF NOT EXISTS public.configuracao_custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativa BOOLEAN DEFAULT true,
  senha_protecao TEXT NOT NULL DEFAULT 'admin123',
  
  -- Custos Indiretos (valores fixos por unidade)
  mao_obra_direta NUMERIC(15,6) DEFAULT 0.80,
  energia_eletrica NUMERIC(15,6) DEFAULT 0.00,
  depreciacao_maquinas NUMERIC(15,6) DEFAULT 1.00,
  despesas_administrativas NUMERIC(15,6) DEFAULT 1.45,
  
  -- Percentuais de Impostos
  icms_credito_nf NUMERIC(5,2) DEFAULT 7.00,
  icms_saida NUMERIC(5,2) DEFAULT 17.00,
  credito_prodeic NUMERIC(5,2) DEFAULT 80.00,
  fundeb_fundes NUMERIC(5,2) DEFAULT 7.00,
  
  pis_cofins_saida NUMERIC(5,2) DEFAULT 9.25,
  pis_cofins_credito NUMERIC(5,2) DEFAULT 9.25,
  
  ipi_saida NUMERIC(5,2) DEFAULT 0.00,
  
  irpj_csll NUMERIC(5,2) DEFAULT 33.00,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de margens de lucro por tipo de produto
CREATE TABLE IF NOT EXISTS public.margens_lucro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_produto TEXT NOT NULL UNIQUE,
  margem_ideal NUMERIC(5,2) NOT NULL,
  margem_minima NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de precificações realizadas
CREATE TABLE IF NOT EXISTS public.precificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES public.formulas(id) ON DELETE CASCADE,
  configuracao_custos_id UUID REFERENCES public.configuracao_custos(id),
  
  -- Custos Base (vindos da fórmula - snapshot)
  custo_materia_prima NUMERIC(15,6) NOT NULL,
  custo_embalagem NUMERIC(15,6) NOT NULL,
  
  -- Custos Indiretos (snapshot dos valores usados)
  custo_mao_obra_direta NUMERIC(15,6) NOT NULL,
  custo_energia NUMERIC(15,6) NOT NULL,
  custo_depreciacao NUMERIC(15,6) NOT NULL,
  custo_administrativo NUMERIC(15,6) NOT NULL,
  
  subtotal_custos_diretos NUMERIC(15,6) NOT NULL,
  subtotal_custos_indiretos NUMERIC(15,6) NOT NULL,
  total_custos_producao NUMERIC(15,6) NOT NULL,
  
  -- Impostos Calculados (snapshot)
  icms_credito_nf NUMERIC(15,6) NOT NULL,
  icms_saida NUMERIC(15,6) NOT NULL,
  icms_credito_prodeic NUMERIC(15,6) NOT NULL,
  fundeb_fundes NUMERIC(15,6) NOT NULL,
  icms_recolher NUMERIC(15,6) NOT NULL,
  
  pis_cofins_saida NUMERIC(15,6) NOT NULL,
  pis_cofins_credito NUMERIC(15,6) NOT NULL,
  pis_cofins_recolher NUMERIC(15,6) NOT NULL,
  
  ipi_valor NUMERIC(15,6) NOT NULL,
  
  base_calculo_irpj_csll NUMERIC(15,6) NOT NULL,
  irpj_csll_valor NUMERIC(15,6) NOT NULL,
  
  total_impostos NUMERIC(15,6) NOT NULL,
  
  -- Precificação
  preco_venda NUMERIC(15,6) NOT NULL,
  markup_bruto NUMERIC(5,2) NOT NULL,
  margem_lucro_percentual NUMERIC(5,2) NOT NULL,
  margem_lucro_valor NUMERIC(15,6) NOT NULL,
  
  -- Metadata
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO public.configuracao_custos (nome, ativa, senha_protecao)
VALUES ('Configuração Padrão 2024', true, 'admin123')
ON CONFLICT (nome) DO NOTHING;

-- Inserir margens padrão por tipo de produto
INSERT INTO public.margens_lucro (tipo_produto, margem_ideal, margem_minima) VALUES
  ('Encapsulados', 20.00, 8.00),
  ('Pó', 20.00, 8.00),
  ('Gummy', 30.00, 20.00),
  ('Líquido', 20.00, 8.00)
ON CONFLICT (tipo_produto) DO NOTHING;

-- Enable RLS
ALTER TABLE public.configuracao_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margens_lucro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precificacoes ENABLE ROW LEVEL SECURITY;

-- Create policies (mantendo consistência com tabelas existentes - acesso público)
CREATE POLICY "Permitir leitura pública de configuracao_custos"
  ON public.configuracao_custos FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública de configuracao_custos"
  ON public.configuracao_custos FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de configuracao_custos"
  ON public.configuracao_custos FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusão pública de configuracao_custos"
  ON public.configuracao_custos FOR DELETE USING (true);

CREATE POLICY "Permitir leitura pública de margens_lucro"
  ON public.margens_lucro FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública de margens_lucro"
  ON public.margens_lucro FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de margens_lucro"
  ON public.margens_lucro FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusão pública de margens_lucro"
  ON public.margens_lucro FOR DELETE USING (true);

CREATE POLICY "Permitir leitura pública de precificacoes"
  ON public.precificacoes FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública de precificacoes"
  ON public.precificacoes FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de precificacoes"
  ON public.precificacoes FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusão pública de precificacoes"
  ON public.precificacoes FOR DELETE USING (true);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_configuracao_custos_updated_at
  BEFORE UPDATE ON public.configuracao_custos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_precificacoes_updated_at
  BEFORE UPDATE ON public.precificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();