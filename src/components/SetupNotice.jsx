export function SetupNotice() {
  return (
    <div className="state state--setup">
      <strong>Leaderboard is not connected to a database yet.</strong>
      <span>
        Create a <code>.env</code> file with <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
        {' '}(see <code>.env.example</code> and README), then restart the dev server.
      </span>
    </div>
  )
}
