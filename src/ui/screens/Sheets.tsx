import { afflictionById, cardById, classById, lootById, raceById, specById } from '../../content'
import { SUITS, SUIT_LABEL } from '../../content/types'
import { derivedPools, derivedThresholds } from '../../engine/hero'
import type { Run } from '../../engine/state'
import { useDispatch } from '../../store'
import { actorName } from '../../store/reducer'
import { LongPressNumber, Pips, Sheet } from '../components/primitives'

const EQUIP_SLOTS: [string, string][] = [
  ['maoA', 'Mão A'],
  ['maoB', 'Mão B'],
  ['maos', 'Luvas'],
  ['cabeca', 'Cabeça'],
  ['corpo', 'Corpo'],
  ['cinto', 'Cinto'],
  ['pernas', 'Pernas'],
  ['colo', 'Colo'],
]

export function FichaSheet({ run, heroId, onClose }: { run: Run; heroId: string; onClose: () => void }) {
  const dispatch = useDispatch()
  const hero = run.heroes.find((h) => h.id === heroId)!
  const pools = derivedPools(hero)
  const thresholds = derivedThresholds(hero)
  const canReequip = run.phase === 'resting' || run.phase === 'awaitingReveal'

  return (
    <Sheet
      title={hero.name}
      eyebrow={`${raceById(hero.raceId).name} · ${classById(hero.classId).name}`}
      onClose={onClose}
    >
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            Vigor{' '}
            <LongPressNumber
              value={hero.vigor}
              label={`Vigor de ${hero.name}`}
              onChange={(to) =>
                dispatch({ type: 'OVERRIDE', path: `hero.${hero.id}.vigor`, from: hero.vigor, to })
              }
            />{' '}
            <Pips filled={hero.vigor} total={hero.maxVigor} />
          </span>
          <span>
            XP <Pips filled={hero.xp} total={2} />
          </span>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          {SUITS.map((s) => (
            <span key={s}>
              {SUIT_LABEL[s]}{' '}
              <LongPressNumber
                value={pools[s]}
                label={`${SUIT_LABEL[s]} de ${hero.name}`}
                onChange={(to) =>
                  dispatch({ type: 'OVERRIDE', path: `hero.${hero.id}.${s}`, from: hero.pools[s], to })
                }
              />{' '}
              <span className="note">{thresholds[s]}+</span>
            </span>
          ))}
        </div>

        <hr className="rule" />
        <div className="eyebrow">Equipamento</div>
        <div className="stack" style={{ gap: '0.35rem' }}>
          {EQUIP_SLOTS.map(([slot, label]) => {
            const item = (hero.equipment as Record<string, string | null>)[slot]
            return (
              <div key={slot} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="note">{label}</span>
                <span className="row" style={{ gap: '0.5rem' }}>
                  <span>{item ? lootById(item).name : '—'}</span>
                  {item && canReequip ? (
                    <button
                      type="button"
                      className="quiet"
                      style={{ minHeight: 40 }}
                      onClick={() => dispatch({ type: 'UNEQUIP', heroId, slot })}
                    >
                      Tirar
                    </button>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>

        {hero.consumables.length ? (
          <>
            <hr className="rule" />
            <div className="eyebrow">Na bolsa</div>
            {hero.consumables.map((id, i) => {
              const loot = lootById(id)
              const equippable = loot.lootType === 'equip' && loot.bodySlot
              return (
                <div key={`${id}-${i}`} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {loot.name} <span className="note">· {loot.effectText}</span>
                  </span>
                  {equippable && canReequip ? (
                    <button
                      type="button"
                      className="quiet"
                      style={{ minHeight: 40 }}
                      onClick={() =>
                        dispatch({
                          type: 'EQUIP',
                          heroId,
                          lootId: id,
                          slot: loot.bodySlot === 'mao' ? 'maoA' : loot.bodySlot!,
                        })
                      }
                    >
                      Equipar
                    </button>
                  ) : null}
                </div>
              )
            })}
          </>
        ) : null}

        {hero.specializations.length ? (
          <>
            <hr className="rule" />
            <div className="eyebrow">Especializações</div>
            {hero.specializations.map((id) => (
              <div key={id}>
                <strong>{specById(id).name}</strong> <span className="note">{specById(id).effectText}</span>
              </div>
            ))}
          </>
        ) : null}

        {hero.wounds.length ? (
          <>
            <hr className="rule" />
            <div className="eyebrow">Ferimentos · {hero.wounds.length}</div>
            {hero.wounds.map((id, i) => (
              <div key={`${id}-${i}`}>
                <strong>{afflictionById(id).name}</strong>{' '}
                <span className="note">{afflictionById(id).effectText}</span>
              </div>
            ))}
            {hero.wounds.length >= 3 ? (
              <p className="warn">
                {Math.floor(hero.wounds.length / 3)} × −1 dado em todos os pools.
              </p>
            ) : null}
          </>
        ) : null}

        {hero.scars.length ? (
          <>
            <hr className="rule" />
            <div className="eyebrow">Cicatrizes · nunca curam</div>
            {hero.scars.map((id, i) => (
              <div key={`${id}-${i}`}>
                <strong>{afflictionById(id).name}</strong>{' '}
                <span className="note">{afflictionById(id).effectText}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </Sheet>
  )
}

/**
 * Jogáveis por qualquer um — inclusive quem ficou de fora e quem está caído.
 * O painel precisa ser fácil de achar: se ninguém usa porque ninguém encontra,
 * o dado mede a interface, não a carta.
 */
export function ConsumiveisSheet({ run, onClose }: { run: Run; onClose: () => void }) {
  const dispatch = useDispatch()
  const forbidden = run.current
    ? cardById(run.current.cardId).effects.some((e) => e.kind === 'forbid' && e.what === 'consumable')
    : false
  const owners = run.heroes.filter((h) => h.consumables.length)

  return (
    <Sheet title="Consumíveis da mesa" eyebrow="Qualquer um joga, até quem está caído" onClose={onClose}>
      {forbidden ? <p className="warn">Consumíveis não funcionam nesta fase.</p> : null}
      {!owners.length ? <p className="note">Ninguém tem consumível na mão.</p> : null}
      <div className="stack">
        {owners.map((hero) => (
          <div key={hero.id} className="stack" style={{ gap: '0.4rem' }}>
            <div className="eyebrow">
              {hero.name} {hero.down ? '· caído' : ''}
            </div>
            {hero.consumables.map((id, i) => {
              const loot = lootById(id)
              return (
                <div key={`${id}-${i}`} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <strong>{loot.name}</strong> <span className="note">· {loot.effectText}</span>
                  </span>
                  <button
                    type="button"
                    disabled={forbidden || loot.lootType === 'equip'}
                    onClick={() => dispatch({ type: 'PLAY_CONSUMABLE', heroId: hero.id, consumableId: id })}
                  >
                    Jogar
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Sheet>
  )
}

const EVENT_LABEL: Record<string, string> = {
  run_started: 'Descida começou',
  card_revealed: 'Carta revelada',
  slot_toggled: 'Vaga',
  card_committed: 'Vagas confirmadas',
  entry_declared: 'Rolagem declarada',
  entry_corrected: 'Rolagem corrigida',
  consumable_played: 'Consumível jogado',
  card_resolved: 'Carta resolvida',
  damage_assigned: 'Dano distribuído',
  wound_drawn: 'Ferimento',
  scar_drawn: 'Cicatriz',
  loot_offered: 'Saque oferecido',
  loot_taken: 'Saque escolhido',
  xp_gained: 'XP',
  marco_spent: 'Marco gasto',
  rest_taken: 'Descanso',
  retreat_declared: 'Recuo',
  hero_downed: 'Herói caiu',
  hero_revived: 'Herói levantou',
  squire_retired: 'Escudeiro se retirou',
  boss_phase_started: 'Fase do chefe',
  furia_gained: 'Fúria',
  run_ended: 'Fim da descida',
  override: 'Ajuste manual',
  undo: 'Desfazer',
}

/** Resolve discussão de mesa sem interromper o estado. */
export function LogSheet({ run, onClose }: { run: Run; onClose: () => void }) {
  return (
    <Sheet title="Log da descida" eyebrow={`${run.events.length} eventos`} onClose={onClose}>
      <div className="stack" style={{ gap: '0.3rem' }}>
        {[...run.events].reverse().map((e) => (
          <div key={e.id} className="row" style={{ justifyContent: 'space-between', opacity: e.undone ? 0.45 : 1 }}>
            <span>
              {EVENT_LABEL[e.type] ?? e.type} {describe(run, e.type, e.payload)}
              {e.undone ? ' · desfeito' : ''}
            </span>
            <span className="note">{new Date(e.t).toLocaleTimeString('pt-BR')}</span>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function describe(run: Run, type: string, p: Record<string, unknown>): string {
  const card = typeof p.cardId === 'string' ? cardById(p.cardId).name : ''
  switch (type) {
    case 'card_revealed':
      return `· ${card}`
    case 'card_resolved':
      return `· ${card} · ${p.result} · ${p.declaredTotal} de ${p.effectiveTarget}`
    case 'entry_declared':
      return `· ${actorName(run, String(p.actorId))} declarou ${p.declared}`
    case 'slot_toggled':
      return `· ${actorName(run, String(p.heroId))} ${p.action === 'in' ? 'entrou' : 'saiu'}`
    case 'wound_drawn':
    case 'scar_drawn':
      return `· ${actorName(run, String(p.heroId))} · ${afflictionById(String(p.woundId ?? p.scarId)).name}`
    case 'loot_taken':
      return `· ${actorName(run, String(p.heroId))} ficou com ${lootById(String(p.chosen)).name}`
    case 'marco_spent':
      return `· ${actorName(run, String(p.heroId))} · ${p.choice}`
    case 'furia_gained':
      return `· ${p.total} de 3`
    case 'override':
      return `· ${p.path}: ${p.from} → ${p.to}`
    default:
      return ''
  }
}

/** A última página do manual, em tela. */
export function ReferenciaSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Referência rápida" eyebrow="A última página do manual" onClose={onClose}>
      <div className="option-grid">
        <div className="stack" style={{ gap: '0.2rem' }}>
          <div className="eyebrow">Dados</div>
          <div>Sucesso: 5 ou 6</div>
          <div>Crítico: 6</div>
          <div>Limiar inicial: 5+ · com Apuro: 4+</div>
          <div>Sem o naipe: 2 sucessos = 1</div>
          <div>Empate com o alvo: vitória</div>
        </div>
        <div className="stack" style={{ gap: '0.2rem' }}>
          <div className="eyebrow">Vagas</div>
          <div>Só quem entra rola</div>
          <div>Só quem entra saqueia</div>
          <div>Só quem entra marca XP</div>
          <div>Só quem entra se machuca</div>
          <div>Caído não ocupa vaga, mas joga cartas</div>
        </div>
        <div className="stack" style={{ gap: '0.2rem' }}>
          <div className="eyebrow">Resultado</div>
          <div>Vitória não machuca</div>
          <div>Falha: dano impresso, dividido</div>
          <div>Sobra: voluntário, ou quem tirou menos</div>
          <div>Dano acima do vigor vira Cicatriz</div>
          <div>A cada 3 Ferimentos: −1 dado em tudo</div>
        </div>
        <div className="stack" style={{ gap: '0.2rem' }}>
          <div className="eyebrow">Descanso</div>
          <div>Custa 1 carta do monte</div>
          <div>+2 de vigor a todos</div>
          <div>Um curador de Fé, nunca em si mesmo</div>
          <div>Quem curou rola 1 dado: 1 compra Cicatriz</div>
        </div>
      </div>
    </Sheet>
  )
}
