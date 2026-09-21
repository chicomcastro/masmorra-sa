import { content } from '../content'
import type { Boss, Obstacle } from '../content/types'
import type { Rng } from './prng'

export interface DeckBuild {
  deck: string[]
  bossId: string
  composition: { floor1: string[]; floor2: string[]; floor3: string[]; boss: string[] }
}

/**
 * Base: 5 obstacles per floor, I on top of II on top of III, plus the 3 boss phases.
 * Duo: drops the 3-slot cards, builds 5·5·4 and uses the Duo bosses. 18 / 17 cards.
 */
export function buildDeck(mode: 'base' | 'duo', rng: Rng): DeckBuild {
  const pool = content.obstacles.filter((o) => (mode === 'duo' ? !o.duoExcluded : true))
  const counts = mode === 'duo' ? { 1: 5, 2: 5, 3: 4 } : { 1: 5, 2: 5, 3: 5 }

  const pickFloor = (floor: 1 | 2 | 3): Obstacle[] => {
    const all = pool.filter((o) => o.floor === floor)
    const n = counts[floor]
    if (all.length < n) throw new Error(`andar ${floor}: ${all.length} obstáculos para ${n} vagas`)
    return rng.shuffle(rng.sample(all, n))
  }

  const f1 = pickFloor(1)
  const f2 = pickFloor(2)
  const f3 = pickFloor(3)

  const bosses: Boss[] = content.bosses.filter((b) => b.duo === (mode === 'duo'))
  const boss = rng.pick(bosses)
  const phases = content.bossPhases
    .filter((p) => p.bossId === boss.id)
    .sort((a, b) => a.phase - b.phase)
    .map((p) => p.id)

  const composition = {
    floor1: f1.map((o) => o.id),
    floor2: f2.map((o) => o.id),
    floor3: f3.map((o) => o.id),
    boss: phases,
  }

  return {
    deck: [...composition.floor1, ...composition.floor2, ...composition.floor3, ...phases],
    bossId: boss.id,
    composition,
  }
}
