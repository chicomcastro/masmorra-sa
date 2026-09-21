import { cardById, lootById } from '../content'
import type { Run } from './state'

export interface Filters {
  mode: 'base' | 'duo' | 'todos'
  players: number | null
  contentVersion: string | null
  from: string | null
  to: string | null
}

export const NO_FILTERS: Filters = { mode: 'todos', players: null, contentVersion: null, from: null, to: null }

export function applyFilters(runs: Run[], f: Filters): Run[] {
  return runs.filter((r) => {
    if (f.mode !== 'todos' && r.mode !== f.mode) return false
    if (f.players !== null && r.heroes.length !== f.players) return false
    if (f.contentVersion && r.contentVersion !== f.contentVersion) return false
    if (f.from && r.startedAt < f.from) return false
    if (f.to && r.startedAt > f.to) return false
    return true
  })
}

export function filterLabel(f: Filters): string {
  const parts: string[] = []
  if (f.mode !== 'todos') parts.push(f.mode)
  if (f.players) parts.push(`${f.players}p`)
  if (f.contentVersion) parts.push(f.contentVersion)
  return parts.join('-')
}

/** Intervalo de Wilson: honesto com n pequeno, que é o caso deste app. */
export function wilson(successes: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 }
  const p = successes / n
  const d = 1 + (z * z) / n
  const center = p + (z * z) / (2 * n)
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return { low: Math.max(0, (center - spread) / d), high: Math.min(1, (center + spread) / d) }
}

export const TARGET_WIN_RATE = { base: 0.53, duo: 0.49 }

export interface WinRate {
  mode: 'base' | 'duo'
  n: number
  wins: number
  rate: number
  low: number
  high: number
  target: number
}

export function winRates(runs: Run[]): WinRate[] {
  return (['base', 'duo'] as const).map((mode) => {
    const subset = runs.filter((r) => r.mode === mode && r.outcome && r.outcome !== 'abandono')
    const wins = subset.filter((r) => r.outcome === 'vitoria').length
    const n = subset.length
    const { low, high } = wilson(wins, n)
    return { mode, n, wins, rate: n ? wins / n : 0, low, high, target: TARGET_WIN_RATE[mode] }
  })
}

export interface DeathBucket {
  label: string
  monte: number
  caidos: number
  furias: number
}

/** Onde as partidas morrem: histograma por posição, com o chefe destacado. */
export function deaths(runs: Run[]): DeathBucket[] {
  const buckets: DeathBucket[] = [
    { label: 'Andar I', monte: 0, caidos: 0, furias: 0 },
    { label: 'Andar II', monte: 0, caidos: 0, furias: 0 },
    { label: 'Andar III', monte: 0, caidos: 0, furias: 0 },
    { label: 'Fase I', monte: 0, caidos: 0, furias: 0 },
    { label: 'Fase II', monte: 0, caidos: 0, furias: 0 },
    { label: 'Fase III', monte: 0, caidos: 0, furias: 0 },
  ]

  for (const run of runs) {
    if (run.outcome !== 'derrota' || !run.defeatCause) continue
    const last = run.resolved.at(-1)
    if (!last) continue
    const card = cardById(last.cardId)
    const index =
      card.kind === 'boss' ? 2 + card.phase : (card.floor as number) - 1
    const bucket = buckets[Math.min(index, buckets.length - 1)]
    bucket[run.defeatCause] += 1
  }

  return buckets
}

export interface AbstentionRow {
  cardId: string
  name: string
  seen: number
  abstentions: number
  eligible: number
  rate: number
}

/**
 * Vagas evitadas: percentual de vezes em que havia herói elegível que não
 * entrou. O painel que mais informa balanceamento de custo.
 */
export function abstentions(runs: Run[]): AbstentionRow[] {
  const rows = new Map<string, AbstentionRow>()

  for (const run of runs) {
    for (const card of run.resolved) {
      if (!card.hidden) continue
      const abstained = card.hidden.eligibleAbstained.length
      const eligible = abstained + card.slots.filter(Boolean).length
      const row = rows.get(card.cardId) ?? {
        cardId: card.cardId,
        name: cardById(card.cardId).name,
        seen: 0,
        abstentions: 0,
        eligible: 0,
        rate: 0,
      }
      row.seen += 1
      row.abstentions += abstained
      row.eligible += eligible
      rows.set(card.cardId, row)
    }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, rate: r.eligible ? r.abstentions / r.eligible : 0 }))
    .sort((a, b) => b.rate - a.rate)
}

export interface DeadConsumable {
  id: string
  name: string
  taken: number
  played: number
}

/** Zero jogadas em muitas obtenções é carta a refazer. */
export function deadConsumables(runs: Run[]): DeadConsumable[] {
  const rows = new Map<string, DeadConsumable>()

  for (const run of runs) {
    for (const e of run.events) {
      if (e.undone) continue
      const id = e.type === 'loot_taken' ? String(e.payload.chosen) : e.type === 'consumable_played' ? String(e.payload.consumableId) : null
      if (!id) continue
      const loot = lootById(id)
      if (loot.lootType === 'equip') continue
      const row = rows.get(id) ?? { id, name: loot.name, taken: 0, played: 0 }
      if (e.type === 'loot_taken') row.taken += 1
      else row.played += 1
      rows.set(id, row)
    }
  }

  return [...rows.values()].sort((a, b) => a.played / (a.taken || 1) - b.played / (b.taken || 1))
}

export interface Distribution {
  label: string
  n: number
  median: number
  p90: number
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

function describe(label: string, values: number[]): Distribution {
  const sorted = [...values].sort((a, b) => a - b)
  return { label, n: sorted.length, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) }
}

/** Mediana e p90 — a média mente quando uma mesa trava vinte minutos. */
export function times(runs: Run[]): Distribution[] {
  const matches: number[] = []
  const slotDecisions: number[] = []
  const damageSplits: number[] = []
  const marcos: number[] = []

  for (const run of runs) {
    if (run.endedAt) matches.push(new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime())
    for (const e of run.events) {
      if (e.undone) continue
      if (e.type === 'card_committed' && typeof e.payload.deliberationMs === 'number') {
        slotDecisions.push(e.payload.deliberationMs)
      }
      if (e.type === 'damage_assigned' && typeof e.payload.decisionMs === 'number') {
        damageSplits.push(e.payload.decisionMs)
      }
      if (e.type === 'marco_spent' && typeof e.payload.decisionMs === 'number') {
        marcos.push(e.payload.decisionMs)
      }
    }
  }

  return [
    describe('Partida', matches),
    describe('Decisão de vaga', slotDecisions),
    describe('Divisão de dano', damageSplits),
    describe('Escolha de Marco', marcos),
  ]
}

export interface RestStats {
  restsPerRun: number
  positions: number[]
  scarsByCause: { damage: number; rest: number; overflow: number }
}

export function restStats(runs: Run[]): RestStats {
  const positions: number[] = []
  const scarsByCause = { damage: 0, rest: 0, overflow: 0 }
  let rests = 0

  for (const run of runs) {
    for (const e of run.events) {
      if (e.undone) continue
      if (e.type === 'rest_taken') {
        rests += 1
        positions.push(Number(e.payload.deckBefore ?? 0))
      }
      if (e.type === 'scar_drawn') {
        const cause = String(e.payload.cause) as keyof typeof scarsByCause
        if (cause in scarsByCause) scarsByCause[cause] += 1
      }
    }
  }

  return { restsPerRun: runs.length ? rests / runs.length : 0, positions, scarsByCause }
}

export interface DamagePerHero {
  key: string
  label: string
  damage: number
  entries: number
  perEntry: number
}

/** Dano por entrada, não dano bruto: revela se alguma classe absorve demais. */
export function damagePerClass(runs: Run[]): DamagePerHero[] {
  const rows = new Map<string, DamagePerHero>()

  for (const run of runs) {
    const classOf = new Map(run.heroes.map((h) => [h.id, h.classId]))
    for (const card of run.resolved) {
      for (const { heroId, points } of card.damageAssignment) {
        const key = classOf.get(heroId) ?? 'desconhecida'
        const row = rows.get(key) ?? { key, label: key.replace('class-', ''), damage: 0, entries: 0, perEntry: 0 }
        row.damage += points
        rows.set(key, row)
      }
      for (const id of card.slots.filter((s): s is string => !!s)) {
        const key = classOf.get(id)
        if (!key) continue
        const row = rows.get(key) ?? { key, label: key.replace('class-', ''), damage: 0, entries: 0, perEntry: 0 }
        row.entries += 1
        rows.set(key, row)
      }
    }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, perEntry: r.entries ? r.damage / r.entries : 0 }))
    .sort((a, b) => b.perEntry - a.perEntry)
}

/**
 * O painel bônus. A média da diferença entre a chance da composição escolhida e
 * a da melhor possível é uma medida direta de quanto a mesa deixa na mesa.
 */
export function tableIntuition(runs: Run[]): { n: number; meanGap: number; optimalRate: number } {
  let n = 0
  let gapSum = 0
  let optimal = 0

  for (const run of runs) {
    for (const card of run.resolved) {
      if (!card.hidden?.bestAlternative) continue
      const gap = card.hidden.bestAlternative.prob - card.hidden.winProbability
      n += 1
      gapSum += gap
      if (gap < 0.001) optimal += 1
    }
  }

  return { n, meanGap: n ? gapSum / n : 0, optimalRate: n ? optimal / n : 0 }
}

export const MIN_RUNS_FOR_SIGNAL = 10
