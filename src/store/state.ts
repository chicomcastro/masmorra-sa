import type { Profile, Run } from '../engine/state'

export const SCHEMA_VERSION = 1
export const APP_VERSION = '0.2.0'

export interface AppState {
  profiles: Profile[]
  currentRun: Run | null
  archive: Run[]
  /** Desfazer com profundidade de um passo: o estado anterior inteiro. */
  undo: { run: Run | null; undoneType: string } | null
}

export function emptyState(): AppState {
  return { profiles: [], currentRun: null, archive: [], undo: null }
}
