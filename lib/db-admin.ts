import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase server-side com service_role.
 *
 * Bypassa RLS — usar APENAS em código que roda no servidor (route handlers,
 * server components, jobs de ingestão). NUNCA importar em código que vai pro
 * browser, sob pena de vazar a service_role key.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  // Aviso, não throw — permite o build/lint passar mesmo sem env configurado.
  // Falha hard em runtime se realmente for usado sem env.
  console.warn(
    '[db-admin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes; ' +
    'qualquer chamada via supabaseAdmin vai falhar.',
  )
}

export const supabaseAdmin: SupabaseClient = createClient(
  url ?? '',
  serviceKey ?? '',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
)
