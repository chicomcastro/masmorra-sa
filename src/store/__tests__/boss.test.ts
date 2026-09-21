import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cardById } from '../../content'
import type { Run } from '../../engine/state'
import type { Action, HeroSetup } from '../actions'
import { reducer } from '../reducer'
import { emptyState, type AppState } from '../state'

beforeEach(() => {
  let n = 0
  vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => `id-${n++}` })
})

const heroes: HeroSetup[] = [
  { name: 'Fren', profileId: null, raceId: 'race-elfo-em-sabatico', classId: 'class-clerigo', freeSuits: [] },
  { name: 'Vurm', profileId: null, raceId: 'race-meio-ogro', classId: 'class-ladino', freeSuits: [] },
]

const run = (s: AppState): Run => s.currentRun!
const play = (s: AppState, ...a: Action[]) => a.reduce(reducer, s)

/** Pula direto para o chefe: descarta os obstáculos e deixa só as três fases. */
function atBoss(mode: 'base' | 'duo'): AppState {
  const s = reducer(emptyState(), { type: 'START_RUN', mode, heroes, squireIds: [], seed: 99 })
  const deck = run(s).deck.filter((id) => cardById(id).kind === 'boss')
  return { ...s, currentRun: { ...run(s), deck } }
}

/** Revela a fase atual, entra com todo mundo e declara `declared` sucessos cada. */
function attempt(s: AppState, declared: number): AppState {
  let next = run(s).current ? s : play(s, { type: 'REVEAL_CARD' })
  const current = run(next).current!
  if (!current.committedAt) {
    for (const hero of run(next).heroes) next = play(next, { type: 'TOGGLE_SLOT', actorId: hero.id })
    next = play(next, { type: 'COMMIT_SLOTS' })
  }
  for (const id of run(next).current!.slots.filter((x): x is string => !!x)) {
    next = play(next, { type: 'DECLARE_ENTRY', actorId: id, declared, crits: 0 })
  }
  next = play(next, { type: 'CONFIRM_VERDICT' })
  const after = run(next).current!
  if (after.result === 'falha') {
    next = play(next, { type: 'ASSIGN_DAMAGE', assignment: after.damageAssignment })
  } else {
    for (const offer of after.lootOffers) {
      next = play(next, { type: 'TAKE_LOOT', heroId: offer.heroId, chosen: offer.offered[0], equippedTo: null })
    }
  }
  return play(next, { type: 'ADVANCE' })
}

describe('chefe no Duo', () => {
  it('falhar uma fase marca 1 Fúria e a descida avança', () => {
    const s = attempt(atBoss('duo'), 0)
    expect(run(s).furias).toBe(1)
    expect(run(s).events.some((e) => e.type === 'furia_gained')).toBe(true)
    expect(run(s).phase).toBe('awaitingReveal')
    expect(run(s).resolved.at(-1)!.result).toBe('falha')
  })

  it('cada Fúria soma 1 ao alvo das fases seguintes', () => {
    let s = attempt(atBoss('duo'), 0)
    s = play(s, { type: 'REVEAL_CARD' })
    for (const hero of run(s).heroes) s = play(s, { type: 'TOGGLE_SLOT', actorId: hero.id })
    s = play(s, { type: 'COMMIT_SLOTS' })
    const card = cardById(run(s).current!.cardId)
    expect(run(s).current!.effectiveTarget).toBe(card.target + 1)
  })

  it('três Fúrias encerram a partida com defeatCause "furias"', () => {
    let s = atBoss('duo')
    s = attempt(s, 0)
    s = attempt(s, 0)
    expect(run(s).furias).toBe(2)
    expect(run(s).outcome).toBeNull()
    s = attempt(s, 0)
    expect(run(s).furias).toBe(3)
    expect(run(s).outcome).toBe('derrota')
    expect(run(s).defeatCause).toBe('furias')
    expect(run(s).phase).toBe('ended')
  })

  it('fechar a Fase III vence a descida', () => {
    let s = atBoss('duo')
    s = attempt(s, 99)
    s = attempt(s, 99)
    s = attempt(s, 99)
    expect(run(s).outcome).toBe('vitoria')
    expect(run(s).defeatCause).toBeNull()
  })

  it('a Fase III entra direto na rolagem, sem etapa de decisão', () => {
    let s = atBoss('duo')
    s = { ...s, currentRun: { ...run(s), deck: [run(s).deck[2]] } }
    s = play(s, { type: 'REVEAL_CARD' })
    expect(run(s).phase).toBe('entering')
    expect(run(s).current!.slots.filter(Boolean)).toHaveLength(2)
  })
})

describe('chefe no base', () => {
  it('falhar repete a mesma fase pedindo +1 sucesso', () => {
    const s = attempt(atBoss('base'), 0)
    expect(run(s).bossRetryBonus).toBe(1)
    const card = cardById(run(s).current!.cardId)
    expect(card.kind === 'boss' && card.phase).toBe(1)
    expect(run(s).furias).toBe(0)
  })

  it('o alvo sobe a cada tentativa', () => {
    let s = attempt(atBoss('base'), 0)
    const first = cardById(run(s).current!.cardId).target
    for (const hero of run(s).heroes) s = play(s, { type: 'TOGGLE_SLOT', actorId: hero.id })
    s = play(s, { type: 'COMMIT_SLOTS' })
    expect(run(s).current!.effectiveTarget).toBe(first + 1)
  })
})

describe('derrota', () => {
  it('todos caídos encerra com defeatCause "caidos"', () => {
    let s = atBoss('duo')
    s = {
      ...s,
      currentRun: { ...run(s), heroes: run(s).heroes.map((h) => ({ ...h, vigor: 1, maxVigor: 6 })) },
    }
    s = attempt(s, 0)
    expect(run(s).heroes.every((h) => h.down)).toBe(true)
    expect(run(s).defeatCause).toBe('caidos')
  })

  it('monte vazio antes de fechar o chefe encerra com defeatCause "monte"', () => {
    let s = reducer(emptyState(), { type: 'START_RUN', mode: 'duo', heroes, squireIds: [], seed: 5 })
    s = { ...s, currentRun: { ...run(s), deck: [run(s).deck[0]] } }
    s = attempt(s, 99)
    expect(run(s).outcome).toBe('derrota')
    expect(run(s).defeatCause).toBe('monte')
  })
})
