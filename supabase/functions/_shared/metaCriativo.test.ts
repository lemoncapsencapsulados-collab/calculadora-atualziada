import { describe, it, expect } from 'vitest';
import { extrairCriativo, hashCriativo, decidirVersao } from './metaCriativo.ts';

const adBase = {
  id: '777',
  name: 'Anuncio A',
  adset_id: '55',
  campaign_id: '9',
  creative: {
    body: 'Emagreça com saúde',
    title: 'Fórmula manipulada',
    call_to_action_type: 'LEARN_MORE',
    image_url: 'https://cdn/img.jpg',
    object_story_spec: {
      link_data: { message: 'Emagreça com saúde', link: 'https://lp.com/oferta' },
    },
  },
};

describe('extrairCriativo', () => {
  it('puxa copy, título e destino de onde a Meta os coloca', () => {
    const c = extrairCriativo(adBase);
    expect(c.corpo).toBe('Emagreça com saúde');
    expect(c.titulo).toBe('Fórmula manipulada');
    expect(c.url_destino).toBe('https://lp.com/oferta');
    expect(c.cta).toBe('LEARN_MORE');
  });

  it('não quebra em anúncio sem criativo', () => {
    const c = extrairCriativo({ id: '1', name: 'X' });
    expect(c.corpo).toBeNull();
    expect(c.ad_id).toBe('1');
  });
});

describe('hashCriativo', () => {
  it('mesmo conteúdo, mesmo hash', async () => {
    const a = await hashCriativo(extrairCriativo(adBase));
    const b = await hashCriativo(extrairCriativo(JSON.parse(JSON.stringify(adBase))));
    expect(a).toBe(b);
  });

  // É este teste que garante que trocar a copy abre versão nova — o mecanismo
  // inteiro do histórico depende dele.
  it('copy diferente, hash diferente', async () => {
    const outro = { ...adBase, creative: { ...adBase.creative, body: 'Outro texto' } };
    expect(await hashCriativo(extrairCriativo(adBase))).not.toBe(
      await hashCriativo(extrairCriativo(outro))
    );
  });

  it('mídia diferente, hash diferente', async () => {
    const outro = {
      ...adBase,
      creative: { ...adBase.creative, image_url: 'https://cdn/outra.jpg' },
    };
    expect(await hashCriativo(extrairCriativo(adBase))).not.toBe(
      await hashCriativo(extrairCriativo(outro))
    );
  });

  // Renomear anúncio é operação de organização, não troca de criativo. Se o
  // nome entrasse no hash, cada renomeação abriria uma versão falsa e poluiria
  // a comparação de desempenho entre copies.
  it('nome do anúncio não entra no hash', async () => {
    const renomeado = { ...adBase, name: 'Anuncio A — v2' };
    expect(await hashCriativo(extrairCriativo(adBase))).toBe(
      await hashCriativo(extrairCriativo(renomeado))
    );
  });
});

describe('decidirVersao', () => {
  it('abre versão quando ainda não há nenhuma', () => {
    expect(decidirVersao(null, 'abc')).toBe('abrir');
  });

  it('mantém quando o hash é o mesmo', () => {
    expect(decidirVersao({ hash_conteudo: 'abc' }, 'abc')).toBe('manter');
  });

  it('abre quando o hash mudou', () => {
    expect(decidirVersao({ hash_conteudo: 'abc' }, 'xyz')).toBe('abrir');
  });
});
