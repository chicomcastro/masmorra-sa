import { afflictionById, cardById, content, lootById, squireById } from '../content'
import { SUITS } from '../content/types'
import type { DeckCard, Suit } from '../content/types'
import { cardEffects, cardSuits, slotsOf } from '../engine/card'
import { buildDeck } from '../engine/deck'
import { baseThresholds, derivedPools, maxVigorOf, startingPools } from '../engine/hero'
import { makeRng, randomSeed } from '../engine/prng'
import { computeHiddenMath } from '../engine/probability'
import {
  cardDamage,
  countSuccesses,
  effectiveTarget,
  offSuitPolicyFor,
  participants,
  rollSpecFor,
  splitDamage,
} from '../engine/resolve'
import type { TargetContext } from '../engine/resolve'
import type {
  ActorId,
  CurrentCard,
  Entry,
  GameEvent,
  Hero,
  Piles,
  ResolvedCard,
  Run,
  Squire,
} from '../engine/state'
import type { Action, HeroSetup } from './actions'
import { mergeBundle } from './export'
import { APP_VERSION, SCHEMA_VERSION, type AppState } from './state'

// ---------------------------------------------------------------- utilidades

function uuid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function msBetween(from: string | null, to: string): number | null {
  if (!from) return null
  return new Date(to).getTime() - new Date(from).getTime()
}

/** Todo evento nasce aqui. A UI nunca escreve no log. */
function emit(run: Run, type: string, payload: Record<string, unknown>): Run {
  const event: GameEvent = {
    id: `${run.id}:${run.events.length}`,
    runId: run.id,
    t: now(),
    type,
    payload,
  }
  return { ...run, events: [...run.events, event] }
}

function rngFor(run: Run) {
  return makeRng(run.seed, run.rngCalls)
}

// ------------------------------------------------------------------- baralhos

type PileName = 'loot' | 'wound' | 'scar'

function draw(run: Run, pile: PileName, n: number): { run: Run; drawn: string[] } {
  const rng = rngFor(run)
  const piles: Piles = { ...run.piles }
  const drawn: string[] = []
  const discardKey = `${pile}Discard` as const

  for (let i = 0; i < n; i++) {
    if (piles[pile].length === 0) {
      piles[pile] = rng.shuffle(piles[discardKey])
      piles[discardKey] = []
    }
    const card = piles[pile][0]
    if (!card) break
    piles[pile] = piles[pile].slice(1)
    drawn.push(card)
  }

  return { run: { ...run, piles, rngCalls: rng.calls }, drawn }
}

function discard(run: Run, pile: PileName, ids: string[]): Run {
  const discardKey = `${pile}Discard` as const
  return { ...run, piles: { ...run.piles, [discardKey]: [...run.piles[discardKey], ...ids] } }
}

// --------------------------------------------------------------------- heróis

function updateHero(run: Run, heroId: string, fn: (h: Hero) => Hero): Run {
  return { ...run, heroes: run.heroes.map((h) => (h.id === heroId ? fn(h) : h)) }
}

function heroById(run: Run, id: string): Hero | undefined {
  return run.heroes.find((h) => h.id === id)
}

function buildHero(setup: HeroSetup): Hero {
  const pools = startingPools(setup.raceId, setup.classId, setup.freeSuits)
  const maxVigor = maxVigorOf(setup.raceId)
  return {
    id: uuid(),
    profileId: setup.profileId,
    name: setup.name,
    raceId: setup.raceId,
    classId: setup.classId,
    pools,
    thresholds: baseThresholds(),
    vigor: maxVigor,
    maxVigor,
    wounds: [],
    scars: [],
    xp: 0,
    pendingMarcos: 0,
    specializations: [],
    equipment: {},
    consumables: [],
    down: false,
  }
}

// ---------------------------------------------------------------- contexto

export function targetContextFor(run: Run, card: DeckCard, slots: (ActorId | null)[]): TargetContext {
  return {
    card,
    mode: run.mode,
    heroes: run.heroes,
    squires: run.squires,
    slots,
    furias: run.furias,
    bossRetryBonus: run.bossRetryBonus,
    previousPhaseParticipants: run.lastBossParticipants,
  }
}

export function tableSize(run: Run): number {
  return run.heroes.length + run.squires.filter((s) => !s.retired).length
}

/** Quem pode legalmente ocupar uma vaga nesta carta. */
export function eligibleActors(run: Run, card: DeckCard): ActorId[] {
  const out: ActorId[] = []
  const slots = slotsOf(card, tableSize(run))

  for (const hero of run.heroes) {
    if (hero.down) continue
    const forbidden = [...hero.wounds, ...hero.scars].flatMap((id) => afflictionById(id).effects)
    if (slots === 1 && forbidden.some((e) => e.kind === 'forbid' && e.what === 'slot1Entry')) continue
    const suits = cardSuits(card)
    const pools = derivedPools(hero, { card, tableSize: tableSize(run) })
    const hasSuit = suits.some((s) => pools[s] > 0)
    if (!hasSuit && forbidden.some((e) => e.kind === 'forbid' && e.what === 'offSuitEntry')) continue
    if (card.kind === 'boss' && card.phase === 2) {
      const blocked = cardEffects(card).some((e) => e.kind === 'forbid' && e.what === 'previousPhaseParticipants')
      if (blocked && run.lastBossParticipants.includes(hero.id)) continue
    }
    out.push(hero.id)
  }

  for (const squire of run.squires) {
    if (!squire.retired) out.push(squire.id)
  }

  return out
}

export function actorName(run: Run, id: ActorId): string {
  return heroById(run, id)?.name ?? run.squires.find((s) => s.id === id)?.name ?? id
}

// -------------------------------------------------------------------- carta

function freshCurrent(run: Run, cardId: string): CurrentCard {
  const card = cardById(cardId)
  const slots = slotsOf(card, tableSize(run))
  return {
    cardId,
    revealedAt: now(),
    committedAt: null,
    resolvedAt: null,
    slots: new Array(slots).fill(null),
    baseTarget: card.target,
    effectiveTarget: card.target,
    targetModifiers: [],
    entries: [],
    consumablesPlayed: [],
    declaredTotal: 0,
    result: null,
    damageAssignment: [],
    hidden: null,
    bossPhaseIndex: card.kind === 'boss' ? ((card.phase - 1) as 0 | 1 | 2) : undefined,
    lootOffers: [],
    damageRemainder: 0,
    damageDecidedAt: null,
    manualNotes: [],
  }
}

function archiveCurrent(run: Run, result: 'vitoria' | 'falha' | 'recuo'): Run {
  const current = run.current!
  const card = cardById(current.cardId)
  const resolved: ResolvedCard = {
    ...current,
    result,
    resolvedAt: current.resolvedAt ?? now(),
    position: run.resolved.length,
    floor: card.kind === 'boss' ? 'boss' : card.floor,
  }
  const lastBossParticipants =
    card.kind === 'boss' && card.phase === 1
      ? current.slots.filter((s): s is string => !!s)
      : run.lastBossParticipants
  return { ...run, resolved: [...run.resolved, resolved], current: null, lastBossParticipants }
}

// ------------------------------------------------------------------- derrota

function bossPhasesLeft(run: Run): boolean {
  return run.deck.some((id) => cardById(id).kind === 'boss')
}

function checkDefeat(run: Run): Run {
  if (run.outcome) return run

  if (run.mode === 'duo' && run.furias >= 3) {
    return end(run, 'derrota', 'furias')
  }
  if (run.heroes.every((h) => h.down)) {
    return end(run, 'derrota', 'caidos')
  }
  if (run.deck.length === 0 && !run.current && bossPhasesLeft(run) === false && run.outcome === null) {
    // Só é derrota por monte se o chefe não foi fechado.
    const bossClosed = run.resolved.some((r) => {
      const c = cardById(r.cardId)
      return c.kind === 'boss' && c.phase === 3 && r.result === 'vitoria'
    })
    if (!bossClosed) return end(run, 'derrota', 'monte')
  }
  return run
}

function end(run: Run, outcome: 'vitoria' | 'derrota' | 'abandono', cause: Run['defeatCause']): Run {
  const ended: Run = {
    ...run,
    outcome,
    defeatCause: cause,
    endedAt: now(),
    phase: 'ended',
    current: null,
  }
  return emit(ended, 'run_ended', {
    outcome,
    defeatCause: cause,
    atCard: run.resolved.length,
    deckRemaining: run.deck.length,
    heroesFinal: run.heroes.map((h) => ({
      id: h.id,
      name: h.name,
      vigor: h.vigor,
      wounds: h.wounds.length,
      scars: h.scars,
      xp: h.xp,
      down: h.down,
    })),
    totalMs: msBetween(run.startedAt, now()),
  })
}

// ------------------------------------------------------------------ preparo

function startRun(state: AppState, action: Extract<Action, { type: 'START_RUN' }>): AppState {
  const seed = action.seed ?? randomSeed()
  const rng = makeRng(seed)
  const { deck, bossId, composition } = buildDeck(action.mode, rng)

  const heroes = action.heroes.map(buildHero).map((hero) => {
    const profile = state.profiles.find((p) => p.id === hero.profileId)
    return profile ? { ...hero, scars: [...profile.scars] } : hero
  })

  const squires: Squire[] = action.squireIds.map((id) => {
    const s = squireById(id)
    return { id: uuid(), squireId: id, suit: s.suit, name: s.name, pool: s.pool, retired: false }
  })

  const piles: Piles = {
    loot: rng.shuffle(content.loot.map((l) => l.id)),
    lootDiscard: [],
    wound: rng.shuffle(content.wounds.map((w) => w.id)),
    woundDiscard: [],
    scar: rng.shuffle(content.scars.map((s) => s.id)),
    scarDiscard: [],
  }

  let run: Run = {
    id: uuid(),
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngCalls: rng.calls,
    mode: action.mode,
    startedAt: now(),
    endedAt: null,
    appVersion: APP_VERSION,
    contentVersion: content.contentVersion,
    heroes,
    squires,
    deck,
    bossId,
    deckComposition: composition as unknown as Record<string, string[]>,
    resolved: [],
    discardedUnseen: [],
    current: null,
    phase: 'awaitingReveal',
    furias: 0,
    bossPhaseIndex: 0,
    bossRetryBonus: 0,
    outcome: null,
    defeatCause: null,
    events: [],
    debrief: null,
    restCount: 0,
    piles,
    rest: null,
    lastBossParticipants: [],
  }

  run = emit(run, 'run_started', {
    mode: action.mode,
    seed,
    heroes: heroes.map((h) => ({
      id: h.id,
      name: h.name,
      raceId: h.raceId,
      classId: h.classId,
      pools: h.pools,
      scars: h.scars,
    })),
    squires: squires.map((s) => s.squireId),
    deckComposition: composition,
    bossId,
    appVersion: APP_VERSION,
    contentVersion: content.contentVersion,
  })

  return { ...state, currentRun: run, undo: null }
}

/** Duo: os naipes que nenhum dos dois cobre ganham um Escudeiro. */
export function suggestedSquires(heroes: HeroSetup[]): string[] {
  const covered = new Set<Suit>()
  for (const h of heroes) {
    const pools = startingPools(h.raceId, h.classId, h.freeSuits)
    for (const s of SUITS) if (pools[s] > 0) covered.add(s)
  }
  return SUITS.filter((s) => !covered.has(s)).map((s) => `squire-${s}`)
}

// -------------------------------------------------------------------- rodada

function revealCard(run: Run): Run {
  if (!run.deck.length) return checkDefeat(run)
  const cardId = run.deck[0]
  const card = cardById(cardId)
  const deck = run.deck.slice(1)
  const current = freshCurrent({ ...run, deck }, cardId)

  let next: Run = { ...run, deck, current }
  next = emit(next, 'card_revealed', {
    cardId,
    floor: card.kind === 'boss' ? 'boss' : card.floor,
    deckRemaining: deck.length,
    position: run.resolved.length,
  })

  if (card.kind === 'boss') {
    // O Escudeiro volta no descanso e antes do chefe.
    if (card.phase === 1) {
      next = { ...next, squires: next.squires.map((s) => ({ ...s, retired: false })) }
    }
    next = emit(next, 'boss_phase_started', {
      bossId: card.bossId,
      phase: card.phase,
      suit: card.suit,
      target: card.target,
      retryBonus: run.bossRetryBonus,
      furias: run.furias,
    })
    // Fase III não tem vagas: a mesa inteira entra e o app pula a decisão.
    if (card.slots === 'all') {
      const all = eligibleActors(next, card)
      const withSlots: CurrentCard = { ...current, slots: all }
      return commitSlots({ ...next, current: withSlots, phase: 'bossPhase' })
    }
    return { ...next, phase: 'bossPhase' }
  }

  return { ...next, phase: 'deciding' }
}

function toggleSlot(run: Run, actorId: string): Run {
  const current = run.current
  if (!current) return run
  const card = cardById(current.cardId)
  const index = current.slots.indexOf(actorId)

  let slots: (string | null)[]
  let action: 'in' | 'out'
  let slotIndex: number

  if (index >= 0) {
    slots = current.slots.map((s, i) => (i === index ? null : s))
    action = 'out'
    slotIndex = index
  } else {
    const free = current.slots.indexOf(null)
    if (free < 0) return run
    slots = current.slots.map((s, i) => (i === free ? actorId : s))
    action = 'in'
    slotIndex = free
  }

  return emit({ ...run, current: { ...current, slots } }, 'slot_toggled', {
    cardId: current.cardId,
    heroId: actorId,
    action,
    slotIndex,
    isSquire: !heroById(run, actorId),
    cardSlots: slotsOf(card, tableSize(run)),
  })
}

/**
 * O momento em que a matemática oculta é calculada e gravada. Nada disso volta
 * para a tela antes de `resolving`.
 */
function commitSlots(run: Run): Run {
  const current = run.current
  if (!current) return run
  const card = cardById(current.cardId)
  const chosen = current.slots.filter((s): s is string => !!s)
  if (!chosen.length) return run

  const { target, modifiers } = effectiveTarget(targetContextFor(run, card, current.slots))
  const eligible = eligibleActors(run, card)
  const maxSlots = slotsOf(card, tableSize(run))

  const hidden = computeHiddenMath({
    chosen,
    target,
    eligible,
    maxSlots,
    specFor: (id, group) => {
      const padded: (string | null)[] = [...group]
      while (padded.length < maxSlots) padded.push(null)
      return rollSpecFor(id, targetContextFor(run, card, padded))
    },
    targetFor: (group) => {
      const padded: (string | null)[] = [...group]
      while (padded.length < maxSlots) padded.push(null)
      return effectiveTarget(targetContextFor(run, card, padded)).target
    },
  })

  const committedAt = now()
  const committed: CurrentCard = {
    ...current,
    committedAt,
    effectiveTarget: target,
    targetModifiers: modifiers,
    hidden,
  }

  const next = emit({ ...run, current: committed, phase: 'entering' }, 'card_committed', {
    cardId: current.cardId,
    slots: chosen,
    eligibleAbstained: hidden.eligibleAbstained,
    effectiveTarget: target,
    targetModifiers: modifiers,
    hidden: {
      expectedTotal: hidden.expectedTotal,
      winProbability: hidden.winProbability,
      bestAlternative: hidden.bestAlternative,
    },
    deliberationMs: msBetween(current.revealedAt, committedAt),
  })
  return next
}

function retreatCost(run: Run): number {
  return run.mode === 'duo' ? 1 : 2
}

function retreat(run: Run): Run {
  const current = run.current
  if (!current) return run
  // A carta é descartada e mais uma vai junto, sem revelar (1 no Duo).
  const extra = retreatCost(run) - 1
  const burned = run.deck.slice(0, extra)
  const deck = run.deck.slice(extra)

  let next: Run = {
    ...run,
    deck,
    discardedUnseen: [...run.discardedUnseen, ...burned],
    current: { ...current, result: 'recuo', resolvedAt: now() },
  }
  next = emit(next, 'retreat_declared', {
    cardId: current.cardId,
    cardsBurned: retreatCost(run),
    deckAfter: deck.length,
  })
  next = archiveCurrent(next, 'recuo')
  return checkDefeat({ ...next, phase: 'awaitingReveal' })
}

function declareEntry(run: Run, actorId: string, declared: number, crits: number | null): Run {
  const current = run.current
  if (!current) return run
  const card = cardById(current.cardId)
  const spec = rollSpecFor(actorId, targetContextFor(run, card, current.slots))
  if (!spec) return run

  const hero = heroById(run, actorId)
  const policy = offSuitPolicyFor(card, hero ?? null)
  const counted = countSuccesses(declared, spec.offSuit, policy)
  const previous = current.entries.find((e) => e.actorId === actorId)

  const entry: Entry = {
    actorId,
    suit: spec.suit,
    offSuit: spec.offSuit,
    poolSize: spec.poolSize,
    threshold: spec.threshold,
    declaredSuccesses: declared,
    countedSuccesses: counted,
    crits,
    enteredAt: now(),
    correctedFrom: previous ? previous.declaredSuccesses : null,
  }

  const entries = previous
    ? current.entries.map((e) => (e.actorId === actorId ? entry : e))
    : [...current.entries, entry]

  let next: Run = { ...run, current: { ...current, entries } }

  if (previous) {
    next = emit(next, 'entry_corrected', {
      cardId: current.cardId,
      actorId,
      from: previous.declaredSuccesses,
      to: declared,
    })
  } else {
    const expected = current.hidden?.expectedByActor.find((x) => x.id === actorId)?.expected ?? null
    const previousEntry = current.entries[current.entries.length - 1]
    next = emit(next, 'entry_declared', {
      cardId: current.cardId,
      actorId,
      suit: spec.suit,
      offSuit: spec.offSuit,
      poolSize: spec.poolSize,
      threshold: spec.threshold,
      declared,
      counted,
      crits,
      expectedForActor: expected,
      latencyMs: msBetween(previousEntry?.enteredAt ?? current.committedAt, entry.enteredAt),
    })
  }

  const chosen = current.slots.filter(Boolean)
  const done = chosen.every((id) => entries.some((e) => e.actorId === id))
  return done ? { ...next, phase: 'resolving' } : next
}

function confirmVerdict(run: Run): Run {
  const current = run.current
  if (!current) return run
  const total = current.entries.reduce((n, e) => n + e.countedSuccesses, 0)
  const result: 'vitoria' | 'falha' = total >= current.effectiveTarget ? 'vitoria' : 'falha'
  const resolvedAt = now()

  let next: Run = {
    ...run,
    current: { ...current, declaredTotal: total, result, resolvedAt },
    phase: 'consequences',
  }

  next = emit(next, 'card_resolved', {
    cardId: current.cardId,
    result,
    declaredTotal: total,
    effectiveTarget: current.effectiveTarget,
    margin: total - current.effectiveTarget,
    durationMs: msBetween(current.revealedAt, resolvedAt),
  })

  return result === 'vitoria' ? prepareLoot(next) : prepareDamage(next)
}

// -------------------------------------------------------------- consequências

/** Vitória não machuca. Cada participante compra 2 Espólios e fica com 1. */
function prepareLoot(run: Run): Run {
  const current = run.current!
  const heroIds = current.slots.filter((s): s is string => !!s && !!heroById(run, s))
  let next = run
  const offers = []

  for (const heroId of heroIds) {
    const hero = heroById(next, heroId)!
    const extra = [...hero.wounds, ...hero.scars]
      .flatMap((id) => afflictionById(id).effects)
      .reduce((n, e) => (e.kind === 'lootDraw' ? Math.max(n, e.value) : n), 2)
    const result = draw(next, 'loot', extra)
    next = result.run
    offers.push({ heroId, offered: result.drawn, chosen: null, equippedTo: null, displaced: null })
    next = emit(next, 'loot_offered', { heroId, cardId: current.cardId, offered: result.drawn })
  }

  // +1 XP por participante; quem fechar 2 XP abre o Marco na hora.
  for (const heroId of heroIds) {
    next = updateHero(next, heroId, (h) => {
      const xp = h.xp + 1
      return xp >= 2 ? { ...h, xp: xp - 2, pendingMarcos: h.pendingMarcos + 1 } : { ...h, xp }
    })
    next = emit(next, 'xp_gained', { heroId, cardId: current.cardId, amount: 1 })
  }

  return { ...next, current: { ...next.current!, lootOffers: offers } }
}

function prepareDamage(run: Run): Run {
  const current = run.current!
  const { heroes: partHeroes, squires: partSquires } = participants({
    heroes: run.heroes,
    squires: run.squires,
    slots: current.slots,
  })

  const crits = current.entries.reduce((n, e) => n + (e.crits ?? 0), 0)
  let damage = cardDamage(cardById(current.cardId), partHeroes, crits)

  // Duo: o Escudeiro absorve 1 ponto e se retira.
  let next = run
  for (const squire of partSquires) {
    if (damage <= 0) break
    damage -= 1
    next = { ...next, squires: next.squires.map((s) => (s.id === squire.id ? { ...s, retired: true } : s)) }
    next = emit(next, 'squire_retired', { squireId: squire.squireId, cardId: current.cardId, absorbed: 1 })
  }

  const split = splitDamage(damage, partHeroes)
  return {
    ...next,
    current: {
      ...next.current!,
      damageAssignment: split.assignment,
      damageRemainder: split.remainder,
    },
  }
}

function applyDamage(run: Run, assignment: { heroId: string; points: number }[]): Run {
  const current = run.current!
  let next = run

  for (const { heroId, points } of assignment) {
    if (points <= 0) continue
    const hero = heroById(next, heroId)!
    const toVigor = Math.min(points, hero.vigor)
    const excess = points - toVigor

    const wounds = draw(next, 'wound', toVigor)
    next = wounds.run
    for (const w of wounds.drawn) {
      next = emit(next, 'wound_drawn', { heroId, cardId: current.cardId, woundId: w, cause: 'damage' })
    }

    const scars = excess > 0 ? draw(next, 'scar', excess) : { run: next, drawn: [] as string[] }
    next = scars.run
    for (const s of scars.drawn) {
      next = emit(next, 'scar_drawn', { heroId, cardId: current.cardId, scarId: s, cause: 'damage' })
    }

    next = updateHero(next, heroId, (h) => ({
      ...h,
      vigor: h.vigor - toVigor,
      wounds: [...h.wounds, ...wounds.drawn],
      scars: [...h.scars, ...scars.drawn],
      down: h.vigor - toVigor <= 0,
    }))

    const after = heroById(next, heroId)!
    if (after.down && !hero.down) {
      next = emit(next, 'hero_downed', { heroId, atCard: run.resolved.length })
    }
  }

  next = emit(next, 'damage_assigned', {
    cardId: current.cardId,
    assignment,
    overflowTo: null,
    overflowVolunteered: current.damageRemainder > 0,
    decisionMs: msBetween(current.resolvedAt, now()),
  })

  return { ...next, current: { ...next.current!, damageAssignment: assignment, damageRemainder: 0, damageDecidedAt: now() } }
}


function equipInto(run: Run, heroId: string, lootId: string, slot: string): { run: Run; displaced: string | null } {
  const hero = heroById(run, heroId)!
  const displaced = (hero.equipment as Record<string, string | null>)[slot] ?? null
  let next = updateHero(run, heroId, (h) => ({ ...h, equipment: { ...h.equipment, [slot]: lootId } }))
  const loot = lootById(lootId)
  if (loot.handsUsed === 2) {
    const other = slot === 'maoA' ? 'maoB' : 'maoA'
    const otherItem = (hero.equipment as Record<string, string | null>)[other] ?? null
    if (otherItem) next = discard(next, 'loot', [otherItem])
    next = updateHero(next, heroId, (h) => ({ ...h, equipment: { ...h.equipment, [other]: null } }))
  }
  if (displaced) next = discard(next, 'loot', [displaced])
  return { run: next, displaced }
}

function takeLoot(run: Run, heroId: string, chosen: string, equippedTo: string | null): Run {
  const current = run.current!
  const offer = current.lootOffers.find((o) => o.heroId === heroId)
  if (!offer || offer.chosen) return run

  const returned = offer.offered.filter((id) => id !== chosen)
  let next = discard(run, 'loot', returned)
  const loot = lootById(chosen)
  let displaced: string | null = null

  if (loot.lootType === 'consumable' || loot.lootType === 'trinket') {
    next = updateHero(next, heroId, (h) => ({ ...h, consumables: [...h.consumables, chosen] }))
  } else if (equippedTo) {
    const result = equipInto(next, heroId, chosen, equippedTo)
    next = result.run
    displaced = result.displaced
  } else {
    next = updateHero(next, heroId, (h) => ({ ...h, consumables: [...h.consumables, chosen] }))
  }

  next = emit(next, 'loot_taken', {
    heroId,
    cardId: current.cardId,
    offered: offer.offered,
    chosen,
    equippedTo,
    displaced,
  })

  return {
    ...next,
    current: {
      ...next.current!,
      lootOffers: next.current!.lootOffers.map((o) =>
        o.heroId === heroId ? { ...o, chosen, equippedTo, displaced } : o,
      ),
    },
  }
}

function spendMarco(
  run: Run,
  heroId: string,
  choice: 'amplitude' | 'apuro' | 'arte',
  detail: string,
): Run {
  const hero = heroById(run, heroId)
  if (!hero || hero.pendingMarcos <= 0) return run
  const openedAt = run.current?.resolvedAt ?? run.rest?.startedAt ?? null

  let next = updateHero(run, heroId, (h) => {
    const base = { ...h, pendingMarcos: h.pendingMarcos - 1 }
    if (choice === 'amplitude') {
      const suit = detail as Suit
      return { ...base, pools: { ...h.pools, [suit]: h.pools[suit] + 1 } }
    }
    if (choice === 'apuro') {
      const suit = detail as Suit
      return { ...base, thresholds: { ...h.thresholds, [suit]: 4 as const } }
    }
    return { ...base, specializations: [...h.specializations, detail] }
  })

  next = emit(next, 'marco_spent', {
    heroId,
    choice,
    detail,
    decisionMs: msBetween(openedAt, now()),
  })
  return next
}

/** Sai de `consequences`: guarda a carta, decide o próximo estado, testa derrota. */
function advance(run: Run): Run {
  const current = run.current
  if (!current || !current.result) return run
  const card = cardById(current.cardId)
  const result = current.result as 'vitoria' | 'falha'

  let next = run

  if (card.kind === 'boss') {
    if (result === 'vitoria') {
      next = archiveCurrent(next, result)
      next = { ...next, bossRetryBonus: 0 }
      if (card.phase === 3) return end(next, 'vitoria', null)
      return checkDefeat({ ...next, phase: 'awaitingReveal' })
    }

    // Falha numa fase.
    if (run.mode === 'duo') {
      next = { ...next, furias: next.furias + 1 }
      next = emit(next, 'furia_gained', { phase: card.phase, total: next.furias })
      next = archiveCurrent(next, result)
      if (next.furias >= 3) return end(next, 'derrota', 'furias')
      // Fases I e II são tentadas uma vez só: a descida avança.
      if (card.phase === 3) {
        return retryPhase(next, card.id)
      }
      return checkDefeat({ ...next, phase: 'awaitingReveal' })
    }

    // Base: repete a mesma fase pedindo +1 sucesso.
    next = archiveCurrent(next, result)
    next = { ...next, bossRetryBonus: next.bossRetryBonus + 1 }
    return retryPhase(next, card.id)
  }

  next = archiveCurrent(next, result)
  return checkDefeat({ ...next, phase: 'awaitingReveal' })
}

function retryPhase(run: Run, cardId: string): Run {
  const withDefeat = checkDefeat(run)
  if (withDefeat.outcome) return withDefeat
  return revealCard({ ...withDefeat, deck: [cardId, ...withDefeat.deck] })
}

// ------------------------------------------------------------------ descanso

/** O custo primeiro: uma carta sai do monte sem revelar. Só depois o benefício. */
function startRest(run: Run): Run {
  if (!run.deck.length) return run
  const burned = run.deck[0]
  let next: Run = {
    ...run,
    deck: run.deck.slice(1),
    discardedUnseen: [...run.discardedUnseen, burned],
    restCount: run.restCount + 1,
    phase: 'resting',
    rest: {
      step: 'heal',
      deckBefore: run.deck.length,
      healerId: null,
      healerSuccesses: null,
      distribution: [],
      healed: [],
      scarRolls: [],
      startedAt: now(),
    },
  }
  // O Escudeiro volta no descanso.
  next = { ...next, squires: next.squires.map((s) => ({ ...s, retired: false })) }
  return next
}

function restHealAmount(hero: Hero): number {
  const delta = [...hero.wounds, ...hero.scars]
    .flatMap((id) => afflictionById(id).effects)
    .reduce((n, e) => (e.kind === 'restHealDelta' ? n + e.value : n), 0)
  return Math.max(0, 2 + delta)
}

/** +2 de vigor a todos, com os Ferimentos correspondentes descartados. */
function restHeal(run: Run): Run {
  let next = run
  const healed: string[] = []

  for (const hero of run.heroes) {
    const amount = Math.min(restHealAmount(hero), hero.maxVigor - hero.vigor)
    if (amount <= 0) continue
    const dropped = hero.wounds.slice(0, amount)
    next = discard(next, 'wound', dropped)
    next = updateHero(next, hero.id, (h) => ({
      ...h,
      vigor: h.vigor + amount,
      wounds: h.wounds.slice(dropped.length),
      down: h.vigor + amount <= 0,
    }))
    healed.push(hero.id)
    if (hero.down) next = emit(next, 'hero_revived', { heroId: hero.id, atCard: run.resolved.length })
  }

  return { ...next, rest: { ...next.rest!, step: 'healer', healed } }
}

function restHealer(
  run: Run,
  healerId: string | null,
  successes: number,
  distribution: { heroId: string; points: number }[],
): Run {
  let next = run
  const healed = new Set(run.rest!.healed)

  const perSuccess = healerId
    ? (heroById(run, healerId)?.specializations ?? [])
        .flatMap((s) => content.specializations.find((x) => x.id === s)?.effects ?? [])
        .reduce((n, e) => (e.kind === 'healPerSuccess' ? e.value : n), 1)
    : 1

  for (const { heroId, points } of distribution) {
    if (heroId === healerId) continue
    const amount = points * perSuccess
    next = updateHero(next, heroId, (h) => {
      const vigor = Math.min(h.maxVigor, h.vigor + amount)
      const gained = vigor - h.vigor
      const dropped = h.wounds.slice(0, gained)
      return { ...h, vigor, wounds: h.wounds.slice(dropped.length), down: vigor <= 0 }
    })
    if (amount > 0) healed.add(heroId)
  }

  return {
    ...next,
    rest: { ...next.rest!, step: 'luck', healerId, healerSuccesses: successes, distribution, healed: [...healed] },
  }
}

/** O dado de azar: quem recuperou vigor rola 1 dado; quem tirar 1 compra Cicatriz. */
function restLuck(run: Run, rolls: { heroId: string; rolledOne: boolean }[]): Run {
  let next = run
  for (const { heroId, rolledOne } of rolls) {
    if (!rolledOne) continue
    const result = draw(next, 'scar', 1)
    next = result.run
    next = updateHero(next, heroId, (h) => ({ ...h, scars: [...h.scars, ...result.drawn] }))
    for (const s of result.drawn) {
      next = emit(next, 'scar_drawn', { heroId, scarId: s, cause: 'rest' })
    }
  }
  return { ...next, rest: { ...next.rest!, step: 'done', scarRolls: rolls } }
}

function restDone(run: Run): Run {
  const rest = run.rest!
  const next = emit(run, 'rest_taken', {
    deckBefore: rest.deckBefore,
    deckAfter: run.deck.length,
    healerId: rest.healerId,
    healerSuccesses: rest.healerSuccesses,
    distribution: rest.distribution,
    scarRolls: rest.scarRolls,
    durationMs: msBetween(rest.startedAt, now()),
  })
  return checkDefeat({ ...next, rest: null, phase: 'awaitingReveal' })
}

// --------------------------------------------------------------- consumíveis

function playConsumable(run: Run, heroId: string, consumableId: string): Run {
  const hero = heroById(run, heroId)
  if (!hero || !hero.consumables.includes(consumableId)) return run
  const index = hero.consumables.indexOf(consumableId)

  let next = updateHero(run, heroId, (h) => ({
    ...h,
    consumables: h.consumables.filter((_, i) => i !== index),
  }))
  next = discard(next, 'loot', [consumableId])
  next = emit(next, 'consumable_played', {
    cardId: run.current?.cardId ?? null,
    heroId,
    consumableId,
    phase: run.phase,
    deltaApplied: null,
  })

  if (next.current) {
    next = {
      ...next,
      current: {
        ...next.current,
        consumablesPlayed: [
          ...next.current.consumablesPlayed,
          { heroId, cardId: consumableId, when: run.phase },
        ],
      },
    }
  }
  return next
}

// ------------------------------------------------------------------- reducer

const UNDOABLE = new Set([
  'REVEAL_CARD', 'TOGGLE_SLOT', 'COMMIT_SLOTS', 'DECLARE_ENTRY', 'CORRECT_ENTRY',
  'CONFIRM_VERDICT', 'ASSIGN_DAMAGE', 'TAKE_LOOT', 'SPEND_MARCO', 'ADVANCE',
  'START_REST', 'REST_HEAL', 'REST_HEALER', 'REST_LUCK', 'REST_DONE',
  'PLAY_CONSUMABLE', 'EQUIP', 'UNEQUIP', 'RETREAT', 'OVERRIDE',
])

function runReducer(run: Run, action: Action): Run {
  switch (action.type) {
    case 'REVEAL_CARD':
      return revealCard(run)
    case 'TOGGLE_SLOT':
      return toggleSlot(run, action.actorId)
    case 'COMMIT_SLOTS':
      return commitSlots(run)
    case 'RETREAT':
      return retreat(run)
    case 'DECLARE_ENTRY':
      return declareEntry(run, action.actorId, action.declared, action.crits)
    case 'CORRECT_ENTRY':
      return {
        ...run,
        phase: 'entering',
        current: run.current
          ? { ...run.current, entries: run.current.entries.filter((e) => e.actorId !== action.actorId) }
          : null,
      }
    case 'PLAY_CONSUMABLE':
      return playConsumable(run, action.heroId, action.consumableId)
    case 'CONFIRM_VERDICT':
      return confirmVerdict(run)
    case 'ASSIGN_DAMAGE':
      return applyDamage(run, action.assignment)
    case 'TAKE_LOOT':
      return takeLoot(run, action.heroId, action.chosen, action.equippedTo)
    case 'SPEND_MARCO':
      return spendMarco(run, action.heroId, action.choice, action.detail)
    case 'ADVANCE':
      return advance(run)
    case 'START_REST':
      return startRest(run)
    case 'REST_HEAL':
      return restHeal(run)
    case 'REST_HEALER':
      return restHealer(run, action.healerId, action.successes, action.distribution)
    case 'REST_LUCK':
      return restLuck(run, action.rolls)
    case 'REST_DONE':
      return restDone(run)
    case 'EQUIP': {
      const result = equipInto(run, action.heroId, action.lootId, action.slot)
      return updateHero(result.run, action.heroId, (h) => ({
        ...h,
        consumables: h.consumables.filter((c) => c !== action.lootId),
      }))
    }
    case 'UNEQUIP': {
      const hero = heroById(run, action.heroId)!
      const item = (hero.equipment as Record<string, string | null>)[action.slot]
      if (!item) return run
      return updateHero(run, action.heroId, (h) => ({
        ...h,
        equipment: { ...h.equipment, [action.slot]: null },
        consumables: [...h.consumables, item],
      }))
    }
    case 'ABANDON':
      return end(run, 'abandono', null)
    case 'NOTE_MANUAL':
      return run.current
        ? { ...run, current: { ...run.current, manualNotes: [...run.current.manualNotes, action.text] } }
        : run
    case 'OVERRIDE':
      return applyOverride(run, action.path, action.to, action.from, action.reason)
    default:
      return run
  }
}

/** Toque longo em qualquer número: o ajuste vira evento, com antes e depois. */
function applyOverride(run: Run, path: string, to: unknown, from: unknown, reason?: string): Run {
  const [scope, id, field] = path.split('.')
  let next = run

  if (scope === 'hero') {
    next = updateHero(next, id, (h) => {
      if (field === 'vigor') return { ...h, vigor: Number(to), down: Number(to) <= 0 }
      if (field === 'xp') return { ...h, xp: Number(to) }
      if (field === 'pendingMarcos') return { ...h, pendingMarcos: Number(to) }
      if (SUITS.includes(field as Suit)) return { ...h, pools: { ...h.pools, [field]: Number(to) } }
      return h
    })
  } else if (scope === 'run') {
    if (field === 'furias') next = { ...next, furias: Number(to) }
    if (field === 'effectiveTarget' && next.current) {
      next = { ...next, current: { ...next.current, effectiveTarget: Number(to) } }
    }
  }

  return emit(next, 'override', { path, from, to, reason: reason ?? null })
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'START_RUN':
      return startRun(state, action)

    case 'UNDO': {
      if (!state.undo) return state
      const restored = state.undo.run
      if (!restored) return { ...state, undo: null }
      // O evento original não some: fica marcado undone.
      const events = restored.events.map((e, i) =>
        i === restored.events.length - 1 ? { ...e, undone: true } : e,
      )
      const withUndo = emit({ ...restored, events }, 'undo', {
        undoneType: state.undo.undoneType,
        atPhase: state.currentRun?.phase ?? null,
      })
      return { ...state, currentRun: withUndo, undo: null }
    }

    case 'SAVE_DEBRIEF': {
      const debrief = { ...action.debrief, savedAt: now() }
      if (action.runId) {
        return {
          ...state,
          archive: state.archive.map((r) =>
            r.id === action.runId ? emit({ ...r, debrief }, 'debrief_saved', { ...debrief }) : r,
          ),
        }
      }
      if (!state.currentRun) return state
      return { ...state, currentRun: emit({ ...state.currentRun, debrief }, 'debrief_saved', { ...debrief }) }
    }

    case 'ARCHIVE_RUN': {
      const run = state.currentRun
      if (!run) return state
      // Cicatrizes persistem por perfil, não por partida.
      const profiles = state.profiles.map((p) => {
        const hero = run.heroes.find((h) => h.profileId === p.id)
        if (!hero) return p
        const fresh = hero.scars.filter((s) => !p.scars.includes(s))
        return fresh.length ? { ...p, scars: [...p.scars, ...fresh] } : p
      })
      return { ...state, profiles, archive: [run, ...state.archive], currentRun: null, undo: null }
    }

    case 'DISCARD_RUN':
      return { ...state, currentRun: null, undo: null }

    case 'UPSERT_PROFILE': {
      if (action.id) {
        return {
          ...state,
          profiles: state.profiles.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)),
        }
      }
      return {
        ...state,
        profiles: [...state.profiles, { id: uuid(), name: action.name, scars: [], createdAt: now() }],
      }
    }

    case 'REMOVE_SCAR':
      return {
        ...state,
        profiles: state.profiles.map((p) =>
          p.id === action.profileId ? { ...p, scars: p.scars.filter((s) => s !== action.scarId) } : p,
        ),
      }

    case 'DELETE_PROFILE':
      return { ...state, profiles: state.profiles.filter((p) => p.id !== action.profileId) }

    case 'IMPORT':
      return mergeBundle(state, action.payload).state

    case 'DELETE_ARCHIVED':
      return { ...state, archive: state.archive.filter((r) => r.id !== action.runId) }

    default: {
      if (!state.currentRun) return state
      const before = state.currentRun
      const after = runReducer(before, action)
      if (after === before) return state
      const undo = UNDOABLE.has(action.type) ? { run: before, undoneType: action.type } : state.undo
      return { ...state, currentRun: after, undo }
    }
  }
}

export { restHealAmount, retreatCost }
