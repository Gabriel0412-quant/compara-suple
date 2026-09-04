import { defineConfig, devices } from '@playwright/test'

const PORTA_APP = 3210
const PORTA_STUB = 54321
const BASE_URL = `http://127.0.0.1:${PORTA_APP}`

/**
 * O app roda em modo produção, contra o stub de dados — nunca contra o Supabase
 * real. Testar contra produção deixaria as asserções reféns do catálogo do dia:
 * uma coleta que tirasse uma oferta do ar quebraria o teste sem nada estar
 * errado no código.
 *
 * Só chromium. Um navegador pega regressão de navegação e layout, que é o que
 * falta cobrir aqui, sem multiplicar o tempo do CI por três.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command: `pnpm exec tsx e2e/stub-supabase.ts`,
      port: PORTA_STUB,
      reuseExistingServer: !process.env.CI,
      env: { STUB_PORT: String(PORTA_STUB) },
    },
    {
      command: `pnpm build && pnpm exec next start -p ${PORTA_APP}`,
      port: PORTA_APP,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        // Mesmo motivo do vitest.config.ts: a Vercel serve em UTC. Sem isso,
        // a home renderizada aqui usaria o fuso da máquina, e um teste sobre
        // "última coleta às 06:45" passaria em São Paulo e falharia no CI.
        TZ: 'UTC',
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_STUB}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'chave-de-teste-sem-valor',
        // O build coleta as rotas de API, e as que usam `supabaseAdmin` estouram
        // na carga do módulo sem esta chave. É falsa: nada aqui fala com o
        // Supabase real.
        SUPABASE_SERVICE_ROLE_KEY: 'chave-de-teste-sem-valor',
      },
    },
  ],
})
