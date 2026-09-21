import type { DeckCard, Effect, Suit } from '../content/types'
import { SUITS } from '../content/types'

export function cardEffects(card: DeckCard): Effect[] {
  return card.effects ?? []
}

export function slotsOf(card: DeckCard, tableSize: number): number {
  return card.slots === 'all' ? tableSize : (card.slots as number)
}

export function cardSuits(card: DeckCard): Suit[] {
  if (card.suit == null) return SUITS
  return Array.isArray(card.suit) ? card.suit : [card.suit]
}

export function isBoss(card: DeckCard): boolean {
  return card.kind === 'boss'
}

export function cardFloor(card: DeckCard): 1 | 2 | 3 | 'boss' {
  return card.kind === 'boss' ? 'boss' : card.floor
}

export function hasManualEffects(card: DeckCard): boolean {
  return cardEffects(card).some((e) => e.kind === 'manual')
}
