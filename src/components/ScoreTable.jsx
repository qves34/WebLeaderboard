import { difficultyName, operatorName, operatorWeapon, scoreCeiling } from '../lib/game'
import { formatDate, formatScore, formatTime } from '../lib/format'

function RankCell({ rank }) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null
  return (
    <td className="col-rank">
      <span className={`rank${medal ? ` rank--${medal}` : ''}`}>{rank}</span>
    </td>
  )
}

export function ScoreTable({ rows, mode, loading, error, search, onSelectPlayer }) {
  const ceiling = scoreCeiling(mode)

  if (error) {
    return (
      <div className="state state--error" role="alert">
        <strong>Couldn&apos;t load the leaderboard.</strong>
        <span>{error.message ?? String(error)}</span>
      </div>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="state">
        {search
          ? <span>No player matching <strong>{search}</strong> in this category.</span>
          : <span>No scores in this category yet. Be the first to upload a run from the game.</span>}
      </div>
    )
  }

  return (
    <div className={`table-wrap${loading ? ' table-wrap--loading' : ''}`} aria-busy={loading}>
      <table className="scores">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th className="col-player">Player</th>
            <th className="col-score">Score</th>
            <th className="col-kills">Kills</th>
            <th className="col-time">Time</th>
            <th className="col-operator">Operator</th>
            <th className="col-difficulty">Difficulty</th>
            <th className="col-date">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.rank <= 3 ? 'is-top' : undefined}>
              <RankCell rank={row.rank} />
              <td className="col-player">
                <button type="button" className="player-link" onClick={() => onSelectPlayer(row.nickname)}>
                  {row.nickname}
                </button>
              </td>
              <td className="col-score">
                <span className="score">{formatScore(row.score)}</span>
                {ceiling && <span className="score__ceiling"> / {formatScore(ceiling)}</span>}
              </td>
              <td className="col-kills">{row.kills}</td>
              <td className="col-time">{formatTime(row.time_seconds)}</td>
              <td className="col-operator">
                <span>{operatorName(row.operator_id)}</span>
                <span className="muted"> · {operatorWeapon(row.operator_id)}</span>
              </td>
              <td className="col-difficulty">
                <span className={`badge badge--d${row.difficulty}`}>{difficultyName(row.difficulty)}</span>
              </td>
              <td className="col-date muted">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
