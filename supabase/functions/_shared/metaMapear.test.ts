import { describe, it, expect } from 'vitest';
import {
  extrairLeads, extrairLeadsFormulario, extrairConversas, extrairAcao,
  paraLinhaBase, paraLinhaRecorte,
} from './metaMapear.ts';

describe('extrairLeads', () => {
  it('soma lead de formulario com conversa iniciada', () => {
    expect(
      extrairLeads([
        { action_type: 'lead', value: '3' },
        { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' },
        { action_type: 'link_click', value: '99' },
      ])
    ).toBe(5);
  });

  // A Meta devolve `lead` como TOTAL que ja inclui `fb_pixel_lead` e
  // `lead_grouped`. Verificado em producao: em 121 de 121 linhas, lead era
  // exatamente a soma das duas. Somar as tres contava todo lead de formulario
  // duas vezes -- 20% de inflacao no total e CPL ~17% mais barato do que e.
  it('NAO conta em dobro: lead ja engloba fb_pixel_lead e lead_grouped', () => {
    expect(
      extrairLeads([
        { action_type: 'lead', value: '589' },
        { action_type: 'offsite_conversion.fb_pixel_lead', value: '497' },
        { action_type: 'onsite_conversion.lead_grouped', value: '92' },
      ])
    ).toBe(589);
  });

  it('usa os componentes quando o total agregado nao vem', () => {
    expect(
      extrairLeads([
        { action_type: 'offsite_conversion.fb_pixel_lead', value: '10' },
        { action_type: 'onsite_conversion.lead_grouped', value: '4' },
      ])
    ).toBe(14);
  });

  it('tolera entrada que não é lista', () => {
    expect(extrairLeads(null)).toBe(0);
    expect(extrairLeads(undefined)).toBe(0);
    expect(extrairLeads('nada')).toBe(0);
  });

  it('ignora valor não numérico em vez de virar NaN', () => {
    expect(extrairLeads([{ action_type: 'lead', value: 'x' }])).toBe(0);
  });
});

const cru = {
  date_start: '2026-08-12',
  ad_id: '777',
  ad_name: 'Anuncio A',
  adset_id: '55',
  adset_name: 'Conjunto',
  campaign_id: '9',
  campaign_name: 'Campanha',
  spend: '10.50',
  impressions: '1000',
  clicks: '30',
  reach: '900',
  frequency: '1.11',
  actions: [{ action_type: 'lead', value: '4' }],
  action_values: [{ action_type: 'lead', value: '250' }],
};

describe('separacao dos dois funis', () => {
  // Lead de formulario e conversa de WhatsApp sao funis diferentes, com custo e
  // qualidade diferentes. Somados num numero so, nenhuma das duas leituras
  // sobrevive.
  it('separa lead de formulario de conversa iniciada', () => {
    const a = [
      { action_type: 'lead', value: '10' },
      { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '40' },
    ];
    expect(extrairLeadsFormulario(a)).toBe(10);
    expect(extrairConversas(a)).toBe(40);
  });

  it('conta zero quando o funil nao existe naquele anuncio', () => {
    expect(extrairConversas([{ action_type: 'lead', value: '10' }])).toBe(0);
    expect(extrairLeadsFormulario([{ action_type: 'link_click', value: '9' }])).toBe(0);
  });
});

describe('metricas de entrega', () => {
  it('extrai o evento pedido pelo nome', () => {
    const a = [
      { action_type: 'link_click', value: '30' },
      { action_type: 'landing_page_view', value: '18' },
      { action_type: 'video_view', value: '200' },
    ];
    expect(extrairAcao(a, 'link_click')).toBe(30);
    expect(extrairAcao(a, 'landing_page_view')).toBe(18);
    expect(extrairAcao(a, 'nao_existe')).toBe(0);
  });
});

describe('paraLinhaBase', () => {
  it('converte número que a Meta manda como string', () => {
    const r = paraLinhaBase(cru, 'act_1');
    expect(r.spend).toBe(10.5);
    expect(r.impressions).toBe(1000);
    expect(r.frequency).toBeCloseTo(1.11);
  });

  it('usa date_start como a data da linha', () => {
    expect(paraLinhaBase(cru, 'act_1').data).toBe('2026-08-12');
  });

  // Descartar `actions` em `meta_insights` foi o que impediu de responder, meses
  // depois, se os leads eram de messaging ou de Pixel. Não repetir.
  it('preserva actions e action_values crus', () => {
    const r = paraLinhaBase(cru, 'act_1');
    expect(r.actions).toEqual(cru.actions);
    expect(r.action_values).toEqual(cru.action_values);
  });

  it('deriva leads sem perder a evidência', () => {
    expect(paraLinhaBase(cru, 'act_1').leads).toBe(4);
  });

  it('aceita linha sem campos opcionais', () => {
    const r = paraLinhaBase({ date_start: '2026-08-12', ad_id: '777' }, 'act_1');
    expect(r.spend).toBe(0);
    expect(r.leads).toBe(0);
    expect(r.campaign_id).toBeNull();
  });
});

describe('paraLinhaRecorte', () => {
  it('põe plataforma e posicionamento nas chaves, nessa ordem', () => {
    const r = paraLinhaRecorte(
      {
        date_start: '2026-08-12',
        ad_id: '777',
        spend: '2',
        publisher_platform: 'facebook',
        platform_position: 'feed',
      },
      'act_1',
      'plataforma_posicionamento'
    );
    expect([r.chave_1, r.chave_2]).toEqual(['facebook', 'feed']);
    expect(r.recorte).toBe('plataforma_posicionamento');
  });

  it('põe idade e gênero nas chaves, nessa ordem', () => {
    const r = paraLinhaRecorte(
      { date_start: '2026-08-12', ad_id: '777', spend: '2', age: '25-34', gender: 'female' },
      'act_1',
      'idade_genero'
    );
    expect([r.chave_1, r.chave_2]).toEqual(['25-34', 'female']);
  });

  // A chave única não distingue nulos: duas linhas com null na mesma posição
  // não colidiriam, e o upsert duplicaria a cada coleta.
  it('usa string vazia no lugar de ausente', () => {
    const r = paraLinhaRecorte(
      { date_start: '2026-08-12', ad_id: '777', spend: '2', age: '25-34' },
      'act_1',
      'idade_genero'
    );
    expect(r.chave_2).toBe('');
  });

  it('não carrega campos que só existem na base — recorte não é somável com ela', () => {
    const r = paraLinhaRecorte(
      { date_start: '2026-08-12', ad_id: '777', spend: '2', reach: '500', frequency: '2' },
      'act_1',
      'plataforma_posicionamento'
    ) as Record<string, unknown>;
    expect(r.reach).toBeUndefined();
    expect(r.frequency).toBeUndefined();
  });
});
