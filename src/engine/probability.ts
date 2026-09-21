import type { OffSuitPolicy } from '../content/types'
import type { ActorId, HiddenMath } from './state'
import type { ActorRollSpec } from './resolve'

/** Distribution over the number of successes in `n` dice hitting on `threshold`+. */
export function successDistribution(n: number, threshold: 4 | 5): number[] {
  const p = (7 - threshold) / 6
  let dist = [1]
  for (let i = 0; i < n; i++) {
    const next = new Array(dist.length + 1).fill(0)
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p)
      next[k + 1] += dist[k] * p
    }
    dist = next
  }
  return dist
}

/** The same distribution after the off-suit rule folds raw successes into counted ones. */
export function countedDistribution(spec: ActorRollSpec): number[] {
  const raw = successDistribution(spec.poolSize, spec.threshold)
  if (!spec.offSuit || spec.policy === 'full') return raw
  const out: number[] = []
  for (let k = 0; k < raw.length; k++) {
    const counted = counted_(k, spec.policy)
    out[counted] = (out[counted] ?? 0) + raw[k]
  }
  return out.map((x) => x ?? 0)
}

function counted_(raw: number, policy: OffSuitPolicy): number {
  if (policy === 'none') return 0
  if (policy === 'full') return raw
  return Math.floor(raw / 2)
}

export function expectedOf(dist: number[]): number {
  return dist.reduce((sum, p, k) => sum + p * k, 0)
}

function convolve(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) continue
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j]
  }
  return out
}

/** P(total counted successes >= target). Tying the target is a win. */
export function winProbability(specs: ActorRollSpec[], target: number): number {
  if (!specs.length) return target <= 0 ? 1 : 0
  let total = [1]
  for (const s of specs) total = convolve(total, countedDistribution(s))
  let p = 0
  for (let k = Math.max(0, target); k < total.length; k++) p += total[k]
  return Math.min(1, Math.max(0, p))
}

export interface HiddenMathInput {
  chosen: ActorId[]
  target: number
  /** Every actor who could legally have taken a slot, chosen ones included. */
  eligible: ActorId[]
  maxSlots: number
  specFor: (actorId: ActorId, group: ActorId[]) => ActorRollSpec | null
  /** Target can depend on who enters, so the caller recomputes it per composition. */
  targetFor?: (group: ActorId[]) => number
}

function combinations<T>(items: T[], max: number): T[][] {
  const out: T[][] = []
  const walk = (start: number, acc: T[]) => {
    if (acc.length > 0) out.push([...acc])
    if (acc.length === max) return
    for (let i = start; i < items.length; i++) {
      acc.push(items[i])
      walk(i + 1, acc)
      acc.pop()
    }
  }
  walk(0, [])
  return out
}

/**
 * Everything the table is not allowed to see: expected successes, win
 * probability, and the best composition the engine can find. Computed on
 * commit, written to the log, never rendered before `resolving`.
 */
export function computeHiddenMath(input: HiddenMathInput): HiddenMath {
  const specs = input.chosen
    .map((id) => input.specFor(id, input.chosen))
    .filter((s): s is ActorRollSpec => s !== null)

  const expectedByActor = specs.map((s) => ({
    id: s.actorId,
    expected: expectedOf(countedDistribution(s)),
  }))
  const expectedTotal = expectedByActor.reduce((n, x) => n + x.expected, 0)
  const prob = winProbability(specs, input.target)

  let best: { slots: ActorId[]; prob: number } | null = null
  // Small table, few slots: an exhaustive search is cheaper than a heuristic.
  for (const group of combinations(input.eligible, input.maxSlots)) {
    const groupTarget = input.targetFor ? input.targetFor(group) : input.target
    const groupSpecs = group
      .map((id) => input.specFor(id, group))
      .filter((s): s is ActorRollSpec => s !== null)
    const p = winProbability(groupSpecs, groupTarget)
    if (!best || p > best.prob) best = { slots: group, prob: p }
  }

  const chosenSet = new Set(input.chosen)
  return {
    expectedByActor,
    expectedTotal,
    winProbability: prob,
    bestAlternative: best,
    eligibleAbstained: input.eligible.filter((id) => !chosenSet.has(id)),
  }
}
