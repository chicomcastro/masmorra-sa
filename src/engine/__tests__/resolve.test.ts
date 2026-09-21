import { describe, expect, it } from 'vitest'
import { cardById } from '../../content'
import { baseThresholds, derivedPools, derivedThresholds, startingPools } from '../hero'
import { countSuccesses, effectiveTarget, lootOrder, lowestScorer, offSuitPolicyFor, rollSpecFor, splitDamage } from '../resolve'
import type { Entry, Hero, Squire } from '../state'

function hero(over: Partial<Hero> = {}): Hero {
  const raceId = over.raceId ?? 'race-humano-generico'
  const classId = over.classId ?? 'class-barbaro'
  return {
    id: 'h1',
    profileId: null,
    name: 'Vurm',
    raceId,
    classId,
    pools: startingPools(raceId, classId, ['forca']),
    thresholds: baseThresholds(),
    vigor: 6,
    maxVigor: 6,
    wounds: [],
    scars: [],
    xp: 0,
    pendingMarcos: 0,
    specializations: [],
    equipment: {},
    consumables: [],
    down: false,
    ...over,
  }
}

const entry = (actorId: string, counted: number): Entry => ({
  actorId,
  suit: 'forca',
  offSuit: false,
  poolSize: 3,
  threshold: 5,
  declaredSuccesses: counted,
  countedSuccesses: counted,
  crits: null,
  enteredAt: '',
  correctedFrom: null,
})

describe('naipe errado', () => {
  it('conta 2 por 1, arredondando para baixo', () => {
    expect(countSuccesses(3, true, 'half')).toBe(1)
    expect(countSuccesses(4, true, 'half')).toBe(2)
    expect(countSuccesses(1, true, 'half')).toBe(0)
  })

  it('não altera sucessos de naipe certo', () => {
    expect(countSuccesses(3, false, 'half')).toBe(3)
  })

  it('o Bardo conta cheio fora do naipe', () => {
    const bardo = hero({ classId: 'class-bardo' })
    expect(offSuitPolicyFor(cardById('obs-i-goblin-procuracao'), bardo)).toBe('full')
  })

  it('o Escriba Sem Mãos anula sucessos de naipe errado', () => {
    expect(offSuitPolicyFor(cardById('obs-ii-escriba-sem-maos'), hero())).toBe('none')
  })
})

describe('pools derivados', () => {
  it('soma raça e classe', () => {
    const h = hero({ raceId: 'race-meio-ogro', classId: 'class-barbaro' })
    expect(derivedPools(h).forca).toBe(4)
    expect(derivedPools(h).fe).toBe(1)
  })

  it('tira 1 dado de todos os pools a cada 3 Ferimentos', () => {
    const base = derivedPools(hero()).forca
    const ferido = hero({ wounds: ['wound-dedo-torto', 'wound-tornozelo-inchado', 'wound-orgulho-ferido'] })
    expect(derivedPools(ferido).forca).toBe(base - 1)
  })

  it('aplica o efeito individual do Ferimento', () => {
    const base = derivedPools(hero()).forca
    expect(derivedPools(hero({ wounds: ['wound-ombro-que-estala'] })).forca).toBe(base - 1)
  })

  it('Apuro e Fechaduras baixam o limiar para 4+, sem passar disso', () => {
    expect(derivedThresholds(hero({ classId: 'class-ladino', specializations: ['spec-fechaduras'] })).manha).toBe(4)
    expect(derivedThresholds(hero()).manha).toBe(5)
  })

  it('o Salão dos Contratos Rasgados sobe o limiar em 1', () => {
    const card = cardById('obs-iii-salao-contratos-rasgados')
    expect(derivedThresholds(hero({ classId: 'class-ladino', specializations: ['spec-fechaduras'] }), { card }).manha).toBe(5)
  })
})

describe('alvo efetivo', () => {
  const ctx = (over: Partial<Parameters<typeof effectiveTarget>[0]>) => ({
    card: cardById('obs-i-coral-ratos-devotos'),
    mode: 'base' as const,
    heroes: [hero({ id: 'h1' }), hero({ id: 'h2' }), hero({ id: 'h3' })],
    squires: [] as Squire[],
    slots: [null, null, null] as (string | null)[],
    furias: 0,
    bossRetryBonus: 0,
    ...over,
  })

  it('o Coral de Ratos cai para 3 com as três vagas ocupadas', () => {
    expect(effectiveTarget(ctx({ slots: ['h1', 'h2', null] })).target).toBe(4)
    expect(effectiveTarget(ctx({ slots: ['h1', 'h2', 'h3'] })).target).toBe(3)
  })

  it('no Duo, obstáculo de 2 vagas vale alvo −1', () => {
    const card = cardById('obs-i-goblin-procuracao')
    expect(effectiveTarget(ctx({ card, mode: 'base', slots: [null, null] })).target).toBe(3)
    expect(effectiveTarget(ctx({ card, mode: 'duo', slots: [null, null] })).target).toBe(2)
  })

  it('cada Fúria soma 1 ao alvo das fases do chefe', () => {
    const card = cardById('boss-duo-a-2')
    expect(effectiveTarget(ctx({ card, mode: 'duo', furias: 2, slots: [null, null] })).target).toBe(5)
  })

  it('no base, a fase repetida pede +1 sucesso por tentativa', () => {
    const card = cardById('boss-a-1')
    expect(effectiveTarget(ctx({ card, bossRetryBonus: 2, slots: [null, null] })).target).toBe(7)
  })

  it('o Coro dos Auditores soma 1 por Ferimento dos participantes', () => {
    const card = cardById('obs-iii-coro-dos-auditores')
    const heroes = [hero({ id: 'h1', wounds: ['wound-dedo-torto', 'wound-corte-feio'] }), hero({ id: 'h2' })]
    expect(effectiveTarget(ctx({ card, heroes, slots: ['h1', null, null] })).target).toBe(8)
    expect(effectiveTarget(ctx({ card, heroes, slots: ['h2', null, null] })).target).toBe(6)
  })

  it('Lábia baixa o alvo da carta em que o Bardo entra', () => {
    const card = cardById('obs-i-goblin-procuracao')
    const bardo = hero({ id: 'h1', classId: 'class-bardo', specializations: ['spec-labia'] })
    expect(effectiveTarget(ctx({ card, heroes: [bardo], slots: ['h1', null] })).target).toBe(2)
  })
})

describe('rolagem', () => {
  const base = {
    card: cardById('obs-i-goblin-procuracao'),
    mode: 'base' as const,
    squires: [] as Squire[],
    furias: 0,
    bossRetryBonus: 0,
  }

  it('escolhe o naipe da carta quando o herói o tem', () => {
    const ladino = hero({ id: 'h1', classId: 'class-ladino' })
    const spec = rollSpecFor('h1', { ...base, heroes: [ladino], slots: ['h1', null] })!
    expect(spec.suit).toBe('manha')
    expect(spec.offSuit).toBe(false)
    // Ladino dá 3 de Manha; o dado livre do Humano foi para Força.
    expect(spec.poolSize).toBe(3)
  })

  it('cai no melhor pool, fora do naipe, quando o herói não tem', () => {
    const barbaro = hero({ id: 'h1', raceId: 'race-meio-ogro', classId: 'class-barbaro' })
    const spec = rollSpecFor('h1', { ...base, heroes: [barbaro], slots: ['h1', null] })!
    expect(spec.suit).toBe('forca')
    expect(spec.offSuit).toBe(true)
  })

  it('o Escudeiro rola 3 dados, 4 na Fase I do Almoxarife Duo', () => {
    const squire: Squire = { id: 's1', squireId: 'squire-forca', suit: 'forca', name: 'Brasa', pool: 3, retired: false }
    const plain = rollSpecFor('s1', { ...base, heroes: [], squires: [squire], slots: ['s1'] })!
    expect(plain.poolSize).toBe(3)
    const boosted = rollSpecFor('s1', {
      ...base,
      card: cardById('boss-duo-a-1'),
      mode: 'duo',
      heroes: [],
      squires: [squire],
      slots: ['s1', null],
    })!
    expect(boosted.poolSize).toBe(4)
  })

  it('a Comissão de Ética ignora equipamento na Fase I', () => {
    // Clérigo draconato: 4 dados de Fé de ficha, 5 com o Turíbulo na mão.
    const armado = hero({
      id: 'h1',
      raceId: 'race-draconato-aposentado',
      classId: 'class-clerigo',
      equipment: { maoA: 'loot-turibulo-amassado' },
    })
    const outraFase = rollSpecFor('h1', {
      ...base,
      card: cardById('boss-a-2'),
      heroes: [armado],
      slots: ['h1', null],
    })!
    const naComissao = rollSpecFor('h1', {
      ...base,
      card: cardById('boss-d-1'),
      heroes: [armado],
      slots: ['h1', null],
    })!
    expect(outraFase.suit).toBe('fe')
    expect(naComissao.suit).toBe('fe')
    expect(outraFase.poolSize).toBe(5)
    expect(naComissao.poolSize).toBe(4)
  })
})

describe('dano', () => {
  it('divide igualmente e manda a sobra para o pote', () => {
    const heroes = [hero({ id: 'h1' }), hero({ id: 'h2' })]
    const split = splitDamage(3, heroes)
    expect(split.assignment.map((a) => a.points)).toEqual([1, 1])
    expect(split.remainder).toBe(1)
  })

  it('avisa quando o dano viraria Cicatriz', () => {
    const heroes = [hero({ id: 'h1', vigor: 1 })]
    expect(splitDamage(3, heroes).wouldScar).toEqual([{ heroId: 'h1', excess: 2 }])
  })

  it('o Draconato reduz a própria parte em 1, com mínimo 1', () => {
    const heroes = [hero({ id: 'h1', raceId: 'race-draconato-aposentado' }), hero({ id: 'h2' })]
    const split = splitDamage(4, heroes)
    expect(split.assignment).toEqual([
      { heroId: 'h1', points: 1 },
      { heroId: 'h2', points: 2 },
    ])
  })

  it('Escudo limita a parte a 1 ponto', () => {
    const heroes = [hero({ id: 'h1', classId: 'class-guardiao', specializations: ['spec-escudo'] })]
    expect(splitDamage(5, heroes).assignment[0].points).toBe(1)
  })

  it('a sobra tem como padrão quem declarou menos sucessos', () => {
    expect(lowestScorer([entry('h1', 3), entry('h2', 1), entry('h3', 2)])).toBe('h2')
  })
})

describe('ordem do saque', () => {
  it('quem tirou mais escolhe primeiro', () => {
    expect(lootOrder([entry('h1', 1), entry('h2', 3)], [hero({ id: 'h1' }), hero({ id: 'h2' })])).toEqual(['h2', 'h1'])
  })

  it('Orgulho Ferido escolhe por último, com quantos sucessos for', () => {
    const heroes = [hero({ id: 'h1', wounds: ['wound-orgulho-ferido'] }), hero({ id: 'h2' })]
    expect(lootOrder([entry('h1', 5), entry('h2', 0)], heroes)).toEqual(['h2', 'h1'])
  })
})
