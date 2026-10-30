export function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d)
}

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatScore(score) {
  return numberFormatter.format(Number(score) || 0)
}
