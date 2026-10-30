import { useEffect, useState } from 'react'
import { fetchPlayerScores } from '../lib/scores'
import { difficultyName, mapName, modeName, operatorName, scoreCeiling } from '../lib/game'
import { formatDate, formatScore, formatTime } from '../lib/format'

export function PlayerModal({ nickname, onClose }) {
  // Výsledek je svázaný s nickem - při přepnutí hráče se starý nepoužije.
  const [result, setResult] = useState({ nickname: null, rows: null, error: null })
  const { rows, error } = result.nickname === nickname ? result : { rows: null, error: null }

  useEffect(() => {
    let cancelled = false
    fetchPlayerScores(nickname)
      .then((data) => {
        if (!cancelled) setResult({ nickname, rows: data, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ nickname, rows: null, error: err })
      })
    return () => {
      cancelled = true
    }
  }, [nickname])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="player-modal-title" className="modal__title">{nickname}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="state state--error">{error.message ?? String(error)}</div>}
        {!error && rows === null && <div className="state">Loading…</div>}
        {rows && rows.length === 0 && <div className="state">No records for this player.</div>}

        {rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="scores scores--compact">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Map</th>
                  <th>Difficulty</th>
                  <th>Operator</th>
                  <th className="col-score">Score</th>
                  <th className="col-kills">Kills</th>
                  <th className="col-time">Time</th>
                  <th className="col-date">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const ceiling = scoreCeiling(row.mode)
                  return (
                    <tr key={row.id}>
                      <td>{modeName(row.mode)}</td>
                      <td>{mapName(row.map_id)}</td>
                      <td><span className={`badge badge--d${row.difficulty}`}>{difficultyName(row.difficulty)}</span></td>
                      <td>{operatorName(row.operator_id)}</td>
                      <td className="col-score">
                        <span className="score">{formatScore(row.score)}</span>
                        {ceiling && <span className="score__ceiling"> / {formatScore(ceiling)}</span>}
                      </td>
                      <td className="col-kills">{row.kills}</td>
                      <td className="col-time">{formatTime(row.time_seconds)}</td>
                      <td className="col-date muted">{formatDate(row.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
