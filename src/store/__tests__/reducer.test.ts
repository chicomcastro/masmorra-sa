import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cardById } from '../../content'
import type { Run } from '../../engine/state'
import type { Action, HeroSetup } from '../actions'
import { eligibleActors, reducer, suggestedSquires } from '../reducer'
import { emptyState, type AppState } from '../state'

beforeEach(() => {
  vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: makeIds() })
})

function makeIds() {
  let n = 0
  return () => `id-${n++}` as `${string}-${string}-${string}-${string}-${string}`
}

const duoHeroes: HeroSetup[] = [
  { name: 'Fren', profileId: null, raceId: 'race-elfo-em-sabatico', classId: 'class-clerigo', freeSuits: [] },
  { name: 'Vurm', profileId: null, raceId: 'race-meio-ogro', classId: 'class-ladino', freeSuits: [] },
]

function start(over: Partial<Extract<Action, { type: 'START_RUN' }>> = {}): AppState {
  return reducer(emptyState(), {
    type: 'START_RUN',
    mode: 'duo',
    heroes: duoHeroes,
    squireIds: suggestedSquires(duoHeroes),
    seed: 1234,
    ...over,
  })
}

function run(state: AppState): Run {
  return state.currentRun!
}

function play(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state)
}

describe('preparo', () => {
  it('monta a partida Duo com 17 cartas e emite run_started', () => {
    const s = start()
    expect(run(s).deck).toHaveLength(17)
    expect(run(s).phase).toBe('awaitingReveal')
    expect(run(s).events.map((e) => e.type)).toEqual(['run_started'])
  })

  it('oferece Escudeiro para os naipes que a dupla não cobre', () => {
    // Clérigo (Fé, Força) + Ladino (Manha, Arcano) cobrem os quatro.
    expect(suggestedSquires(duoHeroes)).toEqual([])
    // Dois Elfos Clérigos cobrem Fé, Força e Arcano; falta Manha.
    expect(suggestedSquires([duoHeroes[0], duoHeroes[0]])).toEqual(['squire-manha'])
  })

  it('herda as Cicatrizes do perfil do jogador', () => {
    let state = reducer(emptyState(), { type: 'UPSERT_PROFILE', id: null, name: 'Chico' })
    const profileId = state.profiles[0].id
    state = reducer(state, { type: 'REMOVE_SCAR', profileId, scarId: 'nada' })
    state.profiles[0].scars.push('scar-joelho-antigo')
    state = reducer(state, {
      type: 'START_RUN',
      mode: 'duo',
      heroes: [{ ...duoHeroes[0], profileId }, duoHeroes[1]],
      squireIds: [],
      seed: 1,
    })
    expect(run(state).heroes[0].scars).toEqual(['scar-joelho-antigo'])
  })

  it('a mesma semente reproduz a mesma descida', () => {
    expect(run(start()).deck).toEqual(run(start()).deck)
  })
})

describe('rodada', () => {
  it('revelar tira a carta do topo e abre a decisão', () => {
    const s = play(start(), { type: 'REVEAL_CARD' })
    expect(run(s).phase).toBe('deciding')
    expect(run(s).deck).toHaveLength(16)
    expect(run(s).current?.cardId).toBeTruthy()
  })

  it('ocupar e liberar vaga grava slot_toggled nas duas direções', () => {
    let s = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(s).heroes[0].id
    s = play(s, { type: 'TOGGLE_SLOT', actorId: hero }, { type: 'TOGGLE_SLOT', actorId: hero })
    const toggles = run(s).events.filter((e) => e.type === 'slot_toggled')
    expect(toggles.map((e) => e.payload.action)).toEqual(['in', 'out'])
    expect(run(s).current!.slots.every((x) => x === null)).toBe(true)
  })

  it('não confirma vagas com zero participantes', () => {
    const s = play(start(), { type: 'REVEAL_CARD' }, { type: 'COMMIT_SLOTS' })
    expect(run(s).phase).toBe('deciding')
  })

  it('confirmar vagas grava a matemática oculta e trava a composição', () => {
    let s = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(s).heroes[0].id
    s = play(s, { type: 'TOGGLE_SLOT', actorId: hero }, { type: 'COMMIT_SLOTS' })
    const current = run(s).current!
    expect(run(s).phase).toBe('entering')
    expect(current.hidden).not.toBeNull()
    expect(current.hidden!.winProbability).toBeGreaterThanOrEqual(0)
    expect(current.hidden!.bestAlternative).not.toBeNull()
    const committed = run(s).events.find((e) => e.type === 'card_committed')!
    expect(committed.payload.deliberationMs).toBeTypeOf('number')
  })

  it('empatar com o alvo é vitória, e vitória não machuca', () => {
    let s = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(s).heroes[0].id
    const vigorBefore = run(s).heroes[0].vigor
    s = play(s, { type: 'TOGGLE_SLOT', actorId: hero }, { type: 'COMMIT_SLOTS' })
    const target = run(s).current!.effectiveTarget
    s = play(
      s,
      { type: 'DECLARE_ENTRY', actorId: hero, declared: target * 2, crits: null },
      { type: 'CONFIRM_VERDICT' },
    )
    expect(run(s).current!.result).toBe('vitoria')
    expect(run(s).heroes[0].vigor).toBe(vigorBefore)
    expect(run(s).current!.lootOffers).toHaveLength(1)
    expect(run(s).heroes[0].xp + run(s).heroes[0].pendingMarcos * 2).toBe(1)
  })

  it('falhar distribui o dano e compra Ferimento às cegas', () => {
    let s = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(s).heroes[0].id
    s = play(
      s,
      { type: 'TOGGLE_SLOT', actorId: hero },
      { type: 'COMMIT_SLOTS' },
      { type: 'DECLARE_ENTRY', actorId: hero, declared: 0, crits: null },
      { type: 'CONFIRM_VERDICT' },
    )
    expect(run(s).current!.result).toBe('falha')
    const assignment = run(s).current!.damageAssignment
    s = play(s, { type: 'ASSIGN_DAMAGE', assignment })
    const after = run(s).heroes.find((h) => h.id === hero)!
    expect(after.wounds.length).toBe(assignment[0].points)
    expect(after.vigor).toBe(6 - assignment[0].points)
  })

  it('corrigir uma rolagem grava entry_corrected em vez de sobrescrever em silêncio', () => {
    let s = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(s).heroes[0].id
    s = play(
      s,
      { type: 'TOGGLE_SLOT', actorId: hero },
      { type: 'COMMIT_SLOTS' },
      { type: 'DECLARE_ENTRY', actorId: hero, declared: 1, crits: null },
      { type: 'DECLARE_ENTRY', actorId: hero, declared: 3, crits: null },
    )
    const corrected = run(s).events.find((e) => e.type === 'entry_corrected')!
    expect(corrected.payload).toMatchObject({ from: 1, to: 3 })
    expect(run(s).current!.entries[0].correctedFrom).toBe(1)
  })

  it('recuar custa 1 carta no Duo e 2 no base', () => {
    const duo = play(start(), { type: 'REVEAL_CARD' }, { type: 'RETREAT' })
    expect(run(duo).deck).toHaveLength(16)
    const base = play(
      start({ mode: 'base', heroes: [...duoHeroes, { ...duoHeroes[0], name: 'Sílvia' }], squireIds: [] }),
      { type: 'REVEAL_CARD' },
      { type: 'RETREAT' },
    )
    expect(run(base).deck).toHaveLength(16)
    expect(run(base).discardedUnseen).toHaveLength(1)
  })

  it('heróis caídos não ocupam vaga', () => {
    let s = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(s).heroes[0].id
    s = { ...s, currentRun: { ...run(s), heroes: run(s).heroes.map((h) => (h.id === hero ? { ...h, down: true, vigor: 0 } : h)) } }
    expect(eligibleActors(run(s), cardById(run(s).current!.cardId))).not.toContain(hero)
  })
})

describe('descanso', () => {
  it('cobra 1 carta do monte antes de curar', () => {
    const s = play(start(), { type: 'START_REST' })
    expect(run(s).deck).toHaveLength(16)
    expect(run(s).phase).toBe('resting')
    expect(run(s).rest!.step).toBe('heal')
  })

  it('devolve 2 de vigor e descarta os Ferimentos correspondentes', () => {
    let s = start()
    s = {
      ...s,
      currentRun: {
        ...run(s),
        heroes: run(s).heroes.map((h, i) =>
          i === 0 ? { ...h, vigor: 2, wounds: ['wound-dedo-torto', 'wound-corte-feio', 'wound-fe-trincada'] } : h,
        ),
      },
    }
    s = play(s, { type: 'START_REST' }, { type: 'REST_HEAL' })
    expect(run(s).heroes[0].vigor).toBe(4)
    expect(run(s).heroes[0].wounds).toEqual(['wound-fe-trincada'])
  })

  it('quem tirou 1 no dado de azar compra Cicatriz, com a origem gravada', () => {
    let s = play(start(), { type: 'START_REST' }, { type: 'REST_HEAL' })
    const hero = run(s).heroes[0].id
    s = play(
      s,
      { type: 'REST_HEALER', healerId: null, successes: 0, distribution: [] },
      { type: 'REST_LUCK', rolls: [{ heroId: hero, rolledOne: true }] },
      { type: 'REST_DONE' },
    )
    const scar = run(s).events.find((e) => e.type === 'scar_drawn')!
    expect(scar.payload.cause).toBe('rest')
    expect(run(s).heroes[0].scars).toHaveLength(1)
    expect(run(s).phase).toBe('awaitingReveal')
  })

  it('o Escudeiro retirado volta no descanso', () => {
    let s = start({ heroes: [duoHeroes[0], duoHeroes[0]], squireIds: ['squire-manha'] })
    s = { ...s, currentRun: { ...run(s), squires: run(s).squires.map((q) => ({ ...q, retired: true })) } }
    s = play(s, { type: 'START_REST' })
    expect(run(s).squires[0].retired).toBe(false)
  })
})

describe('desfazer', () => {
  it('volta um passo e deixa o evento original marcado, não apagado', () => {
    const before = play(start(), { type: 'REVEAL_CARD' })
    const hero = run(before).heroes[0].id
    const after = play(before, { type: 'TOGGLE_SLOT', actorId: hero })
    const undone = reducer(after, { type: 'UNDO' })

    expect(run(undone).current!.slots.every((x) => x === null)).toBe(true)
    const types = run(undone).events.map((e) => e.type)
    expect(types).toContain('card_revealed')
    expect(types[types.length - 1]).toBe('undo')
    expect(run(undone).events.find((e) => e.type === 'card_revealed')!.undone).toBe(true)
  })
})

describe('ajuste manual', () => {
  it('grava override com o valor antes e depois', () => {
    let s = start()
    const hero = run(s).heroes[0].id
    s = reducer(s, { type: 'OVERRIDE', path: `hero.${hero}.vigor`, from: 6, to: 3, reason: 'regra do manual' })
    expect(run(s).heroes[0].vigor).toBe(3)
    expect(run(s).events.at(-1)).toMatchObject({ type: 'override', payload: { from: 6, to: 3 } })
  })
})

describe('cicatrizes entre partidas', () => {
  it('uma Cicatriz ganhada aparece no perfil do jogador na partida seguinte', () => {
    let s = reducer(emptyState(), { type: 'UPSERT_PROFILE', id: null, name: 'Chico' })
    const profileId = s.profiles[0].id

    s = reducer(s, {
      type: 'START_RUN',
      mode: 'duo',
      heroes: [{ ...duoHeroes[0], profileId }, duoHeroes[1]],
      squireIds: [],
      seed: 3,
    })
    const heroId = run(s).heroes[0].id

    // A partida termina com a heroína marcada.
    s = {
      ...s,
      currentRun: {
        ...run(s),
        heroes: run(s).heroes.map((h) => (h.id === heroId ? { ...h, scars: ['scar-voz-rouca'] } : h)),
      },
    }
    s = play(s, { type: 'ABANDON' }, { type: 'ARCHIVE_RUN' })
    expect(s.profiles.find((p) => p.id === profileId)!.scars).toEqual(['scar-voz-rouca'])

    // E a Cicatriz está lá na descida seguinte.
    s = reducer(s, {
      type: 'START_RUN',
      mode: 'duo',
      heroes: [{ ...duoHeroes[0], profileId }, duoHeroes[1]],
      squireIds: [],
      seed: 4,
    })
    expect(run(s).heroes[0].scars).toEqual(['scar-voz-rouca'])
  })

  it('não duplica a Cicatriz que o perfil já tinha', () => {
    let s = reducer(emptyState(), { type: 'UPSERT_PROFILE', id: null, name: 'Chico' })
    const profileId = s.profiles[0].id
    s.profiles[0].scars.push('scar-voz-rouca')
    s = reducer(s, {
      type: 'START_RUN',
      mode: 'duo',
      heroes: [{ ...duoHeroes[0], profileId }, duoHeroes[1]],
      squireIds: [],
      seed: 3,
    })
    s = play(s, { type: 'ABANDON' }, { type: 'ARCHIVE_RUN' })
    expect(s.profiles.find((p) => p.id === profileId)!.scars).toEqual(['scar-voz-rouca'])
  })
})
