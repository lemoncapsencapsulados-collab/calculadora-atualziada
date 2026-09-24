// Fechamento de schema para saída estruturada da Anthropic.
//
// Módulo separado de `anthropic.ts` de propósito: aqui não entra `npm:` nem
// `Deno`, então isto roda no vitest junto com o resto dos testes.

/**
 * O schema precisa ser fechado: sem `additionalProperties: false` e com todo
 * campo em `required`, a saída estruturada não é garantida.
 *
 * Desce pelo schema inteiro, não só pelo primeiro nível: um objeto dentro de
 * `items` de um array precisa da mesma regra, e fechar só a raiz faz a API
 * recusar o schema com um erro que não diz onde está o objeto aberto.
 */
export function prepararSchema(schema: Record<string, any>): Record<string, any> {
  if (!schema || typeof schema !== 'object') return schema;

  if (Array.isArray(schema.items)) {
    return { ...schema, items: schema.items.map(prepararSchema) };
  }
  if (schema.items) {
    return { ...schema, items: prepararSchema(schema.items) };
  }
  if (schema.type !== 'object' || !schema.properties) return schema;

  const properties: Record<string, any> = {};
  for (const [chave, valor] of Object.entries(schema.properties)) {
    properties[chave] = prepararSchema(valor as Record<string, any>);
  }
  return {
    ...schema,
    properties,
    additionalProperties: false,
    required: Object.keys(properties),
  };
}
