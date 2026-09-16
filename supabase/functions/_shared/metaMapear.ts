// Converte a linha crua do Ads Insights na linha da tabela correspondente.
//
// Existe separado do executor da fila porque é aqui que mora o erro caro e
// silencioso: trocar a ordem de duas chaves de recorte, ou deixar `reach` cair
// numa linha de recorte, produz número errado que ninguém percebe até conferir
// com o Gerenciador. Isolado assim, fica sob teste.

export type Recorte = 'plataforma_posicionamento' | 'idade_genero';

export interface LinhaBase {
  ad_account_id: string;
  ad_id: string;
  data: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  actions: unknown;
  action_values: unknown;
  cost_per_action_type: unknown;
  leads: number;
  leads_formulario: number;
  conversas_iniciadas: number;
  link_clicks: number;
  landing_page_views: number;
  video_views: number;
  engajamento: number;
}

export interface LinhaRecorte {
  ad_account_id: string;
  ad_id: string;
  data: string;
  recorte: Recorte;
  chave_1: string;
  chave_2: string;
  spend: number;
  impressions: number;
  clicks: number;
  actions: unknown;
}

/** Valor de um `action_type` específico. Zero quando o evento não veio. */
export function extrairAcao(actions: unknown, tipo: string): number {
  if (!Array.isArray(actions)) return 0;
  for (const a of actions) {
    if (a?.action_type === tipo) return Number(a?.value) || 0;
  }
  return 0;
}

/**
 * Leads de formulário (Pixel na landing).
 *
 * CUIDADO COM DUPLA CONTAGEM: `lead` é o TOTAL que a Meta já calcula, e ele
 * ENGLOBA `offsite_conversion.fb_pixel_lead` e `onsite_conversion.lead_grouped`.
 * Verificado nos dados de produção: em 121 de 121 linhas, `lead` era exatamente
 * a soma das outras duas. Somar os três — como fazia `meta-sync-insights` —
 * contava cada lead de formulário duas vezes: 20% de inflação no total e CPL
 * ~17% mais barato do que realmente é.
 *
 * Então: usa o agregado quando ele vem; só cai nos componentes quando não vem.
 */
export function extrairLeadsFormulario(actions: unknown): number {
  const total = extrairAcao(actions, 'lead');
  if (total > 0) return total;
  return (
    extrairAcao(actions, 'offsite_conversion.fb_pixel_lead') +
    extrairAcao(actions, 'onsite_conversion.lead_grouped')
  );
}

/** Conversas de WhatsApp iniciadas pelo anúncio (Click-to-WhatsApp). */
export function extrairConversas(actions: unknown): number {
  return extrairAcao(actions, 'onsite_conversion.messaging_conversation_started_7d');
}

/**
 * Total de contatos gerados: formulário + conversa.
 *
 * São dois funis diferentes, com custo e qualidade diferentes — por isso ficam
 * também em colunas separadas. Este total existe para quem quer a leitura de
 * topo, e não substitui olhar os dois em separado.
 */
export function extrairLeads(actions: unknown): number {
  return extrairLeadsFormulario(actions) + extrairConversas(actions);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function txt(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

export function paraLinhaBase(l: any, adAccountId: string): LinhaBase {
  return {
    ad_account_id: adAccountId,
    ad_id: String(l?.ad_id ?? ''),
    data: String(l?.date_start ?? ''),
    campaign_id: txt(l?.campaign_id),
    campaign_name: txt(l?.campaign_name),
    adset_id: txt(l?.adset_id),
    adset_name: txt(l?.adset_name),
    ad_name: txt(l?.ad_name),
    spend: num(l?.spend),
    impressions: num(l?.impressions),
    clicks: num(l?.clicks),
    reach: num(l?.reach),
    frequency: num(l?.frequency),
    // Crus, de propósito: são a evidência por trás de `leads`.
    actions: l?.actions ?? null,
    action_values: l?.action_values ?? null,
    cost_per_action_type: l?.cost_per_action_type ?? null,
    leads: extrairLeads(l?.actions),
    // Os dois funis em separado: lead de formulário e conversa de WhatsApp têm
    // custo e qualidade diferentes, e somados num número só nenhuma das duas
    // leituras sobrevive.
    leads_formulario: extrairLeadsFormulario(l?.actions),
    conversas_iniciadas: extrairConversas(l?.actions),
    link_clicks: extrairAcao(l?.actions, 'link_click'),
    landing_page_views: extrairAcao(l?.actions, 'landing_page_view'),
    video_views: extrairAcao(l?.actions, 'video_view'),
    engajamento: extrairAcao(l?.actions, 'post_engagement'),
  };
}

/**
 * A ordem das chaves é parte do contrato: quem lê a tabela conta com
 * `chave_1` = plataforma e `chave_2` = posicionamento (ou idade e gênero).
 * Inverter aqui não quebra nada visivelmente — só troca os rótulos do gráfico.
 *
 * String vazia no lugar de ausente porque a chave única não distingue nulos:
 * duas linhas com null na mesma posição não colidiriam, e o upsert passaria a
 * duplicar a cada coleta.
 */
export function paraLinhaRecorte(l: any, adAccountId: string, recorte: Recorte): LinhaRecorte {
  const [c1, c2] =
    recorte === 'plataforma_posicionamento'
      ? [l?.publisher_platform, l?.platform_position]
      : [l?.age, l?.gender];

  return {
    ad_account_id: adAccountId,
    ad_id: String(l?.ad_id ?? ''),
    data: String(l?.date_start ?? ''),
    recorte,
    chave_1: txt(c1) ?? '',
    chave_2: txt(c2) ?? '',
    spend: num(l?.spend),
    impressions: num(l?.impressions),
    clicks: num(l?.clicks),
    actions: l?.actions ?? null,
    // `reach` e `frequency` NÃO entram: não são aditivos entre recortes, e tê-los
    // aqui convidaria a somá-los como se fossem.
  };
}
