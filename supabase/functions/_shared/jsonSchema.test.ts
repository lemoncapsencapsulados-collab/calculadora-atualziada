import { describe, expect, it } from 'vitest';
import { prepararSchema } from './jsonSchema';

describe('fechamento do schema', () => {
  it('fecha o objeto da raiz', () => {
    const r = prepararSchema({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'number' } },
    });
    expect(r.additionalProperties).toBe(false);
    expect(r.required).toEqual(['a', 'b']);
  });

  it('fecha o objeto dentro de um array', () => {
    // Era o buraco: só a raiz era fechada e a API recusava o schema.
    const r = prepararSchema({
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: { nome: { type: 'string' }, qtd: { type: 'number' } },
          },
        },
      },
    });
    const item = r.properties.itens.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(['nome', 'qtd']);
  });

  it('desce por objeto aninhado em propriedade', () => {
    const r = prepararSchema({
      type: 'object',
      properties: {
        dono: { type: 'object', properties: { nome: { type: 'string' } } },
      },
    });
    expect(r.properties.dono.additionalProperties).toBe(false);
    expect(r.properties.dono.required).toEqual(['nome']);
  });

  it('não mexe em array de tipo simples', () => {
    const r = prepararSchema({
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } },
    });
    expect(r.properties.tags.items).toEqual({ type: 'string' });
  });

  it('preserva enum, description e o que mais vier junto', () => {
    const r = prepararSchema({
      type: 'object',
      properties: {
        unidade: { type: 'string', enum: ['mg', 'g'], description: 'unidade' },
      },
    });
    expect(r.properties.unidade.enum).toEqual(['mg', 'g']);
    expect(r.properties.unidade.description).toBe('unidade');
  });

  it('devolve o que não é objeto sem alterar', () => {
    expect(prepararSchema({ type: 'string' })).toEqual({ type: 'string' });
    expect(prepararSchema(null as any)).toBe(null);
  });

  it('não altera o schema recebido', () => {
    const original = {
      type: 'object',
      properties: { a: { type: 'string' } },
    };
    prepararSchema(original);
    expect(original).not.toHaveProperty('additionalProperties');
  });
});
