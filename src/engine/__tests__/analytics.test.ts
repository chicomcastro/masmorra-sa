import { describe, expect, it } from 'vitest'
import { NO_FILTERS, applyFilters, tableIntuition, wilson, winRates } from '../analytics'
import type { Run } from '../state'

function run(over: Partial<Run>): Run {
  return {
    id: 'r', schemaVersion: 1, seed: 1, rngCalls: 0, mode: 'duo', startedAt: '2026-01-01T00:00:00Z',
    endedAt: '2026-01-01T00:30:00Z', appVersion: '0', contentVersion: 'v1', heroes: [], squires: [],
    deck: [], bossId: 'boss-duo-a', deckComposition: {}, resolved: [], discardedUnseen: [], current: null,
    phase: 'ended', furias: 0, bossPhaseIndex: 0, bossRetryBonus: 0, outcome: 'vitoria', defeatCause: null,
    events: [], debrief: null, restCount: 0,
    piles: { loot: [], lootDiscard: [], wound: [], woundDiscard: [], scar: [], scarDiscard: [] },
    rest: null, lastBossParticipants: [], ...over,
  }
}

describe('intervalo de Wilson', () => {
  it('é largo com n pequeno e estreito com n grande', () => {
    const few = wilson(1, 2)
    const many = wilson(500, 1000)
    expect(few.high - few.low).toBeGreaterThan(many.high - many.low)
    expect(many.low).toBeLessThan(0.5)
    expect(many.high).toBeGreaterThan(0.5)
  })

  it('com zero partidas devolve o intervalo inteiro', () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 })
  })
})

describe('taxa de vitória', () => {
  it('ignora abandonos', () => {
    const runs = [
      run({ id: 'a', outcome: 'vitoria' }),
      run({ id: 'b', outcome: 'derrota' }),
      run({ id: 'c', outcome: 'abandono' }),
    ]
    const duo = winRates(runs).find((r) => r.mode === 'duo')!
    expect(duo.n).toBe(2)
    expect(duo.rate).toBe(0.5)
    expect(duo.target).toBe(0.49)
  })
})

describe('filtros', () => {
  it('filtra por modo, jogadores e versão de conteúdo', () => {
    const runs = [
      run({ id: 'a', mode: 'duo', contentVersion: 'v1' }),
      run({ id: 'b', mode: 'base', contentVersion: 'v2' }),
    ]
    expect(applyFilters(runs, { ...NO_FILTERS, mode: 'base' }).map((r) => r.id)).toEqual(['b'])
    expect(applyFilters(runs, { ...NO_FILTERS, contentVersion: 'v1' }).map((r) => r.id)).toEqual(['a'])
    expect(applyFilters(runs, NO_FILTERS)).toHaveLength(2)
  })
})

describe('intuição da mesa', () => {
  it('mede a diferença entre a composição escolhida e a ótima', () => {
    const card = {
      cardId: 'obs-i-goblin-procuracao', revealedAt: '', committedAt: '', resolvedAt: '', slots: [],
      baseTarget: 3, effectiveTarget: 3, targetModifiers: [], entries: [], consumablesPlayed: [],
      declaredTotal: 0, result: 'falha' as const, damageAssignment: [], lootOffers: [],
      damageRemainder: 0, damageDecidedAt: null, manualNotes: [], position: 0, floor: 1 as const,
      hidden: {
        expectedByActor: [], expectedTotal: 0, winProbability: 0.4,
        bestAlternative: { slots: ['x'], prob: 0.7 }, eligibleAbstained: [],
      },
    }
    const result = tableIntuition([run({ resolved: [card] })])
    expect(result.n).toBe(1)
    expect(result.meanGap).toBeCloseTo(0.3, 10)
    expect(result.optimalRate).toBe(0)
  })

  it('conta como ótima a decisão sem diferença', () => {
    const base = tableIntuition([])
    expect(base).toEqual({ n: 0, meanGap: 0, optimalRate: 0 })
  })
})
