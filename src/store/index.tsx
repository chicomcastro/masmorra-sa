import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Action } from './actions'
import { load, save } from './persist'
import { reducer } from './reducer'
import type { AppState } from './state'

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<((action: Action) => void) | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const timer = useRef<number | undefined>(undefined)

  // Debounce de 300 ms: a mesa toca rápido, o disco não precisa acompanhar.
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => save(state), 300)
    return () => window.clearTimeout(timer.current)
  }, [state])

  // Nada quebra mais o ritmo que o tablet apagando no meio de uma discussão.
  useEffect(() => {
    if (!state.currentRun || state.currentRun.phase === 'ended') return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    navigator.wakeLock
      ?.request('screen')
      .then((l) => {
        if (cancelled) void l.release()
        else lock = l
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      void lock?.release().catch(() => undefined)
    }
  }, [state.currentRun?.id, state.currentRun?.phase])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useAppState(): AppState {
  const state = useContext(StateContext)
  if (!state) throw new Error('useAppState fora do StoreProvider')
  return state
}

export function useDispatch(): (action: Action) => void {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) throw new Error('useDispatch fora do StoreProvider')
  return dispatch
}

export function useRun() {
  const state = useAppState()
  return useMemo(() => state.currentRun, [state.currentRun])
}
