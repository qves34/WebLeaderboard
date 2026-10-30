import { useEffect, useState } from 'react'
import { fetchStats } from '../lib/scores'
import { isConfigured } from '../lib/supabaseClient'

/** Počty hráčů/záznamů do hlavičky. Chyba se tiše spolkne - je to jen dekorace. */
export function useStats(refreshKey) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    fetchStats()
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return stats
}
