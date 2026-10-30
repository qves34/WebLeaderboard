import { useCallback, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { FilterBar } from './components/FilterBar'
import { ScoreTable } from './components/ScoreTable'
import { PlayerModal } from './components/PlayerModal'
import { SetupNotice } from './components/SetupNotice'
import { Footer } from './components/Footer'
import { useLeaderboard } from './hooks/useLeaderboard'
import { useStats } from './hooks/useStats'
import { mapsForMode } from './lib/game'
import { isConfigured } from './lib/supabaseClient'

const DEFAULT_FILTERS = {
  mode: 'classic',
  mapId: 'warehouse',
  difficulty: 'all',
  operatorId: 'all',
}

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [search, setSearch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const { rows, loading, error, loadedAt, reload } = useLeaderboard(filters)
  const stats = useStats(loadedAt)

  const updateFilters = useCallback((patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch }
      // Story má jiný seznam map než Mercenary - při přepnutí módu zvolit
      // první mapu nového seznamu, pokud ta stávající v něm není.
      if (patch.mode && patch.mode !== current.mode) {
        const maps = mapsForMode(patch.mode)
        if (!maps.includes(next.mapId)) next.mapId = maps[0]
      }
      return next
    })
  }, [])

  // Pořadí se počítá z plného seznamu, hledání ho pak jen filtruje -
  // hráč na 37. místě zůstane "37" i když je ve výsledku hledání sám.
  const ranked = useMemo(() => rows.map((row, index) => ({ ...row, rank: index + 1 })), [rows])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return ranked
    return ranked.filter((row) => row.nickname.toLowerCase().includes(needle))
  }, [ranked, search])

  const closeModal = useCallback(() => setSelectedPlayer(null), [])

  return (
    <div className="app">
      <Header stats={stats} />

      {!isConfigured ? (
        <SetupNotice />
      ) : (
        <main>
          <FilterBar filters={filters} search={search} onChange={updateFilters} onSearch={setSearch} />
          <ScoreTable
            rows={visible}
            mode={filters.mode}
            loading={loading}
            error={error}
            search={search.trim()}
            onSelectPlayer={setSelectedPlayer}
          />
        </main>
      )}

      <Footer loadedAt={loadedAt} loading={loading} onReload={reload} />

      {selectedPlayer && <PlayerModal nickname={selectedPlayer} onClose={closeModal} />}
    </div>
  )
}
