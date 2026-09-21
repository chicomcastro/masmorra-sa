import { cardById } from '../content'
import type { Run } from '../engine/state'
import type { AppState } from './state'
import { SCHEMA_VERSION } from './state'

export interface Bundle {
  schemaVersion: number
  exportedAt: string
  profiles: AppState['profiles']
  runs: Run[]
}

export function toBundle(state: AppState, runs = state.archive): Bundle {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: state.profiles,
    runs,
  }
}

export interface MergeResult {
  state: AppState
  added: number
  skipped: string[]
}

/** Importar mescla por run.id, nunca sobrescreve. Conflito mantém o existente. */
export function mergeBundle(state: AppState, payload: unknown): MergeResult {
  const bundle = payload as Partial<Bundle>
  if (!bundle || !Array.isArray(bundle.runs)) {
    throw new Error('Arquivo não parece uma exportação do Masmorra S.A.')
  }

  const existing = new Set(state.archive.map((r) => r.id))
  const skipped: string[] = []
  const incoming: Run[] = []

  for (const run of bundle.runs) {
    if (existing.has(run.id)) skipped.push(run.id)
    else incoming.push(run)
  }

  const byName = new Map(state.profiles.map((p) => [p.name, p]))
  const profiles = [...state.profiles]
  for (const p of bundle.profiles ?? []) {
    const match = byName.get(p.name)
    if (!match) profiles.push(p)
    else {
      const fresh = p.scars.filter((s) => !match.scars.includes(s))
      if (fresh.length) match.scars = [...match.scars, ...fresh]
    }
  }

  const archive = [...state.archive, ...incoming].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return { state: { ...state, profiles, archive }, added: incoming.length, skipped }
}

// ------------------------------------------------------------------------ CSV

function csv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? ''
          const text = String(value)
          return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\n')
}

/** Uma linha por unidade de análise, pronto para planilha. */
export function runsCsv(runs: Run[]): string {
  const head = [
    'run_id', 'mode', 'players', 'started_at', 'ended_at', 'total_ms', 'outcome', 'defeat_cause',
    'cards_resolved', 'deck_remaining', 'rests', 'furias', 'boss_id', 'content_version', 'app_version', 'seed',
  ]
  return csv([
    head,
    ...runs.map((r) => [
      r.id, r.mode, r.heroes.length, r.startedAt, r.endedAt,
      r.endedAt ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime() : null,
      r.outcome, r.defeatCause, r.resolved.length, r.deck.length, r.restCount, r.furias,
      r.bossId, r.contentVersion, r.appVersion, r.seed,
    ]),
  ])
}

export function cardsCsv(runs: Run[]): string {
  const head = [
    'run_id', 'position', 'card_id', 'card_name', 'floor', 'result', 'base_target', 'effective_target',
    'declared_total', 'margin', 'slots_total', 'slots_filled', 'abstained', 'win_probability',
    'expected_total', 'best_alternative_prob', 'deliberation_ms', 'damage_total',
  ]
  const rows = runs.flatMap((r) =>
    r.resolved.map((c) => {
      const card = cardById(c.cardId)
      return [
        r.id, c.position, c.cardId, card.name, String(c.floor), c.result, c.baseTarget, c.effectiveTarget,
        c.declaredTotal, c.declaredTotal - c.effectiveTarget, c.slots.length, c.slots.filter(Boolean).length,
        c.hidden?.eligibleAbstained.length ?? null,
        c.hidden?.winProbability ?? null,
        c.hidden?.expectedTotal ?? null,
        c.hidden?.bestAlternative?.prob ?? null,
        c.committedAt ? new Date(c.committedAt).getTime() - new Date(c.revealedAt).getTime() : null,
        c.damageAssignment.reduce((n, a) => n + a.points, 0),
      ]
    }),
  )
  return csv([head, ...rows])
}

export function entriesCsv(runs: Run[]): string {
  const head = [
    'run_id', 'position', 'card_id', 'actor_id', 'actor_name', 'suit', 'off_suit', 'pool_size',
    'threshold', 'declared', 'counted', 'crits', 'expected', 'corrected_from',
  ]
  const rows = runs.flatMap((r) =>
    r.resolved.flatMap((c) =>
      c.entries.map((e) => [
        r.id, c.position, c.cardId, e.actorId,
        r.heroes.find((h) => h.id === e.actorId)?.name ?? r.squires.find((s) => s.id === e.actorId)?.name ?? '',
        e.suit, e.offSuit ? 1 : 0, e.poolSize, e.threshold, e.declaredSuccesses, e.countedSuccesses,
        e.crits, c.hidden?.expectedByActor.find((x) => x.id === e.actorId)?.expected ?? null,
        e.correctedFrom,
      ]),
    ),
  )
  return csv([head, ...rows])
}

export function eventsCsv(runs: Run[]): string {
  const head = ['run_id', 'event_id', 't', 'type', 'undone', 'payload']
  const rows = runs.flatMap((r) =>
    r.events.map((e) => [r.id, e.id, e.t, e.type, e.undone ? 1 : 0, JSON.stringify(e.payload)]),
  )
  return csv([head, ...rows])
}

/** Nome dos arquivos com data e filtro aplicado. */
export function fileName(base: string, ext: string, filterLabel?: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const suffix = filterLabel ? `-${filterLabel}` : ''
  return `masmorra-${date}${suffix}-${base}.${ext}`
}

export function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
