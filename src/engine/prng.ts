/** mulberry32 — seeded, auditable. Every shuffle and blind draw goes through this. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next(): number
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  sample<T>(items: readonly T[], n: number): T[]
  /** Calls consumed so far — replaying with the same seed and count is deterministic. */
  readonly calls: number
}

export function makeRng(seed: number, skip = 0): Rng {
  const next = mulberry32(seed)
  let calls = 0
  for (let i = 0; i < skip; i++) {
    next()
    calls++
  }
  const rng: Rng = {
    next() {
      calls++
      return next()
    },
    int(maxExclusive: number) {
      return Math.floor(rng.next() * maxExclusive)
    },
    pick(items) {
      return items[rng.int(items.length)]
    },
    shuffle(items) {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(i + 1)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    sample(items, n) {
      return rng.shuffle(items).slice(0, n)
    },
    get calls() {
      return calls
    },
  }
  return rng
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
