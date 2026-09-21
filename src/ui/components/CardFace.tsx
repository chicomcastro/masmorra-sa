import { SUIT_LABEL } from '../../content/types'
import type { DeckCard } from '../../content/types'
import { cardSuits, slotsOf } from '../../engine/card'

/**
 * A carta como ela sairia impressa. Efeitos que alteram o alvo por condição de
 * vaga aparecem como texto, nunca como número recalculando ao vivo.
 */
export function CardFace({
  card,
  tableSize,
  showTarget,
}: {
  card: DeckCard
  tableSize: number
  showTarget?: number
}) {
  const suits = cardSuits(card)
  const isBoss = card.kind === 'boss'
  const suitLabel =
    card.suit === null
      ? 'qualquer naipe'
      : suits.map((s) => SUIT_LABEL[s]).join(' ou ')
  const slots = card.slots === 'all' ? 'todos entram' : `${slotsOf(card, tableSize)} vaga${slotsOf(card, tableSize) > 1 ? 's' : ''}`

  return (
    <div className="card-face">
      <div className="eyebrow">
        {isBoss
          ? `${card.phaseName} · Fase ${['I', 'II', 'III'][card.phase - 1]}`
          : `${card.category} · Andar ${['I', 'II', 'III'][card.floor - 1]}`}
      </div>
      <h2>{card.name}</h2>
      <div className="flavor">{card.flavor}</div>
      <div className="stats">
        <span>
          <span className="num">{showTarget ?? card.target}</span>
          sucessos de {suitLabel}
        </span>
        <span>{slots}</span>
        <span>
          <span className="num">{card.damage}</span>
          de dano na falha
        </span>
      </div>
      <p style={{ margin: 0 }}>{card.effectText}</p>
      <div className="eyebrow" style={{ marginTop: 'auto' }}>
        {card.footer}
      </div>
    </div>
  )
}
