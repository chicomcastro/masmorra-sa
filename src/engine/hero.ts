import { afflictionById, classById, lootById, raceById, specById } from '../content'
import { SUITS } from '../content/types'
import type { DeckCard, Effect, Suit } from '../content/types'
import type { Hero, Pools, Thresholds } from './state'
import { cardEffects, slotsOf } from './card'

export function emptyPools(): Pools {
  return { forca: 0, arcano: 0, manha: 0, fe: 0 }
}

export function baseThresholds(): Thresholds {
  return { forca: 5, arcano: 5, manha: 5, fe: 5 }
}

/** Race + class grants. `livre` and `escolha2` are resolved at setup, not here. */
export function startingPools(raceId: string, classId: string, freeSuits: Suit[] = []): Pools {
  const pools = emptyPools()
  const grants = [raceById(raceId).poolGrants, classById(classId).poolGrants]
  for (const g of grants) {
    for (const [suit, value] of Object.entries(g)) {
      if (SUITS.includes(suit as Suit)) pools[suit as Suit] += value
      else for (const s of freeSuits) pools[s] += value
    }
  }
  return pools
}

function heroEffects(hero: Hero): Effect[] {
  const out: Effect[] = []
  out.push(...raceById(hero.raceId).effects)
  out.push(...classById(hero.classId).effects)
  for (const s of hero.specializations) out.push(...specById(s).effects)
  for (const w of hero.wounds) out.push(...afflictionById(w).effects)
  for (const s of hero.scars) out.push(...afflictionById(s).effects)
  return out
}

export function equippedLootIds(hero: Hero): string[] {
  return Object.values(hero.equipment).filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function equipmentEffects(hero: Hero): Effect[] {
  const out: Effect[] = []
  for (const id of equippedLootIds(hero)) {
    const l = lootById(id)
    out.push(...l.effects, ...l.drawback)
  }
  return out
}

export interface PoolContext {
  card?: DeckCard | null
  tableSize?: number
  soloEntry?: boolean
  declaredSuit?: Suit
  ignoreEquipment?: boolean
}

function scopeApplies(scope: string, ctx: PoolContext): boolean {
  const card = ctx.card
  switch (scope) {
    case 'always':
      return true
    case 'solo':
      return ctx.soloEntry === true
    case 'slots1':
      return !!card && slotsOf(card, ctx.tableSize ?? 4) === 1
    case 'slots3':
      return !!card && slotsOf(card, ctx.tableSize ?? 4) >= 3
    case 'vsEspectroHorda':
      return !!card && card.kind === 'obstacle' && ['Espectro', 'Horda'].includes(card.category)
    default:
      return false
  }
}

/** Pools after race, class, specializations, wounds, scars and equipment. */
export function derivedPools(hero: Hero, ctx: PoolContext = {}): Pools {
  const pools = { ...hero.pools }
  const effects = ctx.ignoreEquipment ? heroEffects(hero) : [...heroEffects(hero), ...equipmentEffects(hero)]

  for (const e of effects) {
    if (e.kind !== 'poolDelta') continue
    if (!scopeApplies(e.scope, ctx)) continue
    if (e.suit === 'best') {
      const best = SUITS.reduce((a, b) => (pools[b] > pools[a] ? b : a), SUITS[0])
      pools[best] += e.value
    } else if (e.suit === 'declared') {
      if (ctx.declaredSuit) pools[ctx.declaredSuit] += e.value
    } else if (e.suit === 'any') {
      for (const s of SUITS) pools[s] += e.value
    } else {
      pools[e.suit] += e.value
    }
  }

  // Every 3 Ferimentos: −1 die in every pool.
  const woundPenalty = Math.floor(hero.wounds.length / 3)
  for (const s of SUITS) pools[s] = Math.max(0, pools[s] - woundPenalty)

  return pools
}

/** Thresholds after every source, clamped to the 4+ / 5+ the game allows. */
export function derivedThresholds(hero: Hero, ctx: PoolContext = {}): Thresholds {
  const th = { ...hero.thresholds }
  const effects = ctx.ignoreEquipment ? heroEffects(hero) : [...heroEffects(hero), ...equipmentEffects(hero)]
  const raw: Record<Suit, number> = { ...th }

  for (const e of effects) {
    if (e.kind !== 'thresholdDelta') continue
    const targets = e.suit === null ? SUITS : [e.suit]
    for (const s of targets) raw[s] += e.value
  }
  if (ctx.card) {
    for (const e of cardEffects(ctx.card)) {
      if (e.kind !== 'thresholdDelta') continue
      const targets = e.suit === null ? SUITS : [e.suit]
      for (const s of targets) raw[s] += e.value
    }
    if (ctx.card.kind === 'boss' && ctx.card.thresholdDelta) {
      for (const s of SUITS) raw[s] += ctx.card.thresholdDelta
    }
  }

  for (const s of SUITS) th[s] = (Math.min(5, Math.max(4, raw[s])) as 4 | 5)
  return th
}

export function maxVigorOf(raceId: string): number {
  return raceById(raceId).vigor
}

/** Only the suits the hero actually has dice in. */
export function hasSuit(hero: Hero, suit: Suit, ctx: PoolContext = {}): boolean {
  return derivedPools(hero, ctx)[suit] > 0
}

export function bestSuit(hero: Hero, ctx: PoolContext = {}): Suit {
  const pools = derivedPools(hero, ctx)
  return SUITS.reduce((a, b) => (pools[b] > pools[a] ? b : a), SUITS[0])
}
