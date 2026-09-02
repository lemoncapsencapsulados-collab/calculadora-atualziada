import { describe, it, expect } from 'vitest';
import { extrairLeads, paraLinhaBase, paraLinhaRecorte } from './metaMapear.ts';

describe('extrairLeads', () => {
  it('soma os tipos que contam como lead', () => {
    expect(
      extrairLeads([
        { action_type: 'lead', value: '3' },
        { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' },
        { action_type: 'link_click', value: '99' },
      ])
    ).toBe(5);
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
