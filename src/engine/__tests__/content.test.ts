import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { validateContent } from '../../content/validate'

describe('content.json', () => {
  it('passa no validador em silêncio', () => {
    const issues = validateContent(content)
    expect(issues.map((i) => `${i.path}: ${i.message}`)).toEqual([])
  })

  it('tem obstáculos suficientes por andar nos dois modos', () => {
    for (const floor of [1, 2, 3] as const) {
      const all = content.obstacles.filter((o) => o.floor === floor)
      expect(all.length).toBeGreaterThanOrEqual(5)
      const duo = all.filter((o) => !o.duoExcluded)
      expect(duo.length).toBeGreaterThanOrEqual(floor === 3 ? 4 : 5)
    }
  })

  it('tem 4 chefes base e 4 chefes duo, com 3 fases cada', () => {
    expect(content.bosses.filter((b) => !b.duo)).toHaveLength(4)
    expect(content.bosses.filter((b) => b.duo)).toHaveLength(4)
    for (const b of content.bosses) {
      expect(content.bossPhases.filter((p) => p.bossId === b.id)).toHaveLength(3)
    }
  })

  it('marca needsCritInput em toda carta com onCrit', () => {
    for (const card of [...content.obstacles, ...content.bossPhases]) {
      const hasCrit = card.effects.some((e) => e.kind === 'onCrit')
      if (hasCrit) expect(card.needsCritInput, card.id).toBe(true)
    }
  })
})
