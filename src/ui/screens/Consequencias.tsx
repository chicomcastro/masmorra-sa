import { useState } from 'react'
import { afflictionById, cardById, lootById } from '../../content'
import type { Run } from '../../engine/state'
import { lootOrder } from '../../engine/resolve'
import { useDispatch } from '../../store'
import { actorName } from '../../store/reducer'

export function Consequencias({ run }: { run: Run }) {
  const current = run.current!
  return current.result === 'vitoria' ? <Vitoria run={run} /> : <Falha run={run} />
}

/** Vitória não machuca: 2 espólios sorteados, fica com 1, na ordem dos sucessos. */
function Vitoria({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const current = run.current!
  const order = lootOrder(current.entries, run.heroes)
  const pending = order.find((id) => current.lootOffers.some((o) => o.heroId === id && !o.chosen))
  const offer = current.lootOffers.find((o) => o.heroId === pending)

  return (
    <div className="stack">
      <h3>Vitória. Ninguém se machuca.</h3>
      <p className="note">
        Cada participante marcou 1 XP. Escolhe primeiro quem declarou mais sucessos.
      </p>

      {offer ? (
        <div className="stack">
          <div className="eyebrow">{actorName(run, offer.heroId)} escolhe</div>
          <div className="option-grid">
            {offer.offered.map((id) => (
              <LootOption key={id} run={run} heroId={offer.heroId} lootId={id} />
            ))}
          </div>
        </div>
      ) : (
        <p>Saque resolvido.</p>
      )}

      <div className="stack" style={{ gap: '0.35rem' }}>
        {current.lootOffers
          .filter((o) => o.chosen)
          .map((o) => (
            <div key={o.heroId} className="note">
              {actorName(run, o.heroId)} ficou com {lootById(o.chosen!).name}
            </div>
          ))}
      </div>

      <div className="row">
        <button type="button" className="primary" disabled={!!offer} onClick={() => dispatch({ type: 'ADVANCE' })}>
          Seguir a descida
        </button>
      </div>
    </div>
  )
}

function LootOption({ run, heroId, lootId }: { run: Run; heroId: string; lootId: string }) {
  const dispatch = useDispatch()
  const [slotChoice, setSlotChoice] = useState(false)
  const loot = lootById(lootId)
  const hero = run.heroes.find((h) => h.id === heroId)!

  const slotsFor = (): string[] => {
    if (loot.bodySlot === 'mao') return ['maoA', 'maoB']
    return loot.bodySlot ? [loot.bodySlot] : []
  }
  const slots = slotsFor()

  const take = (slot: string | null) => dispatch({ type: 'TAKE_LOOT', heroId, chosen: lootId, equippedTo: slot })

  return (
    <div className="option" style={{ border: '1px solid var(--divider)', borderRadius: 'var(--radius)' }}>
      <div className="eyebrow">
        {loot.category} · {loot.bodySlot ?? 'sem slot'}
      </div>
      <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>{loot.name}</strong>
      <span className="flavor">{loot.flavor}</span>
      <span>{loot.effectText}</span>
      {loot.drawbackText ? <span className="warn">{loot.drawbackText}</span> : null}

      {!slotChoice ? (
        <button
          type="button"
          className="primary"
          onClick={() => (slots.length > 1 ? setSlotChoice(true) : take(slots[0] ?? null))}
          style={{ marginTop: '0.5rem' }}
        >
          Ficar com esta
        </button>
      ) : (
        <div className="stack" style={{ gap: '0.4rem', marginTop: '0.5rem' }}>
          <span className="note">Em qual mão?</span>
          {slots.map((slot) => {
            const occupied = (hero.equipment as Record<string, string | null>)[slot]
            return (
              <button key={slot} type="button" onClick={() => take(slot)}>
                {slot === 'maoA' ? 'Mão A' : 'Mão B'}
                {occupied ? ` · sai ${lootById(occupied).name}` : ' · livre'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * O dano aparece como fichas a distribuir. O app pré-divide e deixa a sobra num
 * pote que alguém precisa tocar para assumir — nunca aplica sozinho.
 */
function Falha({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const current = run.current!
  const card = cardById(current.cardId)
  const [assignment, setAssignment] = useState(current.damageAssignment)
  const [remainder, setRemainder] = useState(current.damageRemainder)
  const applied = current.damageDecidedAt !== null

  const bump = (heroId: string, delta: number) => {
    if (delta > 0 && remainder <= 0) return
    setAssignment((prev) =>
      prev.map((a) => (a.heroId === heroId ? { ...a, points: Math.max(0, a.points + delta) } : a)),
    )
    setRemainder((r) => r - delta)
  }

  const lowest = [...current.entries].sort((a, b) => a.countedSuccesses - b.countedSuccesses)[0]

  return (
    <div className="stack">
      <h3>Falha. {card.damage} de dano a distribuir.</h3>

      {applied ? (
        <p className="note">Dano aplicado.</p>
      ) : (
        <>
          <div className="stack" style={{ gap: '0.5rem' }}>
            {assignment.map((a) => {
              const hero = run.heroes.find((h) => h.id === a.heroId)!
              const excess = Math.max(0, a.points - hero.vigor)
              return (
                <div key={a.heroId} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {hero.name}
                    {excess > 0 ? <span className="warn"> · {excess} viraria Cicatriz</span> : null}
                  </span>
                  <span className="row" style={{ gap: '0.5rem' }}>
                    <button type="button" onClick={() => bump(a.heroId, -1)} disabled={a.points === 0}>
                      −
                    </button>
                    <span className="num" style={{ minWidth: '2ch', textAlign: 'center' }}>
                      {a.points}
                    </span>
                    <button type="button" onClick={() => bump(a.heroId, 1)} disabled={remainder <= 0}>
                      +
                    </button>
                  </span>
                </div>
              )
            })}
          </div>

          {remainder > 0 ? (
            <div className="card stack" style={{ gap: '0.5rem' }}>
              <div className="eyebrow">Pote central</div>
              <p style={{ margin: 0 }}>
                <span className="num">{remainder}</span> ponto{remainder > 1 ? 's' : ''} sem dono. Alguém
                assume.
              </p>
              {lowest ? (
                <button type="button" className="quiet" onClick={() => bump(lowest.actorId, remainder)}>
                  Regra padrão · {actorName(run, lowest.actorId)} declarou menos sucessos
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={remainder > 0}
              onClick={() => dispatch({ type: 'ASSIGN_DAMAGE', assignment })}
            >
              Confirmar distribuição
            </button>
          </div>
        </>
      )}

      {applied ? (
        <div className="stack" style={{ gap: '0.35rem' }}>
          {run.heroes.map((hero) =>
            hero.wounds.length || hero.scars.length ? (
              <div key={hero.id} className="note">
                {hero.name}: {hero.wounds.map((w) => afflictionById(w).name).join(', ') || 'sem ferimentos'}
                {hero.scars.length ? ` · cicatrizes: ${hero.scars.map((s) => afflictionById(s).name).join(', ')}` : ''}
              </div>
            ) : null,
          )}
          <div className="row">
            <button type="button" className="primary" onClick={() => dispatch({ type: 'ADVANCE' })}>
              Seguir a descida
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
