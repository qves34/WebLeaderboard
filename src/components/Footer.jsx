export function Footer({ loadedAt, loading, onReload }) {
  return (
    <footer className="footer">
      <span>
        Scores are uploaded straight from the game. Best run per player in each category.
      </span>
      <span className="footer__refresh">
        {loadedAt && <span className="muted">Updated {loadedAt.toLocaleTimeString()}</span>}
        <button type="button" className="chip" onClick={onReload} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </span>
    </footer>
  )
}
