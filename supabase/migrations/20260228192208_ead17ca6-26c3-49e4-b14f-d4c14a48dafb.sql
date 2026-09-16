
-- Criar tabela de usuarios
CREATE TABLE public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Politicas publicas (mesmo padrao do projeto)
CREATE POLICY "Permitir leitura publica de usuarios"
ON public.usuarios FOR SELECT USING (true);

CREATE POLICY "Permitir insercao publica de usuarios"
ON public.usuarios FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualizacao publica de usuarios"
ON public.usuarios FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusao publica de usuarios"
ON public.usuarios FOR DELETE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
