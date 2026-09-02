-- Apresentações versionadas (§8.1).
--
-- Imutável por desenho: gerar de novo cria v2 em vez de reescrever a v1.
-- Comparação mês a mês só é confiável se ninguém puder reescrever o passado —
-- se o relatório de julho for editável, o delta contra agosto vira ficção.
--
-- `payload_json` guarda o objeto completo de métricas E o texto gerado. É o que
-- permite re-renderizar PDF e slides quantas vezes quiser sem gastar IA de novo:
-- a geração custa centavos uma vez, a re-renderização custa zero.

create table if not exists public.zap_apresentacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  consultor_nome text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  gerado_em timestamptz not null default now(),
  gerado_por uuid,
  -- Incremental por consultor+período, atribuído na inserção.
  versao integer not null,
  versao_prompt integer not null default 1,
  base_conversas integer not null default 0,
  cobertura_analise_pct numeric,
  cobertura_transcricao_pct numeric,
  score_geral numeric,
  payload_json jsonb not null,
  custo_analise_usd numeric,
  -- Números citados no texto que não existem em `metrics` (§10). Vazio é o
  -- estado saudável; não-vazio marca a apresentação como suspeita na listagem.
  validacao_orfaos text[] not null default '{}',
  status text not null default 'ok' check (status in ('ok','com_alerta','erro')),
  unique (usuario_id, periodo_inicio, periodo_fim, versao)
);

create index if not exists idx_zap_apresentacoes_consultor
  on public.zap_apresentacoes (usuario_id, periodo_inicio desc, versao desc);

grant select on public.zap_apresentacoes to authenticated;
grant all on public.zap_apresentacoes to service_role;
alter table public.zap_apresentacoes enable row level security;

drop policy if exists "zapvendas le apresentacoes" on public.zap_apresentacoes;
create policy "zapvendas le apresentacoes" on public.zap_apresentacoes
  for select to authenticated using (public.has_role('zapvendas'));

-- Próxima versão para um consultor+período. Concentrado aqui porque calcular
-- no cliente abriria corrida entre duas gerações simultâneas.
create or replace function public.zap_proxima_versao(
  p_usuario_id uuid,
  p_inicio date,
  p_fim date
)
returns integer
language sql
stable
as $$
  select coalesce(max(versao), 0) + 1
  from public.zap_apresentacoes
  where usuario_id = p_usuario_id
    and periodo_inicio = p_inicio and periodo_fim = p_fim;
$$;

grant execute on function public.zap_proxima_versao(uuid, date, date) to authenticated;
