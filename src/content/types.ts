export type Suit = 'forca' | 'arcano' | 'manha' | 'fe'
export const SUITS: Suit[] = ['forca', 'arcano', 'manha', 'fe']
export const SUIT_LABEL: Record<Suit, string> = {
  forca: 'Força',
  arcano: 'Arcano',
  manha: 'Manha',
  fe: 'Fé',
}

/** Slots on the body. Extends the spec's five with the slots the printed cards actually use. */
export type BodySlot = 'mao' | 'maos' | 'corpo' | 'cabeca' | 'cinto' | 'pernas' | 'colo'

export type OffSuitPolicy = 'half' | 'full' | 'none'

/**
 * Discriminated effects. Anything the engine cannot honour mechanically is a
 * `manual` effect: the app prints the text and the table confirms what it did.
 */
export type Effect =
  | { kind: 'targetIfSlotsFull'; value: number }
  | { kind: 'targetDelta'; when: string; value: number }
  | { kind: 'damageDelta'; value: number; scope?: 'hero' | 'card' }
  | { kind: 'damageCap'; value: number }
  | { kind: 'onCrit'; grant: 'vigor' | 'success' | 'damageReduction' | 'targetReduction' | 'diceBank' }
  | { kind: 'poolDelta'; suit: Suit | 'any' | 'best' | 'declared'; value: number; scope: string }
  | { kind: 'thresholdDelta'; suit: Suit | null; value: number }
  | { kind: 'successDelta'; value: number }
  | { kind: 'slotDelta'; value: number }
  | { kind: 'forbid'; what: string }
  | { kind: 'rewardAbstainers'; grant: 'loot' | 'diceBank' }
  | { kind: 'offSuitPolicy'; policy: OffSuitPolicy; onlySuit?: Suit }
  | { kind: 'ignoreEquipment' }
  | { kind: 'restHealDelta'; value: number }
  | { kind: 'healPerSuccess'; value: number }
  | { kind: 'lootOrder'; position: 'first' | 'last' }
  | { kind: 'lootDraw'; value: number }
  | { kind: 'choosePoolSwap'; plus: number; minus: number }
  | { kind: 'manual'; text: string }

export const EFFECT_KINDS = [
  'targetIfSlotsFull', 'targetDelta', 'damageDelta', 'damageCap', 'onCrit', 'poolDelta',
  'thresholdDelta', 'successDelta', 'slotDelta', 'forbid', 'rewardAbstainers', 'offSuitPolicy',
  'ignoreEquipment', 'restHealDelta', 'healPerSuccess', 'lootOrder', 'lootDraw',
  'choosePoolSwap', 'manual',
] as const

export interface Obstacle {
  id: string
  kind: 'obstacle'
  floor: 1 | 2 | 3
  category: string
  name: string
  flavor: string
  suit: Suit | Suit[]
  target: number
  slots: number
  damage: number
  effectText: string
  footer: string
  effects: Effect[]
  needsCritInput: boolean
  duoExcluded: boolean
}

export interface Boss {
  id: string
  name: string
  duo: boolean
}

export interface BossPhase {
  id: string
  bossId: string
  kind: 'boss'
  phase: 1 | 2 | 3
  phaseName: 'Postura' | 'Virada' | 'Desespero'
  name: string
  flavor: string
  suit: Suit | Suit[] | null
  target: number
  slots: number | 'all'
  damage: number
  thresholdDelta: number
  effectText: string
  footer: string
  effects: Effect[]
  needsCritInput: boolean
  duoVariant: boolean
}

export interface Squire {
  id: string
  kind: 'squire'
  name: string
  flavor: string
  suit: Suit
  pool: number
  threshold: number
  effectText: string
  footer: string
}

export interface Loot {
  id: string
  kind: 'loot'
  lootType: 'equip' | 'consumable' | 'trinket'
  category: string
  name: string
  flavor: string
  bodySlot: BodySlot | null
  handsUsed: 0 | 1 | 2
  permanent: boolean
  effectText: string
  drawbackText: string
  footer: string
  effects: Effect[]
  drawback: Effect[]
}

export interface Affliction {
  id: string
  kind: 'wound' | 'scar'
  name: string
  flavor: string
  effectText: string
  footer: string
  permanent: boolean
  effects: Effect[]
}

export interface Race {
  id: string
  kind: 'race'
  name: string
  flavor: string
  poolGrants: Record<string, number>
  vigor: number
  effectText: string
  footer: string
  effects: Effect[]
}

export interface HeroClass {
  id: string
  kind: 'class'
  name: string
  flavor: string
  poolGrants: Record<string, number>
  effectText: string
  footer: string
  effects: Effect[]
  specializations: string[]
}

export interface Specialization {
  id: string
  kind: 'specialization'
  classId: string
  name: string
  flavor: string
  effectText: string
  footer: string
  effects: Effect[]
}

export interface Content {
  contentVersion: string
  obstacles: Obstacle[]
  bosses: Boss[]
  bossPhases: BossPhase[]
  squires: Squire[]
  loot: Loot[]
  wounds: Affliction[]
  scars: Affliction[]
  races: Race[]
  classes: HeroClass[]
  specializations: Specialization[]
}

/** Anything that can be revealed from the deck. */
export type DeckCard = Obstacle | BossPhase

export function isBossPhase(card: DeckCard): card is BossPhase {
  return card.kind === 'boss'
}

export function suitsOf(card: DeckCard): Suit[] {
  if (card.suit === null || card.suit === undefined) return SUITS
  return Array.isArray(card.suit) ? card.suit : [card.suit]
}

export function slotCount(card: DeckCard, tableSize: number): number {
  return card.slots === 'all' ? tableSize : (card.slots as number)
}
