-- Mais métricas da Meta, e a correção da dupla contagem de leads.
--
-- DUPLA CONTAGEM: a Meta devolve `lead` como um TOTAL que já engloba
-- `offsite_conversion.fb_pixel_lead` e `onsite_conversion.lead_grouped`.
-- Verificado nos dados desta conta: em 121 de 121 linhas, `lead` era exatamente
-- a soma das outras duas. A coleta somava as três, contando cada lead de
-- formulário duas vezes — 20% de inflação no total e CPL ~17% mais barato do
-- que é de verdade.
--
-- DOIS FUNIS, NÃO UM: esta conta roda os dois formatos ao mesmo tempo. Nos
-- dados coletados, 589 leads de formulário (Pixel na landing) contra 2.347
-- conversas de WhatsApp iniciadas direto do anúncio. São jornadas diferentes,
-- com custo e qualidade diferentes; somadas num número só, nenhuma das duas
-- leituras sobrevive. Por isso passam a ter coluna própria.

alter table public.meta_insights_ad
  add column if not exists leads_formulario integer not null default 0,
  add column if not exists conversas_iniciadas integer not null default 0,
  add column if not exists link_clicks integer not null default 0,
  add column if not exists landing_page_views integer not null default 0,
  add column if not exists video_views integer not null default 0,
  add column if not exists engajamento integer not null default 0;

comment on column public.meta_insights_ad.leads_formulario is
  'Leads de formulário (Pixel). Vem do action_type `lead`, que JÁ engloba fb_pixel_lead e lead_grouped — nunca somar os três.';
comment on column public.meta_insights_ad.conversas_iniciadas is
  'Conversas de WhatsApp iniciadas pelo anúncio (Click-to-WhatsApp).';
comment on column public.meta_insights_ad.leads is
  'leads_formulario + conversas_iniciadas. Leitura de topo; não substitui olhar os dois em separado.';

-- ---------------------------------------------------------------------------
-- Visão geral, agora com o conjunto ampliado
-- ---------------------------------------------------------------------------
-- Continua sem CAC e sem ROAS: exigem ligar venda a anúncio, e não há
-- atribuição. Continua sem alcance e frequência de período: `reach` não é
-- somável entre dias — a mesma pessoa atingida em dois dias conta uma vez no
-- alcance real e duas ao somar linhas diárias.
drop function if exists public.trafego_visao_geral(date, date, text);

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
  cliques_link bigint,
  leads bigint,
  leads_formulario bigint,
  conversas bigint,
  visitas_landing bigint,
  video_views bigint,
  engajamento bigint,
  anuncios bigint,
  campanhas bigint,
  ctr numeric,
  ctr_link numeric,
  cpc numeric,
  cpm numeric,
  cpl numeric,
  custo_por_conversa numeric,
  custo_por_visita numeric,
  -- Quantos dos cliques no link viraram carregamento de página. Queda aqui é
  -- problema de velocidade ou de destino, não de criativo.
  taxa_chegada_landing numeric
)
language sql
stable
security invoker
as $funcao$
  with limites as (
    select
      p_inicio as ini_atual,
      p_fim    as fim_atual,
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
    sum(b.link_clicks)::bigint,
    sum(b.leads)::bigint,
    sum(b.leads_formulario)::bigint,
    sum(b.conversas_iniciadas)::bigint,
    sum(b.landing_page_views)::bigint,
    sum(b.video_views)::bigint,
    sum(b.engajamento)::bigint,
    count(distinct b.ad_id)::bigint,
    count(distinct b.campaign_id)::bigint,
    round((sum(b.clicks)::numeric      / nullif(sum(b.impressions), 0)) * 100, 2),
    round((sum(b.link_clicks)::numeric / nullif(sum(b.impressions), 0)) * 100, 2),
    round(sum(b.spend) / nullif(sum(b.clicks), 0), 2),
    round((sum(b.spend) / nullif(sum(b.impressions), 0)) * 1000, 2),
    round(sum(b.spend) / nullif(sum(b.leads), 0), 2),
    round(sum(b.spend) / nullif(sum(b.conversas_iniciadas), 0), 2),
    round(sum(b.spend) / nullif(sum(b.landing_page_views), 0), 2),
    round((sum(b.landing_page_views)::numeric / nullif(sum(b.link_clicks), 0)) * 100, 2)
  from base b, limites l
  group by b.periodo, l.ini_atual, l.fim_atual, l.ini_ant, l.fim_ant;
$funcao$;

-- ---------------------------------------------------------------------------
-- Hierarquia, com os dois funis separados
-- ---------------------------------------------------------------------------
drop function if exists public.trafego_hierarquia(date, date, text, text, text);

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
  cliques_link bigint,
  leads bigint,
  leads_formulario bigint,
  conversas bigint,
  visitas_landing bigint,
  ctr numeric,
  ctr_link numeric,
  cpl numeric,
  cpc numeric,
  cpm numeric,
  custo_por_conversa numeric,
  frequencia_media numeric
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
    sum(i.link_clicks)::bigint,
    sum(i.leads)::bigint,
    sum(i.leads_formulario)::bigint,
    sum(i.conversas_iniciadas)::bigint,
    sum(i.landing_page_views)::bigint,
    round((sum(i.clicks)::numeric      / nullif(sum(i.impressions), 0)) * 100, 2),
    round((sum(i.link_clicks)::numeric / nullif(sum(i.impressions), 0)) * 100, 2),
    round(sum(i.spend) / nullif(sum(i.leads), 0), 2),
    round(sum(i.spend) / nullif(sum(i.clicks), 0), 2),
    round((sum(i.spend) / nullif(sum(i.impressions), 0)) * 1000, 2),
    round(sum(i.spend) / nullif(sum(i.conversas_iniciadas), 0), 2),
    -- Média das frequências diárias, NÃO a frequência do período. A do período
    -- exigiria o alcance real, que não se obtém somando dias.
    round(avg(nullif(i.frequency, 0)), 2)
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
-- Série diária: para gráfico de evolução
-- ---------------------------------------------------------------------------
create or replace function public.trafego_serie_diaria(
  p_inicio date,
  p_fim date,
  p_conta text default null
)
returns table (
  data date,
  investimento numeric,
  impressoes bigint,
  cliques_link bigint,
  leads bigint,
  leads_formulario bigint,
  conversas bigint,
  cpl numeric,
  ctr_link numeric
)
language sql
stable
security invoker
as $funcao$
  select
    i.data,
    sum(i.spend)::numeric,
    sum(i.impressions)::bigint,
    sum(i.link_clicks)::bigint,
    sum(i.leads)::bigint,
    sum(i.leads_formulario)::bigint,
    sum(i.conversas_iniciadas)::bigint,
    round(sum(i.spend) / nullif(sum(i.leads), 0), 2),
    round((sum(i.link_clicks)::numeric / nullif(sum(i.impressions), 0)) * 100, 2)
  from public.meta_insights_ad i
  where i.data between p_inicio and p_fim
    and (p_conta is null or i.ad_account_id = p_conta)
  group by i.data
  order by i.data;
$funcao$;

-- ---------------------------------------------------------------------------
-- Catálogo de eventos: o que a conta realmente reporta
-- ---------------------------------------------------------------------------
-- Responde "o meu Pixel está funcionando?" com número em vez de suposição, e
-- mostra quais eventos existem antes de alguém desenhar métrica em cima de um
-- que nunca dispara.
create or replace function public.trafego_eventos(
  p_inicio date,
  p_fim date,
  p_conta text default null
)
returns table (
  evento text,
  total numeric,
  anuncios bigint,
  custo_por_evento numeric
)
language sql
stable
security invoker
as $funcao$
  select
    a->>'action_type',
    sum((a->>'value')::numeric),
    count(distinct i.ad_id)::bigint,
    round(sum(i.spend) / nullif(sum((a->>'value')::numeric), 0), 2)
  from public.meta_insights_ad i,
       lateral jsonb_array_elements(i.actions) a
  where i.actions is not null
    and i.data between p_inicio and p_fim
    and (p_conta is null or i.ad_account_id = p_conta)
  group by 1
  order by 2 desc;
$funcao$;

grant execute on function public.trafego_visao_geral(date, date, text) to authenticated;
grant execute on function public.trafego_hierarquia(date, date, text, text, text) to authenticated;
grant execute on function public.trafego_serie_diaria(date, date, text) to authenticated;
grant execute on function public.trafego_eventos(date, date, text) to authenticated;
