import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True když jsou v .env oba údaje - jinak appka ukáže návod místo tabulky. */
export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  console.error('Chybí VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY v .env')
}

// Leaderboard je čistě veřejný read - žádné přihlášení, žádná session.
export const supabase = isConfigured
  ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null
