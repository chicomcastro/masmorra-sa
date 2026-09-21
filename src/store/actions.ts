import type { Suit } from '../content/types'
import type { Debrief } from '../engine/state'

export interface HeroSetup {
  name: string
  profileId: string | null
  raceId: string
  classId: string
  /** For Humano Genérico (`livre`) and Bardo (`escolha2`). */
  freeSuits: Suit[]
}

export type Action =
  | { type: 'START_RUN'; mode: 'base' | 'duo'; heroes: HeroSetup[]; squireIds: string[]; seed?: number }
  | { type: 'REVEAL_CARD' }
  | { type: 'TOGGLE_SLOT'; actorId: string }
  | { type: 'COMMIT_SLOTS' }
  | { type: 'RETREAT' }
  | { type: 'DECLARE_ENTRY'; actorId: string; declared: number; crits: number | null }
  | { type: 'CORRECT_ENTRY'; actorId: string }
  | { type: 'PLAY_CONSUMABLE'; heroId: string; consumableId: string }
  | { type: 'CONFIRM_VERDICT' }
  | { type: 'ASSIGN_DAMAGE'; assignment: { heroId: string; points: number }[] }
  | { type: 'TAKE_LOOT'; heroId: string; chosen: string; equippedTo: string | null }
  | { type: 'SPEND_MARCO'; heroId: string; choice: 'amplitude' | 'apuro' | 'arte'; detail: string }
  | { type: 'ADVANCE' }
  | { type: 'START_REST' }
  | { type: 'REST_HEAL' }
  | { type: 'REST_HEALER'; healerId: string | null; successes: number; distribution: { heroId: string; points: number }[] }
  | { type: 'REST_LUCK'; rolls: { heroId: string; rolledOne: boolean }[] }
  | { type: 'REST_DONE' }
  | { type: 'EQUIP'; heroId: string; lootId: string; slot: string }
  | { type: 'UNEQUIP'; heroId: string; slot: string }
  | { type: 'ABANDON' }
  | { type: 'OVERRIDE'; path: string; from: unknown; to: unknown; reason?: string }
  | { type: 'UNDO' }
  | { type: 'SAVE_DEBRIEF'; debrief: Debrief; runId?: string }
  | { type: 'ARCHIVE_RUN' }
  | { type: 'DISCARD_RUN' }
  | { type: 'NOTE_MANUAL'; text: string }
  | { type: 'UPSERT_PROFILE'; id: string | null; name: string }
  | { type: 'REMOVE_SCAR'; profileId: string; scarId: string }
  | { type: 'DELETE_PROFILE'; profileId: string }
  | { type: 'DELETE_ARCHIVED'; runId: string }
  | { type: 'IMPORT'; payload: unknown }
