import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Os testes de ponta a ponta rodam no Playwright, não aqui. Sem excluí-los,
    // o vitest carrega os `.spec.ts` de `e2e/` e estoura com "Playwright Test
    // did not expect test.describe() to be called here".
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // lib/db.ts constrói o cliente Supabase na carga do módulo, então qualquer
    // teste que importe algo daquela cadeia falha sem estas variáveis. São
    // falsas de propósito: nenhum teste faz rede.
    env: {
      // A Vercel roda o servidor em UTC; a máquina de quem desenvolve, quase
      // sempre em America/Sao_Paulo. Sem fixar isso, teste de data passa aqui
      // e falha em produção — ou pior, passa nos dois e esconde o bug, que foi
      // o que aconteceu no #123: uma mutação que removia `timeZone` do
      // formatador não foi acusada localmente, porque o fuso da máquina dava
      // o mesmo resultado por acaso.
      TZ: 'UTC',
      NEXT_PUBLIC_SUPABASE_URL: 'https://exemplo.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'chave-de-teste',
      SUPABASE_SERVICE_ROLE_KEY: 'chave-de-teste',
    },
  },
})
