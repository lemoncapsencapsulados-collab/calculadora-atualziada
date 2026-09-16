-- ZapVendas Inteligência: ingestão de conversas, métricas de atendimento e
-- análise por IA.
--
-- Contexto: até aqui o ZapVendas só proxyava a Evolution ao vivo (`zap_instancias`
-- era a única tabela). Nada era persistido, então nenhuma métrica histórica era
-- possível. Estas tabelas são o acervo que torna o painel viável.
--
-- Duas portas escrevem em `zap_mensagens` — o webhook (mensagem nova) e o
-- backfill (histórico) — e elas se cruzam. Por isso toda escrita é upsert pela
-- chave da Evolution: rodar as duas ao mesmo tempo nunca duplica.

-- ---------------------------------------------------------------------------
-- Contatos (o "cliente/produtor" de cada conversa)
-- ---------------------------------------------------------------------------
-- O consultor dono NÃO é coluna aqui: ele vem de `zap_instancias.usuario_id`
-- via `instance_name`. Desnormalizar criaria duas fontes de verdade para
-- "de quem é este contato", e elas divergiriam na primeira troca de vendedor.
create table if not exists public.zap_contatos (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  nome text,
  telefone text,
  primeira_mensagem_at timestamptz,
  ultima_mensagem_at timestamptz,
  total_mensagens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_name, remote_jid)
);

-- ---------------------------------------------------------------------------
-- Mensagens
-- ---------------------------------------------------------------------------
-- Sem binário de mídia: só tipo, duração e (para áudio) a transcrição. Áudio e
-- imagem continuam vindo da Evolution sob demanda. Guardar os binários
-- multiplicaria o tamanho e ampliaria a exposição de dado sensível sem
-- servir a nenhuma métrica.
--
-- PK composta (instance_name, id): o `key.id` da Evolution é único dentro da
-- instância, não globalmente.
create table if not exists public.zap_mensagens (
  instance_name text not null,
  id text not null,
  remote_jid text not null,
  from_me boolean not null,
  momento timestamptz not null,
  tipo text not null check (tipo in ('texto','audio','imagem','video','documento','outro')),
  texto text,
  duracao_segundos integer,
  transcrito_em timestamptz,
  -- Por que um status e não só `transcrito_em`: boa parte do áudio histórico é
  -- IRRECUPERÁVEL. Esta Evolution roda com S3_ENABLED=false e a URL de mídia do
  -- WhatsApp expira em ~14-30 dias, então áudio antigo não pode ser baixado nem
  -- transcrito — nunca. Sem distinguir 'midia_expirada' de 'sem_fala' e de
  -- 'erro', a fila tentaria para sempre e o painel não saberia dizer que a
  -- análise daquele período tem buracos.
  transcricao_status text check (transcricao_status in ('ok','sem_fala','midia_expirada','erro')),
  dominios_links text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (instance_name, id)
);

-- Índice que sustenta o cálculo de turnos: a varredura é sempre
-- "toda a conversa, em ordem cronológica".
create index if not exists idx_zap_mensagens_conversa
  on public.zap_mensagens (instance_name, remote_jid, momento);

-- Fila implícita de transcrição: áudio sem transcrição ainda. Índice parcial
-- para o consumidor não varrer a tabela inteira a cada rodada.
create index if not exists idx_zap_mensagens_audio_pendente
  on public.zap_mensagens (instance_name, remote_jid)
  where tipo = 'audio' and transcrito_em is null;

-- ---------------------------------------------------------------------------
-- Fila de backfill (uma linha por conversa)
-- ---------------------------------------------------------------------------
-- Mesma máquina de estados do `email_send_log`, pelo mesmo motivo: a Edge
-- Function tem limite de execução e o histórico de 1 ano não cabe numa
-- invocação. O cursor deixa cada rodada retomar de onde a anterior parou.
create table if not exists public.zap_backfill_jobs (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','dlq')),
  -- Última página do findMessages já importada nesta conversa. É o checkpoint
  -- que permite retomar: sem ele, cada rodada recomeçaria da página 1 e uma
  -- conversa maior que o teto de páginas por rodada nunca terminaria de entrar.
  ultima_pagina integer not null default 0,
  tentativas integer not null default 0,
  ultimo_erro text,
  mensagens_importadas integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (instance_name, remote_jid)
);

create index if not exists idx_zap_backfill_pendente
  on public.zap_backfill_jobs (status, atualizado_em)
  where status in ('pending','failed');

-- ---------------------------------------------------------------------------
-- Análise por conversa (camada 1 da IA)
-- ---------------------------------------------------------------------------
-- `analisado_ate` evita reanalisar conversa parada; `versao_prompt` permite
-- reanálise deliberada quando o prompt melhorar, sem perder o histórico do
-- que a versão anterior concluiu.
create table if not exists public.zap_conversa_analise (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  versao_prompt integer not null,
  analisado_ate timestamptz not null,
  sentimento text check (sentimento in ('positivo','neutro','negativo')),
  objecoes text[] not null default '{}',
  objecoes_superadas text[] not null default '{}',
  etapa_funil text check (etapa_funil in
    ('sem_resposta','em_conversa','catalogo_enviado','meeting_agendada','proposta','fechado','perdido')),
  resumo text,
  tokens_entrada integer,
  tokens_saida integer,
  created_at timestamptz not null default now(),
  unique (instance_name, remote_jid, versao_prompt)
);

-- ---------------------------------------------------------------------------
-- Parecer por consultor (camada 2 da IA)
-- ---------------------------------------------------------------------------
-- Roda sobre os agregados das análises acima, NUNCA sobre o texto cru. É o que
-- torna "analisar tudo" sustentável: o texto é lido uma vez, na camada 1.
create table if not exists public.zap_consultor_parecer (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  versao_prompt integer not null,
  eficiencia text,
  processo text,
  relacionamento text,
  plano_acao text,
  metricas jsonb,
  created_at timestamptz not null default now(),
  unique (usuario_id, periodo_inicio, periodo_fim, versao_prompt)
);

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------
-- Herda a restrição do `zap_instancias`: papel 'zapvendas'. A migration
-- original travou o ZapVendas num único admin justamente porque expõe conversa
-- de vendedor; um painel que pontua consultor por consultor não afrouxa isso.
-- Escrita é exclusiva do service_role (webhook, backfill e jobs de IA) — o
-- front só lê.
do $$
declare t text;
begin
  foreach t in array array[
    'zap_contatos','zap_mensagens','zap_backfill_jobs',
    'zap_conversa_analise','zap_consultor_parecer'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    -- Idempotente como o resto da migration: sem o drop, reaplicar o arquivo
    -- (ou retomar um `db push` que falhou no meio) aborta aqui.
    execute format('drop policy if exists "zapvendas le %1$s" on public.%1$I', t);
    execute format(
      'create policy "zapvendas le %1$s" on public.%1$I '
      'for select to authenticated using (public.has_role(''zapvendas''))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Turnos: a base de todo cálculo de tempo
-- ---------------------------------------------------------------------------
-- Ninguém manda uma mensagem por vez no WhatsApp — manda três seguidas e
-- espera. Medir resposta mensagem a mensagem faria os intervalos de 4 segundos
-- entre as três dominarem a estatística, e o KPI viraria ficção. Esta view
-- colapsa mensagens consecutivas do mesmo remetente num turno; todo tempo de
-- resposta é medido ENTRE turnos.
create or replace view public.zap_turnos as
with marcado as (
  select
    -- `id` entra no desempate da ordenação: duas mensagens podem ter o mesmo
    -- `momento` (a Evolution tem precisão de segundo), e sem desempate estável
    -- a numeração de turnos ficaria não-determinística entre execuções.
    instance_name, remote_jid, from_me, momento, id,
    case
      when lag(from_me) over (
        partition by instance_name, remote_jid order by momento, id
      ) is distinct from from_me then 1 else 0
    end as abre_turno
  from public.zap_mensagens
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

-- ---------------------------------------------------------------------------
-- Tempos de resposta, turno a turno
-- ---------------------------------------------------------------------------
-- Relógio corrido 24/7 (decisão do produto): o tempo conta do fim do turno de
-- quem falou até o início da resposta, sem congelar fora do expediente.
-- `hora_chegada` existe para separar "consultor lento" de "lead que caiu às 3h"
-- na hora de ler o número.
create or replace view public.zap_respostas as
select
  t.instance_name,
  t.remote_jid,
  t.turno,
  t.from_me as respondeu_consultor,
  t.inicio as respondido_em,
  -- Duas bases, porque as métricas medem coisas diferentes:
  -- `segundos` conta do FIM da rajada anterior — é o tempo que o consultor
  -- teve para reagir, e é justo com ele (não dá para responder no meio da fala
  -- do cliente). Usado no tempo de resposta contínua.
  -- `segundos_desde_inicio` conta do INÍCIO da rajada — é quanto o cliente
  -- esperou desde que falou. É a definição de TMR1: "entrada do lead até a
  -- primeira resposta".
  extract(epoch from (t.inicio - anterior.fim))::numeric as segundos,
  extract(epoch from (t.inicio - anterior.inicio))::numeric as segundos_desde_inicio,
  extract(hour from anterior.fim)::integer as hora_chegada,
  anterior.turno = 1 as e_primeira_resposta
from public.zap_turnos t
join public.zap_turnos anterior
  on anterior.instance_name = t.instance_name
 and anterior.remote_jid = t.remote_jid
 and anterior.turno = t.turno - 1
where anterior.from_me is distinct from t.from_me;

-- View no Postgres executa com o privilégio do DONO por padrão, o que faria
-- estas duas contornarem o RLS das tabelas de baixo e expor conversa a quem
-- não tem o papel. `security_invoker` faz a view rodar como quem consulta.
alter view public.zap_turnos set (security_invoker = true);
alter view public.zap_respostas set (security_invoker = true);

grant select on public.zap_turnos to authenticated;
grant select on public.zap_respostas to authenticated;

-- ---------------------------------------------------------------------------
-- Métricas por consultor
-- ---------------------------------------------------------------------------
-- Função e não view porque o painel filtra por período, e view não recebe
-- parâmetro. `security invoker` (padrão) mantém o RLS valendo.
--
-- Mediana e p90 em vez de média: um consultor que responde em 2 minutos noventa
-- vezes e some por três dias uma vez tem média péssima e mediana ótima. A média
-- mede o pior dia dele; a mediana mede o comportamento. O p90 ao lado mostra com
-- que frequência ele abandona alguém.
--
-- TMR1 e vácuo inicial medem conversas OPOSTAS e por isso têm denominadores
-- diferentes, ambos devolvidos: TMR1 só existe quando o cliente iniciou (o caso
-- comum, já que as campanhas são Meta Ads → WhatsApp); vácuo inicial só existe
-- quando o consultor iniciou (prospecção ativa). Comparar consultores sem olhar
-- o denominador compara bases de tamanhos diferentes.
create or replace function public.zap_metricas_consultor(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  usuario_id uuid,
  consultor text,
  contatos integer,
  contatos_cliente_iniciou integer,
  contatos_consultor_iniciou integer,
  -- Etapas 2 e 3 do funil de atendimento. Determinísticas: não dependem da IA.
  contatos_com_msg_consultor integer,
  contatos_com_resposta_cliente integer,
  tmr1_mediana_seg numeric,
  tmr1_p90_seg numeric,
  resposta_continua_mediana_seg numeric,
  resposta_continua_p90_seg numeric,
  resposta_cliente_mediana_seg numeric,
  vacuo_inicial_pct numeric,
  audios_enviados integer,
  videos_enviados integer,
  contatos_com_link integer
)
language sql
stable
as $$
  -- Quem abriu a conversa e quantos turnos ela teve NO TOTAL — apurados sobre a
  -- conversa inteira, nunca sobre a janela. Uma conversa que começou em maio e
  -- segue ativa em agosto tem o turno 1 fora do período: se a abertura fosse
  -- lida só dentro da janela, ela não contaria como iniciada por ninguém, e
  -- `contatos` deixaria de bater com a soma das suas partes — o tipo de furo
  -- que faz quem lê o painel parar de confiar nele.
  with conversas as (
    select
      i.usuario_id,
      u.nome as consultor,
      t.instance_name,
      t.remote_jid,
      -- Quem abriu a conversa define qual métrica se aplica.
      bool_or(t.turno = 1 and not t.from_me) as cliente_iniciou,
      bool_or(t.turno = 1 and t.from_me) as consultor_iniciou,
      bool_or(t.from_me) as consultor_falou,
      bool_or(not t.from_me) as cliente_falou,
      max(t.turno) as ultimo_turno
    from public.zap_turnos t
    join public.zap_instancias i on i.instance_name = t.instance_name
    join public.usuarios u on u.id = i.usuario_id
    where t.inicio >= p_inicio and t.inicio <= p_fim
    group by i.usuario_id, u.nome, t.instance_name, t.remote_jid
  ),
  respostas as (
    select c.usuario_id, r.*
    from public.zap_respostas r
    join conversas c
      on c.instance_name = r.instance_name and c.remote_jid = r.remote_jid
    where r.respondido_em >= p_inicio and r.respondido_em <= p_fim
  ),
  midia as (
    select
      c.usuario_id,
      count(*) filter (where m.tipo = 'audio' and m.from_me)::integer as audios,
      count(*) filter (where m.tipo = 'video' and m.from_me)::integer as videos,
      count(distinct m.remote_jid) filter (
        where m.from_me and cardinality(m.dominios_links) > 0
      )::integer as com_link
    from public.zap_mensagens m
    join conversas c
      on c.instance_name = m.instance_name and c.remote_jid = m.remote_jid
    where m.momento >= p_inicio and m.momento <= p_fim
    group by c.usuario_id
  )
  select
    c.usuario_id,
    min(c.consultor) as consultor,
    count(*)::integer as contatos,
    count(*) filter (where c.cliente_iniciou)::integer,
    count(*) filter (where c.consultor_iniciou)::integer,
    count(*) filter (where c.consultor_falou)::integer,
    count(*) filter (where c.cliente_falou and c.consultor_falou)::integer,
    (select percentile_cont(0.5) within group (order by r.segundos_desde_inicio)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and r.e_primeira_resposta),
    (select percentile_cont(0.9) within group (order by r.segundos_desde_inicio)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and r.e_primeira_resposta),
    (select percentile_cont(0.5) within group (order by r.segundos)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and not r.e_primeira_resposta),
    (select percentile_cont(0.9) within group (order by r.segundos)
       from respostas r where r.usuario_id = c.usuario_id
        and r.respondeu_consultor and not r.e_primeira_resposta),
    (select percentile_cont(0.5) within group (order by r.segundos)
       from respostas r where r.usuario_id = c.usuario_id
        and not r.respondeu_consultor),
    -- Vácuo inicial: consultor abordou e a conversa nunca passou do 1º turno.
    case
      when count(*) filter (where c.consultor_iniciou) = 0 then null
      else round(
        100.0 * count(*) filter (where c.consultor_iniciou and c.ultimo_turno = 1)
              / count(*) filter (where c.consultor_iniciou), 1)
    end,
    coalesce(max(md.audios), 0),
    coalesce(max(md.videos), 0),
    coalesce(max(md.com_link), 0)
  from conversas c
  left join midia md on md.usuario_id = c.usuario_id
  group by c.usuario_id;
$$;

grant execute on function public.zap_metricas_consultor(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Seleção de conversas que precisam de análise
-- ---------------------------------------------------------------------------
-- Em SQL e não no job porque o filtro é um anti-join sobre duas tabelas grandes:
-- resolver isso no cliente exigiria trazer todas as conversas e todas as
-- análises para a Edge Function e cruzar em memória.
--
-- Uma conversa entra na fila quando nunca foi analisada NA VERSÃO ATUAL do
-- prompt, ou quando recebeu mensagem depois da última análise. É o que faz
-- "analisar tudo" custar uma vez em vez de a cada abertura de tela.
create or replace function public.zap_conversas_para_analisar(
  p_versao integer,
  p_limite integer default 50
)
returns table (
  instance_name text,
  remote_jid text,
  ultima_mensagem timestamptz,
  mensagens bigint
)
language sql
stable
as $$
  select
    m.instance_name,
    m.remote_jid,
    max(m.momento) as ultima_mensagem,
    count(*) as mensagens
  from public.zap_mensagens m
  left join public.zap_conversa_analise a
    on a.instance_name = m.instance_name
   and a.remote_jid = m.remote_jid
   and a.versao_prompt = p_versao
  group by m.instance_name, m.remote_jid, a.analisado_ate
  -- Os parênteses NÃO são decorativos: `and` liga mais forte que `or`, e sem
  -- eles a condição vira "nunca analisada OU (mudou E tem 3+)", deixando toda
  -- conversa nova passar sem o filtro de tamanho.
  having (a.analisado_ate is null or max(m.momento) > a.analisado_ate)
  -- Conversa com 1 ou 2 mensagens não sustenta diagnóstico e gastaria uma
  -- chamada de IA para dizer "sem informação". O vácuo inicial dessas já é
  -- capturado pela camada determinística, de graça.
  and count(*) >= 3
  order by max(m.momento) desc
  limit p_limite;
$$;

grant execute on function public.zap_conversas_para_analisar(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- AGENDAMENTO (passo manual — NÃO roda nesta migration)
-- ---------------------------------------------------------------------------
-- Mesma convenção do `email_infra.sql`: o cron não entra na migration porque
-- precisa da service_role key, e chave não se versiona em arquivo de migração.
-- Rode o bloco abaixo uma vez no SQL Editor, com a chave real.
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'zap_service_role_key');
--
--   -- Backfill: a cada 2 min. Some sozinho quando a fila esvazia (a função
--   -- retorna sem trabalho), então pode ficar agendado indefinidamente.
--   select cron.schedule('zap-backfill', '*/2 * * * *', $cron$
--     select net.http_post(
--       url := '<SUPABASE_URL>/functions/v1/zap-backfill',
--       headers := jsonb_build_object(
--         'Content-Type','application/json',
--         'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='zap_service_role_key')),
--       body := '{}'::jsonb);
--   $cron$);
--
--   -- Transcrição: a cada 5 min. GASTA DINHEIRO a cada rodada — deixe
--   -- desagendado até aprovar o volume (veja `zap_custo_estimado` abaixo).
--   select cron.schedule('zap-transcrever', '*/5 * * * *', $cron$ ... $cron$);
--
--   -- Análise: a cada 10 min. Também gasta, mas ~10x menos que a transcrição.
--   select cron.schedule('zap-analisar', '*/10 * * * *', $cron$ ... $cron$);
--
-- Para reverter: select cron.unschedule('zap-backfill');  (idem os outros)

-- ---------------------------------------------------------------------------
-- Custo estimado antes de gastar
-- ---------------------------------------------------------------------------
-- Existe para você aprovar o gasto com o número real na tela, em vez de
-- descobrir a conta depois. Preços do Gemini 2.5 Flash (tier pago, ago/2026):
-- áudio $1,00/1M tokens de entrada a 32 tokens/segundo; saída $2,50/1M.
create or replace function public.zap_custo_estimado()
returns table (
  audios_pendentes bigint,
  minutos_pendentes numeric,
  audios_expirados bigint,
  custo_transcricao_usd numeric,
  conversas_para_analisar bigint
)
language sql
stable
as $$
  select
    count(*) filter (where transcrito_em is null),
    round(coalesce(sum(duracao_segundos) filter (where transcrito_em is null), 0) / 60.0, 1),
    count(*) filter (where transcricao_status = 'midia_expirada'),
    round((
      -- Entrada: 32 tokens por segundo de áudio a $1,00/1M.
      coalesce(sum(duracao_segundos) filter (where transcrito_em is null), 0) * 32 / 1000000.0 * 1.00
      -- Saída: ~150 palavras/min de fala, ~1,3 token por palavra, a $2,50/1M.
      + coalesce(sum(duracao_segundos) filter (where transcrito_em is null), 0) / 60.0 * 150 * 1.3 / 1000000.0 * 2.50
    )::numeric, 2),
    (select count(*) from public.zap_conversas_para_analisar(1, 100000))
  from public.zap_mensagens
  where tipo = 'audio';
$$;

grant execute on function public.zap_custo_estimado() to authenticated;

-- ---------------------------------------------------------------------------
-- Pivô das análises por consultor (alimenta a matriz de sentimento e o funil)
-- ---------------------------------------------------------------------------
-- Uma linha por (consultor, etapa, sentimento). O cliente pivota como precisar;
-- devolver assim evita uma função nova a cada corte que o painel quiser fazer.
create or replace function public.zap_analise_consultor(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_versao integer default 1
)
returns table (
  usuario_id uuid,
  etapa_funil text,
  sentimento text,
  conversas bigint
)
language sql
stable
as $$
  select i.usuario_id, a.etapa_funil, a.sentimento, count(*)
  from public.zap_conversa_analise a
  join public.zap_instancias i on i.instance_name = a.instance_name
  where a.versao_prompt = p_versao
  -- Recorte por `analisado_ate` (última mensagem que a análise enxergou). É uma
  -- aproximação da "conversa ativa no período": o exato exigiria rejuntar com
  -- zap_mensagens, e a diferença só aparece em conversa que atravessa a virada
  -- do mês. Sem NENHUM recorte, porém, a matriz de sentimento mostraria o
  -- acervo inteiro ao lado de cards filtrados — inconsistência silenciosa.
  and a.analisado_ate >= p_inicio and a.analisado_ate <= p_fim
  group by i.usuario_id, a.etapa_funil, a.sentimento;
$$;

grant execute on function public.zap_analise_consultor(timestamptz, timestamptz, integer) to authenticated;
