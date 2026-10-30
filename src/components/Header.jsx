import { formatScore } from '../lib/format'

export function Header({ stats }) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__crosshair" aria-hidden="true" />
        <div>
          <h1 className="header__title">MERCENARY</h1>
          <p className="header__subtitle">Global Leaderboard</p>
        </div>
      </div>
      {stats && (
        <dl className="header__stats">
          <div>
            <dt>Players</dt>
            <dd>{formatScore(stats.players)}</dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd>{formatScore(stats.records)}</dd>
          </div>
        </dl>
      )}
    </header>
  )
}
