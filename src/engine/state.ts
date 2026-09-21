import type { BodySlot, Suit } from '../content/types'

export type RunPhase =
  | 'setup'
  | 'awaitingReveal'
  | 'deciding'
  | 'entering'
  | 'resolving'
  | 'consequences'
  | 'resting'
  | 'bossPhase'
  | 'ended'

export type Pools = Record<Suit, number>
export type Thresholds = Record<Suit, 4 | 5>
export type Equipment = Partial<Record<'maoA' | 'maoB' | BodySlot, string | null>>

export interface Hero {
  id: string
  profileId: string | null
  name: string
  raceId: string
  classId: string
  /** Base pool from race + class, before wounds, scars, equipment and Marcos. */
  pools: Pools
  thresholds: Thresholds
  vigor: number
  maxVigor: number
  wounds: string[]
  scars: string[]
  xp: number
  pendingMarcos: number
  specializations: string[]
  equipment: Equipment
  consumables: string[]
  down: boolean
}

export interface Squire {
  id: string
  squireId: string
  suit: Suit
  name: string
  pool: number
  retired: boolean
}

export type ActorId = string

export interface Entry {
  actorId: ActorId
  suit: Suit
  offSuit: boolean
  poolSize: number
  threshold: 4 | 5
  declaredSuccesses: number
  countedSuccesses: number
  crits: number | null
  enteredAt: string
  correctedFrom: number | null
}

export interface HiddenMath {
  expectedByActor: { id: ActorId; expected: number }[]
  expectedTotal: number
  winProbability: number
  bestAlternative: { slots: ActorId[]; prob: number } | null
  eligibleAbstained: ActorId[]
}

export interface CurrentCard {
  cardId: string
  revealedAt: string
  committedAt: string | null
  resolvedAt: string | null
  slots: (ActorId | null)[]
  baseTarget: number
  effectiveTarget: number
  targetModifiers: { source: string; delta: number }[]
  entries: Entry[]
  consumablesPlayed: { heroId: string; cardId: string; when: RunPhase }[]
  declaredTotal: number
  result: 'vitoria' | 'falha' | 'recuo' | null
  damageAssignment: { heroId: string; points: number }[]
  hidden: HiddenMath | null
  /** Boss phases only: which phase attempt this is, for retry bookkeeping. */
  bossPhaseIndex?: 0 | 1 | 2
}

export interface ResolvedCard extends CurrentCard {
  position: number
  floor: 1 | 2 | 3 | 'boss'
}

export interface GameEvent {
  id: string
  runId: string
  t: string
  type: string
  payload: Record<string, unknown>
  undone?: boolean
}

export interface Debrief {
  funStoppedAtCard: number | null
  confusingCards: string[]
  longDiscussion: string
  leftOutHeroes: string[]
  defeatFairness: number | null
  rulesPlayedWrong: string
  wouldPlayAgain: 'sim' | 'nao' | 'talvez' | null
  savedAt: string | null
}

export interface Run {
  id: string
  schemaVersion: number
  seed: number
  rngCalls: number
  mode: 'base' | 'duo'
  startedAt: string
  endedAt: string | null
  appVersion: string
  contentVersion: string
  heroes: Hero[]
  squires: Squire[]
  deck: string[]
  bossId: string
  deckComposition: Record<string, string[]>
  resolved: ResolvedCard[]
  discardedUnseen: string[]
  current: CurrentCard | null
  phase: RunPhase
  furias: number
  bossPhaseIndex: 0 | 1 | 2
  bossRetryBonus: number
  outcome: 'vitoria' | 'derrota' | 'abandono' | null
  defeatCause: 'monte' | 'caidos' | 'furias' | null
  events: GameEvent[]
  debrief: Debrief | null
  restCount: number
}

export interface Profile {
  id: string
  name: string
  scars: string[]
  createdAt: string
}
