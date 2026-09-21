import { describe, expect, it } from 'vitest'
import { countedDistribution, expectedOf, successDistribution, winProbability } from '../probability'
import type { ActorRollSpec } from '../resolve'

const spec = (over: Partial<ActorRollSpec>): ActorRollSpec => ({
  actorId: 'a',
  name: 'A',
  suit: 'forca',
  offSuit: false,
  poolSize: 4,
  threshold: 5,
  policy: 'half',
  ...over,
})

describe('probabilidade oculta', () => {
  it('distribui 4 dados em 5+ com esperado 4/3', () => {
    const dist = successDistribution(4, 5)
    expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(expectedOf(dist)).toBeCloseTo(4 * (2 / 6), 10)
  })

  it('limiar 4+ vale metade dos dados', () => {
    expect(expectedOf(successDistribution(5, 4))).toBeCloseTo(2.5, 10)
  })

  it('naipe errado conta 2 por 1, arredondando para baixo', () => {
    const dist = countedDistribution(spec({ offSuit: true, poolSize: 3 }))
    const raw = successDistribution(3, 5)
    // 0 e 1 sucessos brutos viram 0; 2 e 3 viram 1.
    expect(dist[0]).toBeCloseTo(raw[0] + raw[1], 10)
    expect(dist[1]).toBeCloseTo(raw[2] + raw[3], 10)
  })

  it('naipe errado não conta nada sob a política "none"', () => {
    const dist = countedDistribution(spec({ offSuit: true, policy: 'none' }))
    expect(dist[0]).toBeCloseTo(1, 10)
  })

  it('empatar com o alvo é vitória', () => {
    const p = winProbability([spec({ poolSize: 1, threshold: 5 })], 1)
    expect(p).toBeCloseTo(2 / 6, 10)
  })

  it('alvo zero é vitória certa', () => {
    expect(winProbability([spec({ poolSize: 0 })], 0)).toBeCloseTo(1, 10)
  })

  it('mais participantes aumentam a chance', () => {
    const one = winProbability([spec({})], 3)
    const two = winProbability([spec({}), spec({ actorId: 'b' })], 3)
    expect(two).toBeGreaterThan(one)
  })
})
