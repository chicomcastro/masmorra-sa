import { describe, expect, it } from 'vitest'
import { buildDeck } from '../deck'
import { makeRng } from '../prng'
import { content } from '../../content'
import { cardById } from '../../content'

describe('monte', () => {
  it('base fecha com 18 cartas: 5·5·5 + 3 fases', () => {
    const { deck, composition } = buildDeck('base', makeRng(42))
    expect(deck).toHaveLength(18)
    expect(composition.floor1).toHaveLength(5)
    expect(composition.floor2).toHaveLength(5)
    expect(composition.floor3).toHaveLength(5)
    expect(composition.boss).toHaveLength(3)
  })

  it('duo fecha com 17 cartas: 5·5·4 + 3 fases, sem cartas de 3 vagas', () => {
    const { deck, composition, bossId } = buildDeck('duo', makeRng(7))
    expect(deck).toHaveLength(17)
    expect(composition.floor3).toHaveLength(4)
    for (const id of [...composition.floor1, ...composition.floor2, ...composition.floor3]) {
      expect(cardById(id).slots).toBeLessThan(3)
    }
    expect(content.bosses.find((b) => b.id === bossId)?.duo).toBe(true)
  })

  it('as fases do chefe ficam no fundo, em ordem', () => {
    const { deck } = buildDeck('base', makeRng(1))
    const tail = deck.slice(-3).map((id) => cardById(id))
    expect(tail.map((c) => c.kind)).toEqual(['boss', 'boss', 'boss'])
    expect(tail.map((c) => (c as { phase: number }).phase)).toEqual([1, 2, 3])
  })

  it('a mesma semente produz o mesmo monte', () => {
    expect(buildDeck('base', makeRng(123)).deck).toEqual(buildDeck('base', makeRng(123)).deck)
    expect(buildDeck('base', makeRng(123)).deck).not.toEqual(buildDeck('base', makeRng(124)).deck)
  })
})
