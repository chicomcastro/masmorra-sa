import type { Profile, Run } from '../engine/state'
import { SCHEMA_VERSION, emptyState, type AppState } from './state'

const KEYS = {
  profiles: 'msa.profiles',
  currentRun: 'msa.currentRun',
  archive: 'msa.archive',
} as const

interface Envelope<T> {
  schemaVersion: number
  data: T
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Envelope<T>
    if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) return fallback
    return migrate(parsed.schemaVersion, parsed.data)
  } catch {
    return fallback
  }
}

/** Versionamento de schema: hoje só existe a v1, mas o gancho fica pronto. */
function migrate<T>(_version: number, data: T): T {
  return data
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, data } satisfies Envelope<T>))
  } catch (err) {
    console.error('localStorage cheio ou indisponível', err)
  }
}

export function load(): AppState {
  if (typeof localStorage === 'undefined') return emptyState()
  return {
    profiles: read<Profile[]>(KEYS.profiles, []),
    currentRun: read<Run | null>(KEYS.currentRun, null),
    archive: read<Run[]>(KEYS.archive, []),
    undo: null,
  }
}

export function save(state: AppState): void {
  if (typeof localStorage === 'undefined') return
  write(KEYS.profiles, state.profiles)
  write(KEYS.currentRun, state.currentRun)
  write(KEYS.archive, state.archive)
}

export function clearAll(): void {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key)
}

/** Um log de partida completo fica entre 30 e 60 KB; o limite prático é 5 MB. */
export function storageUsedKb(): number {
  if (typeof localStorage === 'undefined') return 0
  return Math.round(
    Object.values(KEYS).reduce((n, key) => n + (localStorage.getItem(key)?.length ?? 0), 0) / 1024,
  )
}

export const STORAGE_WARN_RUNS = 60
