-- Agregações da página de Funis de Tráfego Pago.
--
-- Toda métrica é derivada aqui, no banco, como no ZapVendas. O navegador só
-- desenha. Recalcular funil no cliente significa baixar linha crua e refazer a
-- conta em cada tela, e foi assim que a página de anúncios atual acabou com
-- números que ninguém consegue auditar.
--
-- Todas são SECURITY INVOKER de propósito: é o que faz o RLS valer para quem
-- chama. Uma função SECURITY DEFINER aqui devolveria dado de mídia para
-- qualquer usuário autenticado, contornando o papel `trafego`.
--
-- O QUE ESTAS FUNÇÕES NÃO DEVOLVEM, E POR QUÊ:
--
-- 1. CAC e ROAS. Exigem ligar venda a anúncio, e não existe atribuição
--    lead<->campanha neste sistema. Calcular verba do mês dividida por vendas do
--    mês é coincidência temporal, não medição — é o defeito da página atual e
--    não vai ser reproduzido aqui.
--
-- 2. Alcance e frequência do período. `reach` NÃO é somável: a mesma pessoa
--    atingida em dois dias conta uma vez no alcance real do período e duas ao
--    somar linhas diárias. Frequência, que deriva dele, herda o erro. Somar
--    `reach` diário produziria um número que parece certo, cresce com o tamanho
--    do período e está sempre errado. Alcance de período só sai de uma coleta
--    própria, sem `time_increment`.

-- ---------------------------------------------------------------------------
-- Visão geral: período pedido e período anterior, de uma vez.
-- ---------------------------------------------------------------------------
-- Os dois períodos vêm juntos porque a tela mostra sempre a variação; duas
-- viagens ao banco para montar um único cartão seria desperdício de latência.
create or replace function public.trafego_visao_geral(
  p_inicio date,
  p_fim date,
  p_conta text default null
)
returns table (
  periodo text,
  inicio date,
  fim date,
  investimento numeric,
  impressoes bigint,
  cliques bigint,
  leads bigint,
  anuncios bigint,
  ctr numeric,
  cpl numeric,
  cpm numeric
)
language sql
stable
security invoker
as $funcao$
  with limites as (
    select
      p_inicio as ini_atual,
      p_fim    as fim_atual,
      -- Período anterior de mesma duração, imediatamente antes.
      p_inicio - ((p_fim - p_inicio) + 1) as ini_ant,
      p_inicio - 1                        as fim_ant
  ),
  base as (
    select
      case when i.data between l.ini_atual and l.fim_atual then 'atual' else 'anterior' end as periodo,
      i.*
    from public.meta_insights_ad i, limites l
    where i.data between l.ini_ant and l.fim_atual
      and (p_conta is null or i.ad_account_id = p_conta)
  )
  select
    b.periodo,
    case when b.periodo = 'atual' then l.ini_atual else l.ini_ant end,
    case when b.periodo = 'atual' then l.fim_atual else l.fim_ant end,
    sum(b.spend)::numeric,
    sum(b.impressions)::bigint,
    sum(b.clicks)::bigint,
    sum(b.leads)::bigint,
    count(distinct b.ad_id)::bigint,
    -- nullif evita divisão por zero virar erro numa tela que só quer mostrar
    -- um traço quando não houve entrega.
    round((sum(b.clicks)::numeric / nullif(sum(b.impressions), 0)) * 100, 2),
    round(sum(b.spend) / nullif(sum(b.leads), 0), 2),
    round((sum(b.spend) / nullif(sum(b.impressions), 0)) * 1000, 2)
  from base b, limites l
  group by b.periodo, l.ini_atual, l.fim_atual, l.ini_ant, l.fim_ant;
$funcao$;

-- ---------------------------------------------------------------------------
-- Hierarquia: campanha -> conjunto -> anúncio
-- ---------------------------------------------------------------------------
-- Um só ponto de entrada com `p_nivel` em vez de três funções: os três níveis
-- agregam exatamente as mesmas colunas, e triplicar a definição seria triplicar
-- o lugar onde a fórmula do CPL pode divergir.
create or replace function public.trafego_hierarquia(
  p_inicio date,
  p_fim date,
  p_conta text default null,
  p_nivel text default 'campanha',
  p_pai text default null
)
returns table (
  id text,
  nome text,
  pai_id text,
  investimento numeric,
  impressoes bigint,
  cliques bigint,
  leads bigint,
  ctr numeric,
  cpl numeric,
  cpc numeric
)
language sql
stable
security invoker
as $funcao$
  select
    case p_nivel when 'campanha' then i.campaign_id
                 when 'conjunto' then i.adset_id
                 else i.ad_id end,
    coalesce(
      case p_nivel when 'campanha' then i.campaign_name
                   when 'conjunto' then i.adset_name
                   else i.ad_name end,
      '(sem nome)'),
    case p_nivel when 'conjunto' then i.campaign_id
                 when 'anuncio'  then i.adset_id
                 else null end,
    sum(i.spend)::numeric,
    sum(i.impressions)::bigint,
    sum(i.clicks)::bigint,
    sum(i.leads)::bigint,
    round((sum(i.clicks)::numeric / nullif(sum(i.impressions), 0)) * 100, 2),
    round(sum(i.spend) / nullif(sum(i.leads), 0), 2),
    round(sum(i.spend) / nullif(sum(i.clicks), 0), 2)
  from public.meta_insights_ad i
  where i.data between p_inicio and p_fim
    and (p_conta is null or i.ad_account_id = p_conta)
    and (
      p_pai is null
      or (p_nivel = 'conjunto' and i.campaign_id = p_pai)
      or (p_nivel = 'anuncio'  and i.adset_id   = p_pai)
    )
  group by 1, 2, 3
  having sum(i.impressions) > 0
  order by sum(i.spend) desc;
$funcao$;

-- ---------------------------------------------------------------------------
-- Criativos: a copy que estava no ar, ao lado do número do período
-- ---------------------------------------------------------------------------
-- O join por vigência é o ponto todo desta tabela. Sem ele, o desempenho de um
-- período que atravessa uma troca de criativo apareceria colado no texto atual,
-- creditando ao texto novo um resultado que foi do antigo.
create or replace function public.trafego_criativos(
  p_inicio date,
  p_fim date,
  p_conta text default null
)
returns table (
  ad_id text,
  ad_name text,
  campaign_name text,
  titulo text,
  corpo text,
  cta text,
  url_destino text,
  image_url text,
  vigente_desde date,
  vigente_ate date,
  no_ar boolean,
  dias_no_periodo integer,
  investimento numeric,
  impressoes bigint,
  cliques bigint,
  leads bigint,
  ctr numeric,
  cpl numeric
)
language sql
stable
security invoker
as $funcao$
  select
    c.ad_id,
    max(c.ad_name),
    max(i.campaign_name),
    max(c.titulo),
    max(c.corpo),
    max(c.cta),
    max(c.url_destino),
    max(c.image_url),
    c.vigente_desde,
    c.vigente_ate,
    (c.vigente_ate is null),
    count(distinct i.data)::integer,
    sum(i.spend)::numeric,
    sum(i.impressions)::bigint,
    sum(i.clicks)::bigint,
    sum(i.leads)::bigint,
    round((sum(i.clicks)::numeric / nullif(sum(i.impressions), 0)) * 100, 2),
    round(sum(i.spend) / nullif(sum(i.leads), 0), 2)
  from public.meta_criativos c
  join public.meta_insights_ad i
    on i.ad_id = c.ad_id
   -- Só os dias em que ESTA versão estava no ar.
   and i.data >= c.vigente_desde
   and i.data <= coalesce(c.vigente_ate, p_fim)
   and i.data between p_inicio and p_fim
  where (p_conta is null or c.ad_account_id = p_conta)
  group by c.ad_id, c.vigente_desde, c.vigente_ate
  having sum(i.impressions) > 0
  order by sum(i.spend) desc;
$funcao$;

-- ---------------------------------------------------------------------------
-- Recorte: plataforma/posicionamento ou idade/gênero
-- ---------------------------------------------------------------------------
-- `p_recorte` é obrigatório e sem valor padrão de propósito. É a trava que
-- impede somar dois recortes na mesma consulta — o erro que dobraria o
-- investimento sem avisar.
create or replace function public.trafego_recorte(
  p_inicio date,
  p_fim date,
  p_recorte text,
  p_conta text default null
)
returns table (
  chave_1 text,
  chave_2 text,
  investimento numeric,
  impressoes bigint,
  cliques bigint,
  ctr numeric,
  participacao numeric
)
language sql
stable
security invoker
as $funcao$
  with fatia as (
    select r.chave_1, r.chave_2, r.spend, r.impressions, r.clicks
    from public.meta_insights_ad_recorte r
    where r.data between p_inicio and p_fim
      and r.recorte = p_recorte
      and (p_conta is null or r.ad_account_id = p_conta)
  ),
  total as (select nullif(sum(spend), 0) as gasto from fatia)
  select
    f.chave_1,
    f.chave_2,
    sum(f.spend)::numeric,
    sum(f.impressions)::bigint,
    sum(f.clicks)::bigint,
    round((sum(f.clicks)::numeric / nullif(sum(f.impressions), 0)) * 100, 2),
    -- Participação dentro do PRÓPRIO recorte. Comparar entre recortes não faz
    -- sentido: são leituras do mesmo dinheiro por ângulos diferentes.
    round((sum(f.spend) / (select gasto from total)) * 100, 2)
  from fatia f
  group by f.chave_1, f.chave_2
  order by sum(f.spend) desc;
$funcao$;

-- ---------------------------------------------------------------------------
-- Frescor da coleta: o cabeçalho da página precisa dizer de quando é o dado
-- ---------------------------------------------------------------------------
create or replace function public.trafego_status(p_conta text default null)
returns table (
  ad_account_id text,
  ultima_coleta timestamptz,
  dia_mais_recente date,
  jobs_pendentes bigint,
  jobs_em_erro bigint
)
language sql
stable
security invoker
as $funcao$
  select
    j.ad_account_id,
    max(j.atualizado_em) filter (where j.status = 'done'),
    (select max(i.data) from public.meta_insights_ad i
      where i.ad_account_id = j.ad_account_id),
    count(*) filter (where j.status in ('pending', 'failed', 'running')),
    count(*) filter (where j.status = 'dlq')
  from public.meta_sync_jobs j
  where (p_conta is null or j.ad_account_id = p_conta)
  group by j.ad_account_id;
$funcao$;

grant execute on function public.trafego_visao_geral(date, date, text) to authenticated;
grant execute on function public.trafego_hierarquia(date, date, text, text, text) to authenticated;
grant execute on function public.trafego_criativos(date, date, text) to authenticated;
grant execute on function public.trafego_recorte(date, date, text, text) to authenticated;
grant execute on function public.trafego_status(text) to authenticated;
