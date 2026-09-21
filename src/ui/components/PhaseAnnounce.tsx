import { useEffect, useState } from 'react'
import { SUIT_LABEL } from '../../content/types'
import type { BossPhase } from '../../content/types'

const ROMAN = ['I', 'II', 'III']

/**
 * A Virada troca o naipe e sobe o limiar. O app anuncia a troca em tela cheia
 * por um instante — é o momento de auditoria da descida.
 */
export function PhaseAnnounce({ phase }: { phase: BossPhase }) {
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDone(false)
    const id = window.setTimeout(() => setDone(true), 2200)
    return () => window.clearTimeout(id)
  }, [phase.id])

  if (done) return null

  const suit = phase.suit === null ? 'qualquer naipe' : SUIT_LABEL[phase.suit as keyof typeof SUIT_LABEL]

  return (
    <div className="phase-announce" role="status" onClick={() => setDone(true)}>
      <div className="eyebrow" style={{ color: 'var(--gold-300)' }}>
        {phase.name}
      </div>
      <div className="roman">{ROMAN[phase.phase - 1]}</div>
      <h2 style={{ color: 'var(--boss-ink)' }}>{phase.phaseName}</h2>
      <p className="flavor" style={{ color: 'var(--gold-300)', margin: 0 }}>
        {phase.flavor}
      </p>
      <p style={{ margin: 0 }}>
        {phase.target} sucessos de {suit}
        {phase.thresholdDelta ? ` · limiar +${phase.thresholdDelta}` : ''}
      </p>
    </div>
  )
}
