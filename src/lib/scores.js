import { supabase } from './supabaseClient'

export const PAGE_SIZE = 100

const SCORE_COLUMNS = 'id,nickname,mode,map_id,operator_id,difficulty,score,kills,time_seconds,game_version,created_at'

/**
 * Top N v jedné kategorii. Díky unique constraintu v DB je tu každý hráč
 * nejvýš jednou na kombinaci mód+mapa+operátor+obtížnost. Když je obtížnost
 * nebo operátor "all", může se stejný nick objevit vícekrát (jeho best
 * v každé podkategorii) - to je záměr.
 */
export async function fetchLeaderboard({ mode, mapId, difficulty, operatorId }) {
  let query = supabase
    .from('scores')
    .select(SCORE_COLUMNS)
    .eq('mode', mode)
    .eq('map_id', mapId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(PAGE_SIZE)

  if (difficulty !== 'all') query = query.eq('difficulty', difficulty)
  if (operatorId !== 'all') query = query.eq('operator_id', operatorId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Všechny rekordy jednoho hráče, seřazené pro přehled v modalu. */
export async function fetchPlayerScores(nickname) {
  const { data, error } = await supabase
    .from('scores')
    .select(SCORE_COLUMNS)
    .eq('nickname', nickname)
    .order('mode', { ascending: true })
    .order('map_id', { ascending: true })
    .order('difficulty', { ascending: true })
    .order('operator_id', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Počet hráčů a záznamů do hlavičky. player_profiles je view bez token_hash. */
export async function fetchStats() {
  const [players, records] = await Promise.all([
    supabase.from('player_profiles').select('nickname', { count: 'exact', head: true }),
    supabase.from('scores').select('id', { count: 'exact', head: true }),
  ])
  if (players.error) throw players.error
  if (records.error) throw records.error
  return { players: players.count ?? 0, records: records.count ?? 0 }
}
