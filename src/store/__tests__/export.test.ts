import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Run } from '../../engine/state'
import type { Action, HeroSetup } from '../actions'
import { cardsCsv, entriesCsv, eventsCsv, fileName, mergeBundle, runsCsv, toBundle } from '../export'
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
const play = (s: AppState, ...a: Action[]) => a.reduce(reducer, s)

/** Uma partida curta, jogada de verdade, para ter o que exportar. */
function playedRun(seed: number): AppState {
  let s = reducer(emptyState(), { type: 'START_RUN', mode: 'duo', heroes, squireIds: [], seed })
  s = play(s, { type: 'REVEAL_CARD' })
  const hero = s.currentRun!.heroes[0].id
  s = play(s, { type: 'TOGGLE_SLOT', actorId: hero }, { type: 'COMMIT_SLOTS' })
  s = play(s, { type: 'DECLARE_ENTRY', actorId: hero, declared: 0, crits: null }, { type: 'CONFIRM_VERDICT' })
  s = play(s, { type: 'ASSIGN_DAMAGE', assignment: s.currentRun!.current!.damageAssignment })
  s = play(s, { type: 'ADVANCE' }, { type: 'ABANDON' }, { type: 'ARCHIVE_RUN' })
  return s
}

describe('exportar e importar', () => {
  it('exportar, limpar e importar devolve o arquivo idêntico', () => {
    const before = playedRun(11)
    const bundle = JSON.parse(JSON.stringify(toBundle(before)))
    const after = mergeBundle(emptyState(), bundle)
    expect(after.added).toBe(1)
    expect(after.state.archive).toEqual(before.archive)
    expect(after.state.profiles).toEqual(before.profiles)
  })

  it('importar mescla por id e nunca sobrescreve', () => {
    const state = playedRun(11)
    const bundle = toBundle(state)
    const mutated = {
      ...bundle,
      runs: bundle.runs.map((r: Run) => ({ ...r, outcome: 'vitoria' as const })),
    }
    const merged = mergeBundle(state, mutated)
    expect(merged.added).toBe(0)
    expect(merged.skipped).toEqual([state.archive[0].id])
    expect(merged.state.archive[0].outcome).toBe('abandono')
  })

  it('mescla cicatrizes de perfis com o mesmo nome, sem duplicar', () => {
    let state = reducer(emptyState(), { type: 'UPSERT_PROFILE', id: null, name: 'Chico' })
    state.profiles[0].scars.push('scar-voz-rouca')
    const incoming = {
      schemaVersion: 1,
      exportedAt: '',
      profiles: [{ id: 'outro', name: 'Chico', scars: ['scar-voz-rouca', 'scar-mao-fria'], createdAt: '' }],
      runs: [],
    }
    const merged = mergeBundle(state, incoming)
    expect(merged.state.profiles).toHaveLength(1)
    expect(merged.state.profiles[0].scars).toEqual(['scar-voz-rouca', 'scar-mao-fria'])
  })

  it('recusa um arquivo que não é uma exportação', () => {
    expect(() => mergeBundle(emptyState(), { qualquer: 'coisa' })).toThrow()
  })
})

describe('CSV', () => {
  const state = () => playedRun(11)

  it('runs.csv tem uma linha por partida', () => {
    const lines = runsCsv(state().archive).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('run_id')
  })

  it('cards.csv tem uma linha por carta resolvida, com a conta oculta', () => {
    const s = state()
    const lines = cardsCsv(s.archive).trim().split('\n')
    expect(lines).toHaveLength(1 + s.archive[0].resolved.length)
    expect(lines[0]).toContain('win_probability')
    expect(lines[1].split(',').length).toBe(lines[0].split(',').length)
  })

  it('entries.csv permite reconstruir cada total declarado', () => {
    const s = state()
    const entries = s.archive[0].resolved.flatMap((c) => c.entries)
    const lines = entriesCsv(s.archive).trim().split('\n')
    expect(lines).toHaveLength(1 + entries.length)
    expect(lines[0]).toContain('declared')
  })

  it('events.csv leva o log inteiro', () => {
    const s = state()
    const lines = eventsCsv(s.archive).trim().split('\n')
    expect(lines).toHaveLength(1 + s.archive[0].events.length)
  })

  it('escapa vírgulas e aspas no payload', () => {
    const s = state()
    const csv = eventsCsv(s.archive)
    for (const line of csv.trim().split('\n').slice(1)) {
      expect(line.startsWith(`${s.archive[0].id},`)).toBe(true)
    }
  })

  it('nomeia o arquivo com data e filtro', () => {
    expect(fileName('runs', 'csv', 'duo')).toMatch(/^masmorra-\d{4}-\d{2}-\d{2}-duo-runs\.csv$/)
    expect(fileName('runs', 'csv')).toMatch(/^masmorra-\d{4}-\d{2}-\d{2}-runs\.csv$/)
  })
})
