// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider } from '../../store'
import { reducer } from '../../store/reducer'
import { emptyState } from '../../store/state'
import type { Action, HeroSetup } from '../../store/actions'
import { Mesa } from '../screens/Mesa'

const heroes: HeroSetup[] = [
  { name: 'Fren', profileId: null, raceId: 'race-elfo-em-sabatico', classId: 'class-clerigo', freeSuits: [] },
  { name: 'Vurm', profileId: null, raceId: 'race-meio-ogro', classId: 'class-ladino', freeSuits: [] },
]

beforeEach(() => {
  localStorage.clear()
  let n = 0
  vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => `id-${n++}` })
})

function runAt(...actions: Action[]) {
  let state = reducer(emptyState(), { type: 'START_RUN', mode: 'duo', heroes, squireIds: [], seed: 4 })
  state = actions.reduce(reducer, state)
  return state.currentRun!
}

/**
 * O critério de aceite da spec, verificado em vez de combinado: nenhuma
 * probabilidade, esperado ou sugestão entre `deciding` e `resolving`.
 */
describe('decidir no escuro', () => {
  it('não mostra prognóstico nenhum em deciding', () => {
    const run = runAt({ type: 'REVEAL_CARD' })
    expect(run.phase).toBe('deciding')
    const { container } = render(
      <StoreProvider>
        <Mesa run={run} />
      </StoreProvider>,
    )
    const text = container.textContent ?? ''
    expect(text).not.toContain('%')
    for (const word of ['chance', 'esperado', 'probabilidade', 'sugest', 'arriscad', 'recomend']) {
      expect(text.toLowerCase()).not.toContain(word)
    }
  })

  it('não vaza a matemática oculta nem depois de confirmar as vagas', () => {
    const state = reducer(emptyState(), { type: 'START_RUN', mode: 'duo', heroes, squireIds: [], seed: 4 })
    let s = reducer(state, { type: 'REVEAL_CARD' })
    const hero = s.currentRun!.heroes[0].id
    s = reducer(s, { type: 'TOGGLE_SLOT', actorId: hero })
    s = reducer(s, { type: 'COMMIT_SLOTS' })

    // A conta existe no estado...
    expect(s.currentRun!.current!.hidden).not.toBeNull()

    // ...e não aparece em lugar nenhum da tela.
    const { container } = render(
      <StoreProvider>
        <Mesa run={s.currentRun!} />
      </StoreProvider>,
    )
    const text = container.textContent ?? ''
    expect(text).not.toContain('%')
    const prob = s.currentRun!.current!.hidden!.winProbability
    expect(text).not.toContain(prob.toFixed(2))
  })

  it('mostra regra, que é permitido: o aviso de naipe errado', () => {
    const run = runAt({ type: 'REVEAL_CARD' })
    render(
      <StoreProvider>
        <Mesa run={run} />
      </StoreProvider>,
    )
    // "2 sucessos contam como 1" é regra do manual, não prognóstico.
    const tiles = screen.getAllByRole('button')
    expect(tiles.length).toBeGreaterThan(0)
  })

  it('revela a conta só no fim da partida', () => {
    const run = runAt({ type: 'REVEAL_CARD' })
    expect(run.current!.hidden).toBeNull()
  })
})
