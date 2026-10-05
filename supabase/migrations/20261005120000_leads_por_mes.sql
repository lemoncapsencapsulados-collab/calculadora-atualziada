-- Leads recebidos = conversas NOVAS no WhatsApp, por mês e por vendedor.
--
-- O funil é um formulário: o cliente preenche, deixa o WhatsApp, e a conversa
-- começa. Então o lead nasce na PRIMEIRA mensagem trocada com aquele número --
-- não quando o contato apareceu no nosso banco.
--
-- A diferença não é teórica. Os 2.259 contatos de `zap_contatos` têm
-- `created_at` em três dias só (31/08, 01/09 e 02/09): é a data em que a
-- sincronização rodou, não a data em que o cliente chegou. Contar por ali
-- colocava 1.377 leads num único dia de agosto e zero em todos os outros meses.
--
-- Agregar aqui, e não no navegador, porque são 66 mil mensagens: trazer tudo
-- para somar do lado do cliente levaria segundos e megabytes a cada abertura.
create or replace view public.zap_leads_por_mes
with (security_invoker = true) as
with primeira_mensagem as (
  select
    instance_name,
    remote_jid,
    min(momento) as inicio
  from public.zap_mensagens
  where remote_jid is not null
  group by instance_name, remote_jid
)
select
  instance_name,
  date_trunc('month', inicio)::date as mes,
  count(*)::int as leads
from primeira_mensagem
group by instance_name, date_trunc('month', inicio);

comment on view public.zap_leads_por_mes is
  'Conversas novas por mês e instância. O lead nasce na primeira mensagem trocada com o número, não quando o contato entrou no banco.';

grant select on public.zap_leads_por_mes to authenticated;
