-- Até onde o WhatsApp de cada consultor foi sincronizado.
--
-- Um zero no painel tem duas causas opostas: o consultor não atendeu, ou a
-- ingestão não trouxe o período. Sem esta data, as duas aparecem iguais -- e a
-- pesquisa do EVERTON em setembro/2026 mostrou "1 conversa" sem dizer que a
-- ingestão de mensagens parou em 01/09/2026. No mesmo painel, agosto dá 192
-- contatos para ele.
--
-- Por instância e não global de propósito: quando o WhatsApp de UM consultor
-- cai, o painel tem de acusar aquele consultor, não envelhecer a tela toda.
--
-- `left join` em zap_instancias porque instância sem cadastro existe: hoje há
-- mensagens e etiquetas de instâncias que ninguém amarrou a um usuário, e
-- deixá-las de fora esconderia exatamente o caso que precisa ser visto.
create or replace view public.zap_cobertura_sincronizacao
with (security_invoker = true) as
select
  m.instance_name,
  i.usuario_id,
  min(m.momento) as primeira_mensagem,
  max(m.momento) as ultima_mensagem,
  count(*)::bigint as mensagens
from public.zap_mensagens m
left join public.zap_instancias i on i.instance_name = m.instance_name
group by m.instance_name, i.usuario_id;

comment on view public.zap_cobertura_sincronizacao is
  'Primeira e última mensagem sincronizada por instância do WhatsApp. O painel usa a última data para separar "período sem dado" de "consultor sem atendimento".';

grant select on public.zap_cobertura_sincronizacao to authenticated;
