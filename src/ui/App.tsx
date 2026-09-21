import { content } from '../content'

const counts = [
  ['obstáculos', content.obstacles.length],
  ['fases de chefe', content.bossPhases.length],
  ['espólios', content.loot.length],
  ['ferimentos', content.wounds.length],
  ['cicatrizes', content.scars.length],
  ['raças', content.races.length],
  ['classes', content.classes.length],
  ['especializações', content.specializations.length],
] as const

export function App() {
  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Mesa digital · {content.contentVersion}</div>
          <h1>Masmorra S.A.</h1>
          <p className="flavor">O monte é o relógio.</p>
        </div>
        <hr className="rule" />
        <div className="card stack">
          <h3>Baralho transcrito</h3>
          <div className="stack" style={{ gap: '0.35rem' }}>
            {counts.map(([label, n]) => (
              <div key={label} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{label}</span>
                <span className="num">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ color: 'var(--ink-500)' }}>
          O engine e o conteúdo estão prontos. A Mesa entra na próxima entrega.
        </p>
      </div>
    </div>
  )
}
