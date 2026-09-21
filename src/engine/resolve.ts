import type { DeckCard, OffSuitPolicy, Suit } from '../content/types'
import { afflictionById, classById, lootById, raceById, specById } from '../content'
import { cardEffects, cardSuits, slotsOf } from './card'
import { derivedPools, derivedThresholds, equippedLootIds } from './hero'
import type { ActorId, Entry, Hero, Squire } from './state'

export interface TargetModifier {
  source: string
  delta: number
}

export interface TargetContext {
  card: DeckCard
  mode: 'base' | 'duo'
  heroes: Hero[]
  squires: Squire[]
  slots: (ActorId | null)[]
  furias: number
  bossRetryBonus: number
  /** Boss phase II only: who entered phase I, for the cards that care. */
  previousPhaseParticipants?: ActorId[]
}

export function participants(ctx: { heroes: Hero[]; squires: Squire[]; slots: (ActorId | null)[] }): {
  heroes: Hero[]
  squires: Squire[]
} {
  const ids = new Set(ctx.slots.filter((s): s is ActorId => !!s))
  return {
    heroes: ctx.heroes.filter((h) => ids.has(h.id)),
    squires: ctx.squires.filter((s) => ids.has(s.id)),
  }
}

/**
 * The effective target, with every modifier kept so the end-of-run screen can
 * show where each point came from. Never rendered during `deciding`.
 */
export function effectiveTarget(ctx: TargetContext): { target: number; modifiers: TargetModifier[] } {
  const { card } = ctx
  const mods: TargetModifier[] = []
  let target = card.target

  const filled = ctx.slots.filter(Boolean).length
  const totalSlots = slotsOf(card, ctx.heroes.length + ctx.squires.length)

  for (const e of cardEffects(card)) {
    if (e.kind === 'targetIfSlotsFull' && filled >= totalSlots && filled > 0) {
      mods.push({ source: 'vagas cheias', delta: e.value - target })
      target = e.value
    }
    if (e.kind === 'targetDelta') {
      if (e.when === 'perParticipantWound') {
        const wounds = participants(ctx).heroes.reduce((n, h) => n + h.wounds.length, 0)
        if (wounds) {
          mods.push({ source: 'ferimentos dos participantes', delta: e.value * wounds })
          target += e.value * wounds
        }
      } else if (e.when === 'perDownedHero') {
        const downed = ctx.heroes.filter((h) => h.down).length
        if (downed) {
          mods.push({ source: 'heróis caídos', delta: e.value * downed })
          target += e.value * downed
        }
      } else if (e.when === 'always') {
        mods.push({ source: 'carta', delta: e.value })
        target += e.value
      }
    }
  }

  // Duo: every 2-slot obstacle is worth target −1.
  if (ctx.mode === 'duo' && card.kind === 'obstacle' && card.slots === 2) {
    mods.push({ source: 'duo · obstáculo de 2 vagas', delta: -1 })
    target -= 1
  }

  // Participants' own target modifiers (Lábia, Veneno via crits handled at resolve).
  for (const hero of participants(ctx).heroes) {
    for (const e of heroTargetEffects(hero)) {
      if (e.when === 'ifParticipating') {
        mods.push({ source: `${hero.name} · carta`, delta: e.value })
        target += e.value
      }
    }
  }

  // Duo: each Fúria adds +1 to the target of the phases that follow.
  if (ctx.mode === 'duo' && card.kind === 'boss' && ctx.furias > 0) {
    mods.push({ source: `${ctx.furias} Fúria(s)`, delta: ctx.furias })
    target += ctx.furias
  }

  // Base: a failed boss phase repeats asking +1 success.
  if (ctx.mode === 'base' && card.kind === 'boss' && ctx.bossRetryBonus > 0) {
    mods.push({ source: 'tentativa repetida', delta: ctx.bossRetryBonus })
    target += ctx.bossRetryBonus
  }

  return { target: Math.max(1, target), modifiers: mods }
}

function heroTargetEffects(hero: Hero): { when: string; value: number }[] {
  const out: { when: string; value: number }[] = []
  const all = [
    ...raceById(hero.raceId).effects,
    ...classById(hero.classId).effects,
    ...hero.specializations.flatMap((s) => specById(s).effects),
  ]
  for (const e of all) if (e.kind === 'targetDelta') out.push({ when: e.when, value: e.value })
  return out
}

/** Which off-suit rule is in force for this card and this hero. */
export function offSuitPolicyFor(card: DeckCard, hero: Hero | null): OffSuitPolicy {
  for (const e of cardEffects(card)) {
    if (e.kind === 'offSuitPolicy') return e.policy
  }
  if (hero) {
    const all = [
      ...classById(hero.classId).effects,
      ...hero.specializations.flatMap((s) => specById(s).effects),
    ]
    for (const e of all) {
      if (e.kind !== 'offSuitPolicy') continue
      if (e.onlySuit && !cardSuits(card).includes(e.onlySuit)) continue
      return e.policy
    }
  }
  return 'half'
}

/** The declared raw successes turned into successes that count. */
export function countSuccesses(declared: number, offSuit: boolean, policy: OffSuitPolicy): number {
  if (!offSuit) return declared
  if (policy === 'full') return declared
  if (policy === 'none') return 0
  return Math.floor(declared / 2)
}

export interface ActorRollSpec {
  actorId: ActorId
  name: string
  suit: Suit
  offSuit: boolean
  poolSize: number
  threshold: 4 | 5
  policy: OffSuitPolicy
}

/**
 * What each participant rolls for this card: pool size, threshold, and whether
 * they are off-suit. This is what the roll-entry screen prints.
 */
export function rollSpecFor(
  actorId: ActorId,
  ctx: TargetContext,
  declaredSuit?: Suit,
): ActorRollSpec | null {
  const { card } = ctx
  const suits = cardSuits(card)
  const tableSize = ctx.heroes.length + ctx.squires.length
  const solo = ctx.slots.filter(Boolean).length === 1

  const squire = ctx.squires.find((s) => s.id === actorId)
  if (squire) {
    let pool = squire.pool
    for (const e of cardEffects(card)) {
      if (e.kind === 'poolDelta' && e.scope === 'squire') pool += e.value
    }
    return {
      actorId,
      name: squire.name,
      suit: squire.suit,
      offSuit: !suits.includes(squire.suit),
      poolSize: Math.max(0, pool),
      threshold: 5,
      policy: offSuitPolicyFor(card, null),
    }
  }

  const hero = ctx.heroes.find((h) => h.id === actorId)
  if (!hero) return null

  const ignoreEquipment = cardEffects(card).some((e) => e.kind === 'ignoreEquipment')
  const poolCtx = { card, tableSize, soloEntry: solo, declaredSuit, ignoreEquipment }
  const pools = derivedPools(hero, poolCtx)
  const thresholds = derivedThresholds(hero, poolCtx)

  // On-suit if the hero has dice in one of the card's suits; otherwise their best pool, off-suit.
  const onSuit = suits
    .filter((s) => pools[s] > 0)
    .sort((a, b) => pools[b] - pools[a])[0]
  const suit =
    declaredSuit ?? onSuit ?? (['forca', 'arcano', 'manha', 'fe'] as Suit[])
      .sort((a, b) => pools[b] - pools[a])[0]

  let poolSize = pools[suit]
  if (ctx.previousPhaseParticipants?.includes(actorId)) {
    for (const e of cardEffects(card)) {
      if (e.kind === 'poolDelta' && e.scope === 'previousPhaseParticipants') poolSize += e.value
    }
  }

  return {
    actorId,
    name: hero.name,
    suit,
    offSuit: !suits.includes(suit),
    poolSize: Math.max(0, poolSize),
    threshold: thresholds[suit],
    policy: offSuitPolicyFor(card, hero),
  }
}

export function declaredTotal(entries: Entry[]): number {
  return entries.reduce((n, e) => n + e.countedSuccesses, 0)
}

export function verdict(total: number, target: number): 'vitoria' | 'falha' {
  return total >= target ? 'vitoria' : 'falha'
}

export interface DamageSplit {
  assignment: { heroId: string; points: number }[]
  remainder: number
  /** Heroes for whom this damage would exceed the vigor left, turning into a Cicatriz. */
  wouldScar: { heroId: string; excess: number }[]
}

function damageModifiersFor(hero: Hero): { delta: number; cap: number | null } {
  let delta = 0
  let cap: number | null = null
  const all = [
    ...raceById(hero.raceId).effects,
    ...classById(hero.classId).effects,
    ...hero.specializations.flatMap((s) => specById(s).effects),
    ...hero.wounds.flatMap((w) => afflictionById(w).effects),
    ...hero.scars.flatMap((s) => afflictionById(s).effects),
    ...equippedLootIds(hero).flatMap((id) => [...lootById(id).effects, ...lootById(id).drawback]),
  ]
  for (const e of all) {
    if (e.kind === 'damageDelta' && e.scope !== 'card') delta += e.value
    if (e.kind === 'damageCap') cap = cap === null ? e.value : Math.min(cap, e.value)
  }
  return { delta, cap }
}

/** Card-wide damage reduction — the Guardião's "o dano total da carta cai em 1". */
export function cardDamage(card: DeckCard, participantHeroes: Hero[], crits: number): number {
  let damage = card.damage
  for (const hero of participantHeroes) {
    const all = [...classById(hero.classId).effects, ...raceById(hero.raceId).effects]
    for (const e of all) if (e.kind === 'damageDelta' && e.scope === 'card') damage += e.value
  }
  for (const e of cardEffects(card)) {
    if (e.kind === 'onCrit' && e.grant === 'damageReduction') damage -= crits
  }
  return Math.max(0, damage)
}

/**
 * Pre-divides the damage equally. The remainder goes to a central pot that
 * somebody has to claim — the app never assigns it on its own.
 */
export function splitDamage(total: number, heroes: Hero[]): DamageSplit {
  if (heroes.length === 0) return { assignment: [], remainder: total, wouldScar: [] }
  const each = Math.floor(total / heroes.length)
  const remainder = total - each * heroes.length

  const assignment = heroes.map((h) => {
    const { delta, cap } = damageModifiersFor(h)
    let points = each + delta
    points = Math.max(each > 0 ? 1 : 0, points)
    if (cap !== null) points = Math.min(points, cap)
    return { heroId: h.id, points }
  })

  const wouldScar = assignment
    .map(({ heroId, points }) => {
      const hero = heroes.find((h) => h.id === heroId)!
      const excess = Math.max(0, points - hero.vigor)
      return { heroId, excess }
    })
    .filter((x) => x.excess > 0)

  return { assignment, remainder, wouldScar }
}

/** Who took the fewest successes — the manual's default for the leftover point. */
export function lowestScorer(entries: Entry[]): ActorId | null {
  if (!entries.length) return null
  return [...entries].sort((a, b) => a.countedSuccesses - b.countedSuccesses)[0].actorId
}

/** Loot order: most successes first, with Orgulho Ferido / Nome nos Registros last. */
export function lootOrder(entries: Entry[], heroes: Hero[]): ActorId[] {
  const lastPlaced = new Set(
    heroes
      .filter((h) =>
        [...h.wounds, ...h.scars].some((id) =>
          afflictionById(id).effects.some((e) => e.kind === 'lootOrder' && e.position === 'last'),
        ),
      )
      .map((h) => h.id),
  )
  return [...entries]
    .sort((a, b) => {
      const al = lastPlaced.has(a.actorId) ? 1 : 0
      const bl = lastPlaced.has(b.actorId) ? 1 : 0
      if (al !== bl) return al - bl
      return b.countedSuccesses - a.countedSuccesses
    })
    .map((e) => e.actorId)
}
