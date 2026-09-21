import { useMemo, useState } from 'react'
import { cardById, content } from '../../content'
import { SUIT_LABEL } from '../../content/types'
import { cardSuits, slotsOf } from '../../engine/card'
import type { Run } from '../../engine/state'
import { useDispatch } from '../../store'
import { actorName, eligibleActors, retreatCost, tableSize } from '../../store/reducer'
import { CardFace } from '../components/CardFace'
import { HeroTile, SquireTile } from '../components/HeroTile'
import { TwoTapButton } from '../components/primitives'
import { Consequencias } from './Consequencias'
import { Descanso } from './Descanso'
import { EntradaRolagem } from './EntradaRolagem'
import { FichaSheet, LogSheet, ConsumiveisSheet, ReferenciaSheet } from './Sheets'
import { Marco } from './Marco'

type Overlay = { kind: 'ficha'; heroId: string } | { kind: 'log' } | { kind: 'consumiveis' } | { kind: 'regras' } | null

export function Mesa({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const [overlay, setOverlay] = useState<Overlay>(null)

  const card = run.current ? cardById(run.current.cardId) : null
  const isBoss = card?.kind === 'boss'
  const size = tableSize(run)
  const eligible = useMemo(() => (card ? eligibleActors(run, card) : []), [run, card])
  const slots = run.current?.slots ?? []
  const filled = slots.filter(Boolean).length

  const pendingMarco = run.heroes.find((h) => h.pendingMarcos > 0)
  const deckTotal = run.mode === 'duo' ? 17 : 18
  const spent = deckTotal - run.deck.length

  const floorLabel = card
    ? card.kind === 'boss'
      ? `${card.name} · Fase ${['I', 'II', 'III'][card.phase - 1]}`
      : `Andar ${['I', 'II', 'III'][card.floor - 1]} · carta ${run.resolved.length + 1}`
    : `Carta ${run.resolved.length + 1}`

  // O Marco bloqueia o avanço: é regra do manual e evita XP esquecido.
  if (pendingMarco) return <Marco hero={pendingMarco} />
  if (run.phase === 'resting') return <Descanso run={run} />

  return (
    <div className={`mesa${isBoss ? ' boss-mode' : ''}`}>
      <div className="mesa-top">
        <span>{floorLabel}</span>
        <div className="deck-bar" aria-label={`${run.deck.length} no monte`}>
          {Array.from({ length: deckTotal }, (_, i) => (
            <span key={i} className={`${i < spent ? 'spent' : ''} ${i >= deckTotal - 3 ? 'boss' : ''}`} />
          ))}
        </div>
        <span>{run.deck.length} no monte</span>
        {run.mode === 'duo' ? (
          <span className="row" style={{ gap: '0.4rem' }}>
            Fúria
            <span className="furia-track">
              {[0, 1, 2].map((i) => (
                <i key={i} className={i < run.furias ? 'on' : ''} />
              ))}
            </span>
          </span>
        ) : null}
        <span className="spacer" style={{ flex: 1 }} />
        <button type="button" className="quiet" style={{ minHeight: 40 }} onClick={() => setOverlay({ kind: 'log' })}>
          Log
        </button>
        <button type="button" className="quiet" style={{ minHeight: 40 }} onClick={() => setOverlay({ kind: 'regras' })}>
          Regras
        </button>
      </div>

      <div className="mesa-middle">
        {run.phase === 'awaitingReveal' ? <MonteFechado run={run} /> : null}

        {card && run.phase !== 'awaitingReveal' ? (
          <CardFace
            card={card}
            tableSize={size}
            showTarget={
              run.phase === 'resolving' || run.phase === 'consequences'
                ? run.current!.effectiveTarget
                : undefined
            }
          />
        ) : null}

        {(run.phase === 'deciding' || run.phase === 'bossPhase') && card ? (
          <>
            <div className="eyebrow">Quem entra</div>
            <div className="slots">
              {slots.map((actorId, i) => (
                <div key={i} className={`slot${actorId ? ' filled' : ''}`}>
                  {actorId ? actorName(run, actorId) : 'vaga livre'}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {run.phase === 'resolving' ? <Veredito run={run} /> : null}
        {run.phase === 'consequences' ? <Consequencias run={run} /> : null}

        {run.phase !== 'consequences' ? (
          <div className="hero-row">
            {run.heroes.map((hero) => (
              <HeroTile
                key={hero.id}
                hero={hero}
                card={card}
                tableSize={size}
                inSlot={slots.includes(hero.id)}
                eligible={eligible.includes(hero.id)}
                onTap={() =>
                  (run.phase === 'deciding' || run.phase === 'bossPhase') &&
                  dispatch({ type: 'TOGGLE_SLOT', actorId: hero.id })
                }
                onOpenSheet={() => setOverlay({ kind: 'ficha', heroId: hero.id })}
              />
            ))}
            {run.squires.map((squire) => (
              <SquireTile
                key={squire.id}
                squire={squire}
                inSlot={slots.includes(squire.id)}
                onTap={() =>
                  (run.phase === 'deciding' || run.phase === 'bossPhase') &&
                  dispatch({ type: 'TOGGLE_SLOT', actorId: squire.id })
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mesa-bottom">
        <button
          type="button"
          className="quiet"
          disabled={run.phase === 'consequences'}
          onClick={() => dispatch({ type: 'UNDO' })}
        >
          Desfazer
        </button>

        {run.phase === 'entering' || run.phase === 'resolving' ? (
          <button type="button" className="quiet" onClick={() => setOverlay({ kind: 'consumiveis' })}>
            Consumível
          </button>
        ) : null}

        <span className="spacer" />

        {run.phase === 'awaitingReveal' ? (
          <>
            <TwoTapButton
              className="danger"
              confirmLabel="Tocar de novo abandona a descida"
              onConfirm={() => dispatch({ type: 'ABANDON' })}
            >
              Abandonar descida
            </TwoTapButton>
            <button
              type="button"
              className="quiet"
              disabled={run.deck.length < 1}
              title={run.deck.length < 1 ? 'Descansar custa 1 carta, e o monte está vazio' : undefined}
              onClick={() => dispatch({ type: 'START_REST' })}
            >
              Descansar · custa 1 carta
            </button>
            <button type="button" className="primary" onClick={() => dispatch({ type: 'REVEAL_CARD' })}>
              Revelar
            </button>
          </>
        ) : null}

        {run.phase === 'deciding' ? (
          <>
            <TwoTapButton
              className="quiet"
              disabled={run.deck.length < retreatCost(run) - 1}
              confirmLabel={`Tocar de novo recua · ${retreatCost(run)} cartas do monte`}
              onConfirm={() => dispatch({ type: 'RETREAT' })}
            >
              Recuar · custa {retreatCost(run)} carta{retreatCost(run) > 1 ? 's' : ''} do monte
            </TwoTapButton>
            <button
              type="button"
              className="primary"
              disabled={filled === 0}
              onClick={() => dispatch({ type: 'COMMIT_SLOTS' })}
            >
              Confirmar vagas e rolar
            </button>
          </>
        ) : null}

        {run.phase === 'bossPhase' ? (
          <button
            type="button"
            className="primary"
            disabled={filled === 0}
            onClick={() => dispatch({ type: 'COMMIT_SLOTS' })}
          >
            Confirmar vagas e rolar
          </button>
        ) : null}

        {run.phase === 'resolving' ? (
          <button type="button" className="primary" onClick={() => dispatch({ type: 'CONFIRM_VERDICT' })}>
            Confirmar veredito
          </button>
        ) : null}
      </div>

      {run.phase === 'entering' && card ? <EntradaRolagem run={run} /> : null}

      {overlay?.kind === 'ficha' ? (
        <FichaSheet run={run} heroId={overlay.heroId} onClose={() => setOverlay(null)} />
      ) : null}
      {overlay?.kind === 'log' ? <LogSheet run={run} onClose={() => setOverlay(null)} /> : null}
      {overlay?.kind === 'regras' ? <ReferenciaSheet onClose={() => setOverlay(null)} /> : null}
      {overlay?.kind === 'consumiveis' ? (
        <ConsumiveisSheet run={run} onClose={() => setOverlay(null)} />
      ) : null}
    </div>
  )
}

function MonteFechado({ run }: { run: Run }) {
  const left = run.deck.length
  const bossNext = run.deck.length > 0 && cardById(run.deck[0]).kind === 'boss'

  let line: string
  if (left === 0) line = 'O monte acabou.'
  else if (bossNext) line = 'A próxima carta é o chefe.'
  else if (left <= 4) line = `${left} cartas. O chefe está logo abaixo.`
  else line = `${left} cartas até o fundo.`

  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: '2.5rem 1rem' }}>
      <div className="eyebrow">O monte é o relógio</div>
      <div className="num" style={{ fontSize: '5rem', lineHeight: 1 }}>
        {left}
      </div>
      <p style={{ margin: 0 }}>{line}</p>
      {run.resolved.length ? (
        <p className="note" style={{ margin: 0 }}>
          {run.resolved.filter((r) => r.result === 'vitoria').length} vencidas ·{' '}
          {run.resolved.filter((r) => r.result === 'falha').length} falhadas ·{' '}
          {run.resolved.filter((r) => r.result === 'recuo').length} recuos
        </p>
      ) : null}
    </div>
  )
}

/** O alvo efetivo já pode aparecer: a decisão passou, revelar não contamina nada. */
function Veredito({ run }: { run: Run }) {
  const current = run.current!
  const total = current.entries.reduce((n, e) => n + e.countedSuccesses, 0)
  const win = total >= current.effectiveTarget

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow">Declarado</div>
          <div className="num" style={{ fontSize: '3.5rem', lineHeight: 1 }}>
            {total}
          </div>
        </div>
        <div className="num" style={{ fontSize: '2rem', color: 'var(--ink-500)' }}>
          ×
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow">Alvo</div>
          <div className="num" style={{ fontSize: '3.5rem', lineHeight: 1 }}>
            {current.effectiveTarget}
          </div>
        </div>
      </div>
      <h3 style={{ textAlign: 'center' }}>{win ? 'Vitória' : 'Falha'}</h3>
      {current.targetModifiers.length ? (
        <div className="note">
          Alvo impresso {current.baseTarget}
          {current.targetModifiers.map((m, i) => (
            <span key={i}>
              {' '}
              · {m.source} {m.delta > 0 ? '+' : ''}
              {m.delta}
            </span>
          ))}
        </div>
      ) : null}
      <hr className="rule" />
      <div className="stack" style={{ gap: '0.4rem' }}>
        {current.entries.map((e) => (
          <div key={e.actorId} className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              {actorName(run, e.actorId)} · {SUIT_LABEL[e.suit]} {e.offSuit ? '(naipe errado)' : ''}
            </span>
            <span className="num">
              {e.declaredSuccesses}
              {e.offSuit ? ` → ${e.countedSuccesses}` : ''}
            </span>
          </div>
        ))}
      </div>
      <p className="note">Ainda dá para jogar consumível antes de confirmar.</p>
    </div>
  )
}

export function cardSuitLabel(cardId: string): string {
  const card = cardById(cardId)
  if (card.suit === null) return 'qualquer naipe'
  return cardSuits(card).map((s) => SUIT_LABEL[s]).join(' ou ')
}

export function totalSlots(run: Run): number {
  const card = run.current ? cardById(run.current.cardId) : null
  return card ? slotsOf(card, tableSize(run)) : 0
}

export const referenceCards = content
