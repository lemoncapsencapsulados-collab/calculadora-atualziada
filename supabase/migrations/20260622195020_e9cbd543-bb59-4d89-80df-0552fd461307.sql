CREATE TYPE public.setup_plano_perfil AS ENUM ('novo_produtor', 'produtor_experiente');

CREATE TABLE public.setup_planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil public.setup_plano_perfil NOT NULL,
  nome TEXT NOT NULL,
  preco_fixo NUMERIC(15,2) NOT NULL DEFAULT 0,
  descricao_curta TEXT,
  entregaveis_md TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setup_planos TO authenticated;
GRANT SELECT ON public.setup_planos TO anon;
GRANT ALL ON public.setup_planos TO service_role;

ALTER TABLE public.setup_planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Setup planos selecionavel por todos" ON public.setup_planos FOR SELECT USING (true);
CREATE POLICY "Setup planos gerenciavel autenticados" ON public.setup_planos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Setup planos atualizavel autenticados" ON public.setup_planos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Setup planos deletavel autenticados" ON public.setup_planos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_setup_planos_updated_at BEFORE UPDATE ON public.setup_planos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.setup_planos (perfil, nome, preco_fixo, descricao_curta, entregaveis_md, ordem) VALUES
('novo_produtor', 'FAÇA VOCÊ MESMO', 1999.90, 'Você cuida da arte, nós da conformidade.',
'**Nossa responsabilidade (Lemon Caps):**
- Ficha Técnica com todos os dizeres/informações, juntamente com a faca do rótulo (Dimensões e posicionamento)
- Aprovação ou rejeição dos rótulos dando feedback do motivo em caso de rejeição, tudo para estar em Conformidade com a Anvisa

**Responsabilidade do Produtor:**
- Fazer toda a parte artística do Rótulo
- Trabalhar com ferramentas Vetorizadas (Corel e Illustrator) seguindo o guia da ficha técnica que vamos enviar
- Enviar no grupo do Produtor Faça Você Mesmo', 1),

('novo_produtor', 'START', 2999.90, 'Ideal para quem está começando, mas quer começar com clareza e estratégia.',
'- ✅ Criação de 1 Rótulo (Máximo de 3 pedidos de alterações por rótulo – pós isso custo de R$ 100,00 por alteração)
- ✅ Mockups 3D do Produto
- ✅ 1 Banner horizontal e 1 banner vertical do Checkout de plataforma de venda
- ✅ 1 Criativo Inicial do Produto', 2),

('novo_produtor', 'BRANDING', 7999.90, 'Para quem quer estruturar uma operação mais robusta e com visão de escala.',
'- ✅ Criação da Logomarca
- ✅ 2 Rótulos (Máximo de 3 pedidos de alterações por rótulo – pós isso custo de R$ 100,00 por alteração)
- ❌ Sem páginas de venda
- ✅ Mockups 3D do Produto
- ✅ 2 Banners horizontais e 2 banners verticais do Checkout de plataforma de venda
- ✅ 2 Criativos de Cada Produto

🤝 **1 Call Estratégica com o estrategista da Lemon Caps:**
- Diagnóstico mais profundo do negócio
- Definição de melhor modelo de venda
- Direcionamento de crescimento e escala', 3),

('novo_produtor', 'PREMIUM', 11999.90, 'Para quem quer estruturar uma operação mais robusta e com visão de escala.',
'- ✅ Criação de marca Guarda Chuva (Logomarca)
- ✅ 3 Rótulos (Máximo de 3 pedidos de alterações por rótulo – pós isso custo de R$ 100,00 por alteração)
- ✅ Até 3 Páginas de Venda
- ✅ Mockups 3D do Produto
- ✅ 3 Banners horizontais e 3 banners verticais do Checkout de plataforma de venda
- ✅ 2 Criativos de Cada Produto

🤝 **1 Call Estratégica com o estrategista da Lemon Caps:**
- Diagnóstico mais profundo do negócio
- Definição de melhor modelo de venda
- Direcionamento de crescimento e escala', 4);