/** Gráficos em SVG escrito à mão. Cinco formas simples; uma dependência custaria mais. */

export function BarRow({
  label,
  value,
  max,
  caption,
  tone = 'gold',
}: {
  label: string
  value: number
  max: number
  caption?: string
  tone?: 'gold' | 'danger' | 'ink'
}) {
  const width = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  const color = tone === 'danger' ? 'var(--danger)' : tone === 'ink' ? 'var(--ink-500)' : 'var(--gold)'
  return (
    <div className="stack" style={{ gap: '0.15rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span className="note">{caption}</span>
      </div>
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" style={{ width: '100%', height: 10 }} role="presentation">
        <rect x="0" y="0" width="100" height="6" fill="none" stroke="var(--divider)" strokeWidth="0.4" />
        <rect x="0" y="0" width={width} height="6" fill={color} opacity="0.8" />
      </svg>
    </div>
  )
}

/** Taxa observada com intervalo de Wilson, contra a meta do simulador. */
export function RateWithInterval({
  label,
  rate,
  low,
  high,
  target,
  n,
}: {
  label: string
  rate: number
  low: number
  high: number
  target: number
  n: number
}) {
  const x = (v: number) => v * 100
  return (
    <div className="stack" style={{ gap: '0.2rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span>
          <span className="num">{(rate * 100).toFixed(0)}%</span>{' '}
          <span className="note">meta {(target * 100).toFixed(0)}% · n={n}</span>
        </span>
      </div>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ width: '100%', height: 20 }} role="presentation">
        <line x1="0" y1="5" x2="100" y2="5" stroke="var(--divider)" strokeWidth="0.4" />
        <line x1={x(low)} y1="5" x2={x(high)} y2="5" stroke="var(--gold)" strokeWidth="2.5" opacity="0.5" />
        <circle cx={x(rate)} cy="5" r="2" fill="var(--gold)" />
        <line x1={x(target)} y1="0.5" x2={x(target)} y2="9.5" stroke="var(--ink)" strokeWidth="0.6" strokeDasharray="1.5 1" />
      </svg>
    </div>
  )
}

export function StackedBars({
  rows,
}: {
  rows: { label: string; parts: { value: number; color: string; name: string }[] }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((n, p) => n + p.value, 0)))
  return (
    <div className="stack" style={{ gap: '0.35rem' }}>
      {rows.map((row) => {
        let offset = 0
        const total = row.parts.reduce((n, p) => n + p.value, 0)
        return (
          <div key={row.label} className="stack" style={{ gap: '0.1rem' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="note">{row.label}</span>
              <span className="note">{total || ''}</span>
            </div>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" style={{ width: '100%', height: 10 }} role="presentation">
              <rect x="0" y="0" width="100" height="6" fill="none" stroke="var(--divider)" strokeWidth="0.4" />
              {row.parts.map((p) => {
                const w = (p.value / max) * 100
                const x = offset
                offset += w
                return <rect key={p.name} x={x} y="0" width={w} height="6" fill={p.color} opacity="0.8" />
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: '0.9rem' }}>
      {items.map((i) => (
        <span key={i.name} className="note row" style={{ gap: '0.35rem' }}>
          <svg width="10" height="10" role="presentation">
            <rect width="10" height="10" fill={i.color} opacity="0.8" />
          </svg>
          {i.name}
        </span>
      ))}
    </div>
  )
}

export function formatMs(ms: number): string {
  if (!ms) return '—'
  const total = Math.round(ms / 1000)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return min ? `${min} min ${String(sec).padStart(2, '0')}` : `${sec} s`
}
