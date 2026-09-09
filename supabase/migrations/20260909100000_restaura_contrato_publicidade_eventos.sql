-- Restaura `contrato_publicidade_eventos` a partir do backup de 09/09/2026.
--
-- ORIGEM: dump `pg_dump -Fc` do próprio projeto, tirado às 02:13 de 09/09. Ao
-- comparar dump e banco, esta era a ÚNICA tabela presente lá e ausente aqui —
-- as outras 14 diferenças eram tabelas que existem só no banco (ZapVendas,
-- tráfego pago em nível de anúncio, etiquetas), e por isso nada foi
-- sobrescrito: a restauração é aditiva.
--
-- RESSALVA HONESTA: nenhum arquivo do projeto referencia esta tabela hoje.
-- Ela é log de envio de contrato de publicidade pela ZapSign, e os 3 registros
-- que vêm junto são falhas de 31/08 por plano de API inativo. Restaurar não
-- religa funcionalidade nenhuma — devolve o histórico. Se a intenção for
-- reativar o fluxo, falta o código, não a tabela.
--
-- O que foi deliberadamente NÃO copiado do dump:
--   * `grant all ... to anon` — o RLS já barra anônimo, e o grant amplo só
--     existiria para confundir quem auditar depois.
--   * grants a `sandbox_exec*`, papéis que não existem neste projeto.

create table if not exists public.contrato_publicidade_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  contrato_id uuid,
  status text not null,
  mensagem text,
  usuario_email text,
  created_at timestamptz not null default now()
);

comment on table public.contrato_publicidade_eventos is
  'Log de envio de contrato de publicidade pela ZapSign. Restaurada do backup de 09/09/2026; sem código que a use no momento.';

create index if not exists idx_cpe_pedido
  on public.contrato_publicidade_eventos (pedido_id, created_at desc);

alter table public.contrato_publicidade_eventos enable row level security;

drop policy if exists auth_select_cpe on public.contrato_publicidade_eventos;
drop policy if exists auth_insert_cpe on public.contrato_publicidade_eventos;
drop policy if exists auth_delete_cpe on public.contrato_publicidade_eventos;

-- Subconsulta escalar em vez de chamada solta, padrão do projeto: como filtro
-- de linha, a função seria reavaliada tupla a tupla.
create policy auth_select_cpe on public.contrato_publicidade_eventos
  for select to authenticated using ((select auth.role()) = 'authenticated');
create policy auth_insert_cpe on public.contrato_publicidade_eventos
  for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy auth_delete_cpe on public.contrato_publicidade_eventos
  for delete to authenticated using ((select auth.role()) = 'authenticated');

grant select, insert, delete on public.contrato_publicidade_eventos to authenticated;
grant all on public.contrato_publicidade_eventos to service_role;

-- Os 3 registros do backup. `on conflict do nothing` para a migração poder ser
-- reaplicada sem duplicar.
insert into public.contrato_publicidade_eventos
  (id, pedido_id, contrato_id, status, mensagem, usuario_email, created_at)
values
  ('a8dc7e9f-9dad-4886-815c-f0859ced8179', '5c1af256-66b2-4d9f-b823-ff9e80602435', null, 'falha',
   'A conta ZapSign não possui Plano de API ativo para uso em produção. Ative o Plano de API no painel da ZapSign (Configurações → API) ou envie em ambiente de teste (sandbox). Detalhe da ZapSign: É obrigatório contratar um Plano de API para utilizá-la em modo produção.',
   'comercial@lemoncaps.com.br', '2026-08-31 01:07:34.61144+00'),
  ('92b7ae02-6795-4526-8150-1001d3052572', '5c1af256-66b2-4d9f-b823-ff9e80602435', null, 'falha',
   'ZapSign retornou 403: API token not found. More details here / Token da API não encontrado: https://docs.zapsign.com.br/english/authentication/autenticacao',
   'comercial@lemoncaps.com.br', '2026-08-31 01:07:53.263883+00'),
  ('1621cf16-534a-4c9b-9751-3cee77132004', '5c1af256-66b2-4d9f-b823-ff9e80602435', null, 'falha',
   'A conta ZapSign não possui Plano de API ativo para uso em produção. Ative o Plano de API no painel da ZapSign (Configurações → API) ou envie em ambiente de teste (sandbox). Detalhe da ZapSign: É obrigatório contratar um Plano de API para utilizá-la em modo produção.',
   'comercial@lemoncaps.com.br', '2026-08-31 01:07:59.576984+00')
on conflict (id) do nothing;
