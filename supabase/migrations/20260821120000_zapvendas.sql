-- ZapVendas: papéis de acesso (user_roles) e instâncias da Evolution API (zap_instancias)

create type public.app_role as enum ('admin', 'zapvendas');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Cada usuário só pode ver os próprios papéis. Sem policy de INSERT/UPDATE/DELETE:
-- a gestão de papéis é feita via service_role (fora do alcance de RLS).
CREATE POLICY "usuario ve seus proprios papeis" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Helper SECURITY DEFINER: evita que as policies consultem user_roles diretamente
-- (o que causaria recursão de RLS). search_path vazio + referências totalmente
-- qualificadas (public.user_roles, auth.uid()) por segurança.
create or replace function public.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.user_roles
  where user_id = auth.uid() and role = _role
) $$;

-- public.usuarios é tabela de diretório, NÃO ligada a auth.users.
create table public.zap_instancias (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null unique,
  usuario_id uuid references public.usuarios(id) on delete set null,
  numero text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zap_instancias TO authenticated;
GRANT ALL ON public.zap_instancias TO service_role;

ALTER TABLE public.zap_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zapvendas gerencia instancias" ON public.zap_instancias
  FOR ALL TO authenticated
  USING (public.has_role('zapvendas'))
  WITH CHECK (public.has_role('zapvendas'));

CREATE TRIGGER trg_zap_instancias_updated
BEFORE UPDATE ON public.zap_instancias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: o ZapVendas expõe conversas de WhatsApp dos vendedores, então o acesso
-- fica restrito ao segundo administrador (joaoferrari@gmail.com). O login
-- compartilhado da equipe NÃO recebe o papel 'zapvendas'.
INSERT INTO public.user_roles (user_id, role) VALUES
  ('616bec17-a29b-4ec7-b4a1-417ea00da66f', 'zapvendas'),
  ('616bec17-a29b-4ec7-b4a1-417ea00da66f', 'admin')
ON CONFLICT DO NOTHING;
