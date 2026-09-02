-- Coleta da Meta em nível de anúncio: tabelas, RLS e índices.
--
-- A decisão estrutural desta migração é a separação entre a tabela BASE e a de
-- RECORTES. A Meta devolve breakdown como um recorte independente do MESMO
-- gasto: as linhas de plataforma e as de idade descrevem o mesmo dinheiro sob
-- ângulos diferentes. Guardar tudo numa tabela só, ainda que com chave única
-- distinta, torna `sum(spend)` silenciosamente errado — dobra o investimento e
-- ninguém percebe até alguém conferir com o Gerenciador de Anúncios.
--
-- Por isso: `meta_insights_ad` é a única tabela somável, e existe sem breakdown
-- nenhum. Recorte mora em `meta_insights_ad_recorte`, em formato longo e com um
-- discriminador obrigatório, de modo que somar dois recortes exija escrever o
-- recorte na consulta — o erro fica visível em vez de silencioso.

-- ---------------------------------------------------------------------------
-- Base: um registro por anúncio/dia, sem breakdown. A única somável.
-- ---------------------------------------------------------------------------
create table if not exists public.meta_insights_ad (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  ad_id text not null,
  data date not null,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_name text,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric not null default 0,
  -- `actions` fica cru. Foi exatamente descartá-lo em `meta_insights` que
  -- impediu de responder "estes leads são de messaging ou de Pixel?" sem ter de
  -- chamar a API de novo. `leads` continua existindo como derivada de consulta,
  -- mas a evidência que a originou não se perde mais.
  actions jsonb,
  action_values jsonb,
  cost_per_action_type jsonb,
  leads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, ad_id, data)
);

-- ---------------------------------------------------------------------------
-- Recortes: formato longo. Nunca somar entre recortes diferentes.
-- ---------------------------------------------------------------------------
create table if not exists public.meta_insights_ad_recorte (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  ad_id text not null,
  data date not null,
  recorte text not null
    check (recorte in ('plataforma_posicionamento', 'idade_genero')),
  -- Formato longo em vez de coluna por dimensão: recorte novo vira linha, não
  -- migração. Vazio em vez de null porque a chave única não distingue nulos.
  chave_1 text not null default '',
  chave_2 text not null default '',
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  actions jsonb,
  created_at timestamptz not null default now(),
  unique (ad_account_id, ad_id, data, recorte, chave_1, chave_2)
);

-- ---------------------------------------------------------------------------
-- Criativos, com histórico de versão.
-- ---------------------------------------------------------------------------
-- Criativo muda no meio da campanha. Comparar desempenho exige saber qual texto
-- estava no ar em cada dia — senão a métrica de um período mistura duas copies
-- e a conclusão sobre "qual texto funciona" fica sem sentido.
create table if not exists public.meta_criativos (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  ad_id text not null,
  ad_name text,
  titulo text,
  corpo text,
  descricao text,
  cta text,
  url_destino text,
  image_url text,
  video_id text,
  object_story_spec jsonb,
  hash_conteudo text not null,
  vigente_desde date not null,
  vigente_ate date,   -- null = está no ar
  created_at timestamptz not null default now(),
  unique (ad_id, hash_conteudo)
);

-- ---------------------------------------------------------------------------
-- Fila de coleta, com checkpoint.
-- ---------------------------------------------------------------------------
-- Espelha `zap_backfill_jobs`. Não está aqui por escala — uma conta só não é
-- volume — e sim por retomada: sem checkpoint, uma falha transitória no meio do
-- backfill de 180 dias exigiria recomeço manual.
create table if not exists public.meta_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  passe text not null
    check (passe in ('base', 'criativo', 'plataforma', 'demografia')),
  janela_inicio date not null,
  janela_fim date not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'dlq')),
  tentativas integer not null default 0,
  ultimo_erro text,
  cursor_paginacao text,
  linhas_gravadas integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (ad_account_id, passe, janela_inicio, janela_fim)
);

-- Qual conta entra na coleta em nível de anúncio. Chave em dado, não em código:
-- "só a da Lemon Caps" precisa continuar verdadeiro daqui a seis meses, quando
-- alguém ativar outra conta sem ler comentário nenhum.
alter table public.meta_ad_accounts
  add column if not exists coletar_nivel_ad boolean not null default false;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_insights_ad_conta_data
  on public.meta_insights_ad (ad_account_id, data desc);
create index if not exists idx_insights_ad_campanha
  on public.meta_insights_ad (campaign_id, data desc);
create index if not exists idx_insights_ad_anuncio
  on public.meta_insights_ad (ad_id, data desc);
create index if not exists idx_recorte_conta_data
  on public.meta_insights_ad_recorte (ad_account_id, recorte, data desc);
create index if not exists idx_criativo_vigente
  on public.meta_criativos (ad_id, vigente_desde desc);
create index if not exists idx_sync_jobs_pendente
  on public.meta_sync_jobs (status, passe, atualizado_em)
  where status in ('pending', 'failed');

create trigger trg_insights_ad_updated
  before update on public.meta_insights_ad
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- A chamada a `has_role` vai embrulhada em subconsulta escalar. Como expressão
-- solta, o planejador a trata como filtro de linha e reavalia a função a cada
-- tupla; em `zap_mensagens` isso custou 63,8s contra 0,653s. O parêntese a
-- transforma em InitPlan: resolvida uma vez por consulta. A semântica não muda,
-- porque `has_role` é STABLE.
--
-- Só leitura para `authenticated`. Quem escreve é a coleta, pela service_role.
alter table public.meta_insights_ad         enable row level security;
alter table public.meta_insights_ad_recorte enable row level security;
alter table public.meta_criativos           enable row level security;
alter table public.meta_sync_jobs           enable row level security;

create policy "trafego le insights_ad" on public.meta_insights_ad
  for select to authenticated using ((select has_role('trafego'::app_role)));
create policy "trafego le recorte" on public.meta_insights_ad_recorte
  for select to authenticated using ((select has_role('trafego'::app_role)));
create policy "trafego le criativos" on public.meta_criativos
  for select to authenticated using ((select has_role('trafego'::app_role)));
create policy "trafego le jobs" on public.meta_sync_jobs
  for select to authenticated using ((select has_role('trafego'::app_role)));

grant select on public.meta_insights_ad         to authenticated;
grant select on public.meta_insights_ad_recorte to authenticated;
grant select on public.meta_criativos           to authenticated;
grant select on public.meta_sync_jobs           to authenticated;

grant all on public.meta_insights_ad         to service_role;
grant all on public.meta_insights_ad_recorte to service_role;
grant all on public.meta_criativos           to service_role;
grant all on public.meta_sync_jobs           to service_role;
