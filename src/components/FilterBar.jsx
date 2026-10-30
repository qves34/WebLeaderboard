import { DIFFICULTIES, MODES, OPERATOR_ORDER, mapName, mapsForMode, operatorName, operatorWeapon } from '../lib/game'

function ChipGroup({ label, value, options, onChange }) {
  return (
    <div className="filter" role="group" aria-label={label}>
      <span className="filter__label">{label}</span>
      <div className="chips">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip${opt.value === value ? ' chip--active' : ''}`}
            aria-pressed={opt.value === value}
            title={opt.title}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FilterBar({ filters, search, onChange, onSearch }) {
  const { mode, mapId, difficulty, operatorId } = filters
  const activeMode = MODES.find((m) => m.id === mode)

  const mapOptions = mapsForMode(mode).map((id) => ({ value: id, label: mapName(id) }))
  const difficultyOptions = [
    { value: 'all', label: 'All' },
    ...DIFFICULTIES.map((name, index) => ({ value: index, label: name })),
  ]
  const operatorOptions = [
    { value: 'all', label: 'All' },
    ...OPERATOR_ORDER.map((id) => ({ value: id, label: operatorName(id), title: operatorWeapon(id) })),
  ]

  return (
    <section className="filters" aria-label="Leaderboard filters">
      <nav className="tabs" aria-label="Game mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`tab${m.id === mode ? ' tab--active' : ''}`}
            aria-pressed={m.id === mode}
            onClick={() => onChange({ mode: m.id })}
          >
            {m.name}
          </button>
        ))}
      </nav>
      {activeMode && <p className="filters__hint">{activeMode.hint}</p>}

      <ChipGroup label="Map" value={mapId} options={mapOptions} onChange={(v) => onChange({ mapId: v })} />
      <ChipGroup label="Difficulty" value={difficulty} options={difficultyOptions} onChange={(v) => onChange({ difficulty: v })} />
      <ChipGroup label="Operator" value={operatorId} options={operatorOptions} onChange={(v) => onChange({ operatorId: v })} />

      <div className="filter filter--search">
        <label className="filter__label" htmlFor="player-search">Player</label>
        <input
          id="player-search"
          type="search"
          className="search"
          placeholder="Find a nickname…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
          spellCheck="false"
        />
      </div>
    </section>
  )
}
