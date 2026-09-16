-- Mês com mais atendimento, para a tela abrir onde há o que ver.
--
-- A tela abria no mês corrente. No dia 1º de setembro isso significou abrir num
-- mês com UMA conversa (registrada 00:17), enquanto agosto tinha 800 já
-- analisadas ao lado. Quem abre o painel conclui que o sistema perdeu tudo.
--
-- "Último mês com dados" não resolve: aquela única mensagem das 00:17 faz
-- setembro qualificar. O que a pessoa quer é o mês onde houve trabalho.
--
-- Conta CONVERSAS distintas, não mensagens: um único contato muito falante não
-- deve fazer um mês parado parecer movimentado.
create or replace function public.zap_mes_mais_movimentado()
returns text
language sql
stable
as $$
  select to_char(mes, 'YYYY-MM')
  from (
    select date_trunc('month', m.momento at time zone 'America/Sao_Paulo') as mes,
           count(distinct (m.instance_name, m.remote_jid)) as conversas
    from public.zap_mensagens m
    join public.zap_instancias i
      on i.instance_name = m.instance_name and i.usuario_id is not null
    group by 1
  ) x
  order by conversas desc, mes desc
  limit 1;
$$;

grant execute on function public.zap_mes_mais_movimentado() to authenticated;
