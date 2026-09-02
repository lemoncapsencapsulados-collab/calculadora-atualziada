-- Agendamento automático do backfill e da semeadura do ZapVendas.
--
-- Por que uma função e não `cron.schedule` direto na migration: o job precisa
-- chamar a Edge Function autenticado, e isso exige a service_role key. Chave em
-- arquivo versionado é vazamento garantido — qualquer pessoa com acesso ao
-- repositório passa a ter acesso total ao banco.
--
-- Então a migration define o COMO, e a chave entra depois, por chamada:
--   select public.zap_agendar('<SERVICE_ROLE_KEY>');
--
-- A função é SECURITY DEFINER e só o service_role pode executá-la: um usuário
-- autenticado comum não consegue nem agendar jobs nem ler a chave de volta.
--
-- O que NÃO é agendado, de propósito: a análise por IA e a transcrição. As duas
-- gastam dinheiro por execução, e um cron que gasta sozinho é a forma mais fácil
-- de descobrir uma fatura inesperada. Continuam no botão da tela.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.zap_agendar(p_chave text)
returns text
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_url text := 'https://njfwoguvfozuaghufcgw.supabase.co/functions/v1/';
  v_existe boolean;
  v_comando text;
begin
  if p_chave is null or length(trim(p_chave)) < 40 then
    raise exception 'chave inválida: informe a service_role key do projeto';
  end if;

  -- O vault recusa nome duplicado, então atualiza quando já existe. Sem isto,
  -- reagendar depois de trocar a chave falharia com um erro pouco óbvio.
  select exists (select 1 from vault.secrets where name = 'zap_service_role_key')
    into v_existe;
  if v_existe then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'zap_service_role_key'),
      p_chave, 'zap_service_role_key', 'Cron do ZapVendas');
  else
    perform vault.create_secret(p_chave, 'zap_service_role_key', 'Cron do ZapVendas');
  end if;

  -- Montado com format() em vez de dollar-quoting aninhado: o corpo do job já
  -- contém aspas e cifrões, e aninhar $$ dentro de $$ quebra o parser.
  v_comando := format(
    'select net.http_post('
    || 'url := %L, '
    || 'headers := jsonb_build_object('
    ||   '''Content-Type'',''application/json'','
    ||   '''Authorization'',''Bearer ''||(select decrypted_secret from vault.decrypted_secrets where name=''zap_service_role_key'')), '
    || 'body := %L::jsonb)',
    v_url || 'zap-backfill', '{}');

  -- A cada 2 minutos. Quando a fila esvazia a função retorna sem trabalho e
  -- praticamente sem custo, então pode ficar agendada indefinidamente.
  perform cron.unschedule('zap-backfill') where exists (
    select 1 from cron.job where jobname = 'zap-backfill');
  perform cron.schedule('zap-backfill', '*/2 * * * *', v_comando);

  -- Semeadura diária às 6h UTC (3h de Brasília): descobre conversas novas que
  -- não passaram pelo webhook. Fora do horário de pico para não competir com o
  -- atendimento pela API da Evolution.
  v_comando := format(
    'select net.http_post('
    || 'url := %L, '
    || 'headers := jsonb_build_object('
    ||   '''Content-Type'',''application/json'','
    ||   '''Authorization'',''Bearer ''||(select decrypted_secret from vault.decrypted_secrets where name=''zap_service_role_key'')), '
    || 'body := %L::jsonb)',
    v_url || 'zap-backfill', '{"acao":"semear"}');

  perform cron.unschedule('zap-semear') where exists (
    select 1 from cron.job where jobname = 'zap-semear');
  perform cron.schedule('zap-semear', '0 6 * * *', v_comando);

  return 'agendado: zap-backfill (*/2 * * * *) e zap-semear (0 6 * * *)';
end
$funcao$;

-- Só o service_role. Um usuário autenticado do painel não pode agendar jobs
-- nem usar esta função para gravar segredos.
revoke all on function public.zap_agendar(text) from public;
revoke all on function public.zap_agendar(text) from authenticated;
grant execute on function public.zap_agendar(text) to service_role;

-- Leitura do estado dos jobs, para o painel poder dizer se a ingestão está viva.
create or replace function public.zap_cron_status()
returns table (jobname text, schedule text, ativo boolean, ultima_execucao timestamptz, ultimo_status text)
language sql
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text, j.active,
         d.end_time, d.status::text
  from cron.job j
  left join lateral (
    select end_time, status from cron.job_run_details d
    where d.jobid = j.jobid order by d.start_time desc limit 1
  ) d on true
  where j.jobname like 'zap-%';
$$;

grant execute on function public.zap_cron_status() to authenticated;
