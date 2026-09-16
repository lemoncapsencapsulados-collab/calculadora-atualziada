-- Fecha o turno por TEMPO, não só por troca de remetente.
--
-- Bug observado com dados reais (instância EVERTON, 4.090 respostas): 8,8% dos
-- turnos se esticavam por mais de 1 hora, 129 passavam de 24h e o maior chegava
-- a 75,8 dias. A causa: o consultor manda follow-ups ao longo de semanas sem
-- resposta e, sendo todos do mesmo remetente, a versão anterior colapsava tudo
-- num único turno. O tempo de resposta passava então a ser contado a partir do
-- PRIMEIRO follow-up, não do último — inflando a cauda.
--
-- Impacto medido: a mediana não se movia (21min antes e depois, porque mediana
-- é robusta), mas o p90 do TMR1 variava entre 24,3h e 48,5h conforme a base, e
-- o máximo entre 3,1 e 10,2 dias. O p90 é justamente o indicador que mostra
-- quem está sendo abandonado, então distorcê-lo esvazia a métrica.
--
-- Uma hora é o limiar: três mensagens em dez minutos são um pensamento só; uma
-- mensagem uma hora depois da sua própria é uma nova tentativa de contato.
-- Ajustar este valor muda TMR1, tempo de resposta contínua e resposta do
-- cliente — é o parâmetro mais sensível de todo o cálculo.

create or replace view public.zap_turnos as
with marcado as (
  select
    instance_name, remote_jid, from_me, momento, id,
    case
      -- Trocou quem fala: turno novo, sempre.
      when lag(from_me) over w is distinct from from_me then 1
      -- Mesmo remetente, mas depois de um silêncio longo: nova tentativa,
      -- não continuação da rajada.
      when momento - lag(momento) over w > interval '1 hour' then 1
      else 0
    end as abre_turno
  from public.zap_mensagens
  window w as (partition by instance_name, remote_jid order by momento, id)
),
numerado as (
  select *,
    sum(abre_turno) over (
      partition by instance_name, remote_jid order by momento, id
      rows between unbounded preceding and current row
    ) as turno
  from marcado
)
select
  instance_name,
  remote_jid,
  turno,
  from_me,
  min(momento) as inicio,
  max(momento) as fim,
  count(*)::integer as mensagens
from numerado
group by instance_name, remote_jid, turno, from_me;

alter view public.zap_turnos set (security_invoker = true);
grant select on public.zap_turnos to authenticated;

-- `zap_respostas` continua exigindo que o turno anterior seja do OUTRO
-- interlocutor. Com o corte por tempo, dois turnos seguidos do consultor
-- (follow-ups) simplesmente não geram linha de resposta — que é o correto:
-- ninguém respondeu nada ali.
