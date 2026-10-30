import { useCallback, useEffect, useState } from 'react'
import { fetchLeaderboard } from '../lib/scores'
import { isConfigured } from '../lib/supabaseClient'

const EMPTY = { key: null, rows: [], error: null, loadedAt: null }

/**
 * Načte top N pro aktuální filtry; `reload` vrátí čerstvá data bez změny filtrů.
 * "loading" se odvozuje z toho, jestli poslední načtený výsledek patří
 * k aktuálním filtrům - předchozí řádky zůstávají vidět (ztlumené), dokud
 * nedorazí nové, žádné bliknutí prázdné tabulky.
 */
export function useLeaderboard(filters) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState(EMPTY)

  const { mode, mapId, difficulty, operatorId } = filters
  const key = `${mode}|${mapId}|${difficulty}|${operatorId}|${version}`

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false

    fetchLeaderboard({ mode, mapId, difficulty, operatorId })
      .then((rows) => {
        if (!cancelled) setResult({ key, rows, error: null, loadedAt: new Date() })
      })
      .catch((error) => {
        if (!cancelled) setResult({ key, rows: [], error, loadedAt: null })
      })

    return () => {
      cancelled = true
    }
  }, [key, mode, mapId, difficulty, operatorId])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const loading = isConfigured && result.key !== key

  return { rows: result.rows, loading, error: result.error, loadedAt: result.loadedAt, reload }
}
