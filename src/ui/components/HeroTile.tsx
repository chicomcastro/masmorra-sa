import { SUIT_LABEL, SUITS } from '../../content/types'
import type { DeckCard } from '../../content/types'
import { cardSuits } from '../../engine/card'
import { derivedPools, derivedThresholds } from '../../engine/hero'
import type { Hero, Squire } from '../../engine/state'
import { Pips } from './primitives'

export function HeroTile({
  hero,
  card,
  tableSize,
  inSlot,
  eligible,
  onTap,
  onOpenSheet,
}: {
  hero: Hero
  card: DeckCard | null
  tableSize: number
  inSlot: boolean
  eligible: boolean
  onTap: () => void
  onOpenSheet: () => void
}) {
  const ctx = { card, tableSize }
  const pools = derivedPools(hero, ctx)
  const thresholds = derivedThresholds(hero, ctx)
  const suits = card ? cardSuits(card) : SUITS
  const hasSuit = suits.some((s) => pools[s] > 0)

  let status: string
  if (hero.down) status = 'caído · não ocupa vaga, joga cartas'
  else if (!card) status = `${hero.wounds.length ? `${hero.wounds.length} ferimento${hero.wounds.length > 1 ? 's' : ''}` : 'inteiro'} · tocar p/ ver a ficha`
  else if (inSlot) status = 'na vaga'
  else if (!eligible) status = 'não pode entrar nesta carta'
  else if (!hasSuit) status = `sem ${suits.map((s) => SUIT_LABEL[s]).join('/')} · 2 sucessos contam como 1`
  else status = 'tocar p/ entrar'

  return (
    <button
      type="button"
      className={`hero-tile${inSlot ? ' in' : ''}${hero.down ? ' down' : ''}`}
      onClick={hero.down || !eligible ? onOpenSheet : onTap}
      onDoubleClick={onOpenSheet}
    >
      <span className="name">{hero.name}</span>
      <span className="meta">{status}</span>
      <span className="meta">
        Vigor <Pips filled={hero.vigor} total={hero.maxVigor} /> · XP{' '}
        <Pips filled={hero.xp} total={2} />
      </span>
      <span className="pools">
        {SUITS.map((s) => `${SUIT_LABEL[s].slice(0, 3)} ${pools[s]}${thresholds[s] === 4 ? '⁴' : ''}`).join(' · ')}
      </span>
      {hero.wounds.length ? (
        <span className="meta">
          {hero.wounds.length} ferimento{hero.wounds.length > 1 ? 's' : ''}
          {hero.wounds.length >= 3 ? ' · −1 dado em tudo' : ''}
        </span>
      ) : null}
    </button>
  )
}

export function SquireTile({
  squire,
  inSlot,
  onTap,
}: {
  squire: Squire
  inSlot: boolean
  onTap: () => void
}) {
  return (
    <button
      type="button"
      className={`hero-tile${inSlot ? ' in' : ''}${squire.retired ? ' down' : ''}`}
      onClick={onTap}
      disabled={squire.retired}
    >
      <span className="name">{squire.name}</span>
      <span className="meta">
        Escudeiro · {squire.retired ? 'retirado até o descanso' : 'tocar p/ entrar'}
      </span>
      <span className="pools">
        {squire.pool} dados de {SUIT_LABEL[squire.suit]} · 5+
      </span>
      <span className="meta">Sem XP, saque ou Marco</span>
    </button>
  )
}
