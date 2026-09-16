import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mesmo alias do vite.config.ts, senao os modulos de src/ nao resolvem '@/'.
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // Os módulos de `_shared` são TypeScript puro, sem nenhuma API do Deno — é
    // isso que permite testá-los aqui, sem subir uma edge function. Manter essa
    // disciplina (configuração entra por parâmetro, nunca por `Deno.env` dentro
    // do módulo) é o que mantém a lógica cara de errar sob teste.
    include: ['supabase/functions/_shared/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
