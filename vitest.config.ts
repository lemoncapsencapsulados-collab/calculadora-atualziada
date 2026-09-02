import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os módulos de `_shared` são TypeScript puro, sem nenhuma API do Deno — é
    // isso que permite testá-los aqui, sem subir uma edge function. Manter essa
    // disciplina (configuração entra por parâmetro, nunca por `Deno.env` dentro
    // do módulo) é o que mantém a lógica cara de errar sob teste.
    include: ['supabase/functions/_shared/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
