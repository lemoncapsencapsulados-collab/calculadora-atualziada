-- Agendamento e expurgo da coleta em nível de anúncio.
--
-- Mesmo desenho de `zap_agendar`: a migration define o COMO, e a service_role
-- key entra depois, por chamada, indo parar no vault. Chave em arquivo
-- versionado é vazamento garantido.
--
--   select public.trafego_agendar('<SERVICE_ROLE_KEY>');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Expurgo
-- ---------------------------------------------------------------------------
-- Retenção diferente por tabela porque o valor decai em ritmos diferentes: a
-- base sustenta leitura sazonal e cabe em 180 dias; os recortes são o volume e
-- servem para otimização recente, então 90 bastam.
create or replace function public.trafego_expurgar()
returns text
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_base integer;
  v_recorte integer;
  v_jobs integer;
begin
  delete from public.meta_insights_ad
   where data < (current_date - interval '180 days');
  get diagnostics v_base = row_count;

  delete from public.meta_insights_ad_recorte
   where data < (current_date - interval '90 days');
  get diagnostics v_recorte = row_count;

  -- Job concluído de janela já expurgada não serve para nada e só faz a fila
  -- crescer. Os que estão em `dlq` ficam: são evidência de falha a investigar.
  delete from public.meta_sync_jobs
   where status = 'done'
     and janela_fim < (current_date - interval '180 days');
  get diagnostics v_jobs = row_count;

  return format('base:%s recorte:%s jobs:%s', v_base, v_recorte, v_jobs);
end;
$funcao$;

revoke all on function public.trafego_expurgar() from public, authenticated, anon;
grant execute on function public.trafego_expurgar() to service_role;

-- ---------------------------------------------------------------------------
-- Agendamento
-- ---------------------------------------------------------------------------
create or replace function public.trafego_agendar(p_chave text)
returns text
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_url text := 'https://njfwoguvfozuaghufcgw.supabase.co/functions/v1/meta-sync-ads';
  v_existe boolean;
  v_cabecalho text;
begin
  if p_chave is null or length(trim(p_chave)) < 40 then
    raise exception 'chave inválida: informe a service_role key do projeto';
  end if;

  select exists (select 1 from vault.secrets where name = 'trafego_service_role_key')
    into v_existe;
  if v_existe then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'trafego_service_role_key'),
      p_chave, 'trafego_service_role_key', 'Cron de Funis de Tráfego Pago');
  else
    perform vault.create_secret(p_chave, 'trafego_service_role_key',
      'Cron de Funis de Tráfego Pago');
  end if;

  v_cabecalho :=
       'jsonb_build_object('
    ||   '''Content-Type'',''application/json'','
    ||   '''Authorization'',''Bearer ''||(select decrypted_secret from '
    ||   'vault.decrypted_secrets where name=''trafego_service_role_key''))';

  -- Drenar de 5 em 5 minutos. Com a fila vazia a função devolve sem trabalho e
  -- praticamente sem custo, então pode ficar agendada indefinidamente.
  perform cron.unschedule('trafego-drenar')
    where exists (select 1 from cron.job where jobname = 'trafego-drenar');
  perform cron.schedule('trafego-drenar', '*/5 * * * *', format(
    'select net.http_post(url := %L, headers := %s, body := %L::jsonb)',
    v_url, v_cabecalho, '{"action":"drenar"}'));

  -- Reabrir os últimos 10 dias todo dia não é desperdício: a janela de
  -- atribuição da Meta reescreve o passado recente, e sem reler, a página
  -- diverge do Gerenciador de forma permanente e inexplicável. Roda de
  -- madrugada, quando ninguém está olhando a tela.
  perform cron.unschedule('trafego-reabrir')
    where exists (select 1 from cron.job where jobname = 'trafego-reabrir');
  perform cron.schedule('trafego-reabrir', '20 6 * * *', format(
    'select net.http_post(url := %L, headers := %s, body := %L::jsonb)',
    v_url, v_cabecalho, '{"action":"reabrir","dias":10}'));

  -- Enfileirar o dia corrente, para a janela mais recente existir na fila.
  perform cron.unschedule('trafego-enfileirar')
    where exists (select 1 from cron.job where jobname = 'trafego-enfileirar');
  perform cron.schedule('trafego-enfileirar', '10 6 * * *', format(
    'select net.http_post(url := %L, headers := %s, body := %L::jsonb)',
    v_url, v_cabecalho, '{"action":"enfileirar"}'));

  perform cron.unschedule('trafego-expurgar')
    where exists (select 1 from cron.job where jobname = 'trafego-expurgar');
  perform cron.schedule('trafego-expurgar', '40 6 * * *',
    'select public.trafego_expurgar()');

  return 'agendado: trafego-drenar (5min), trafego-enfileirar, trafego-reabrir, trafego-expurgar';
end;
$funcao$;

revoke all on function public.trafego_agendar(text) from public, authenticated, anon;
grant execute on function public.trafego_agendar(text) to service_role;
