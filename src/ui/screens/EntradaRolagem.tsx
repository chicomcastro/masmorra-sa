import { useState } from 'react'
import { cardById } from '../../content'
import { SUIT_LABEL } from '../../content/types'
import type { Run } from '../../engine/state'
import { rollSpecFor } from '../../engine/resolve'
import { useDispatch } from '../../store'
import { actorName, targetContextFor } from '../../store/reducer'

/**
 * Um participante por vez declara seu total de sucessos. A tela mais usada do
 * app: um toque em cartas sem efeito de crítico.
 */
export function EntradaRolagem({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const current = run.current!
  const card = cardById(current.cardId)
  const order = current.slots.filter((s): s is string => !!s)
  const done = new Set(current.entries.map((e) => e.actorId))
  const actorId = order.find((id) => !done.has(id))
  const [pendingTotal, setPendingTotal] = useState<number | null>(null)

  if (!actorId) return null

  const spec = rollSpecFor(actorId, targetContextFor(run, card, current.slots))
  if (!spec) return null

  const index = order.indexOf(actorId) + 1
  const accumulated = current.entries.reduce((n, e) => n + e.countedSuccesses, 0)
  const nextActor = order.find((id) => id !== actorId && !done.has(id))
  const options = Array.from({ length: spec.poolSize + 1 }, (_, i) => i)

  const submit = (declared: number, crits: number | null) => {
    dispatch({ type: 'DECLARE_ENTRY', actorId, declared, crits })
    setPendingTotal(null)
  }

  return (
    <>
      <div className="scrim" />
      <div className="sheet stack">
        <div className="sheet-head">
          <div>
            <div className="eyebrow">
              {card.name} · participante {index} de {order.length}
            </div>
            <h3>{actorName(run, actorId)}</h3>
          </div>
          {current.entries.length ? (
            <button
              type="button"
              className="quiet"
              onClick={() =>
                dispatch({ type: 'CORRECT_ENTRY', actorId: current.entries.at(-1)!.actorId })
              }
            >
              Corrigir anterior
            </button>
          ) : null}
        </div>

        <p style={{ margin: 0 }}>
          role <strong>{spec.poolSize}</strong> dados de <strong>{SUIT_LABEL[spec.suit]}</strong> · sucesso
          em <strong>{spec.threshold}+</strong>
        </p>
        {spec.offSuit ? (
          <p className="warn" style={{ margin: 0 }}>
            {spec.policy === 'none'
              ? 'Sucessos de naipe errado não contam nesta carta.'
              : spec.policy === 'full'
                ? 'Seus sucessos de naipe errado valem cheios.'
                : 'Naipe errado: 2 sucessos contam como 1, arredondando para baixo.'}
          </p>
        ) : null}

        {pendingTotal === null ? (
          <>
            <div className="eyebrow">Quantos sucessos?</div>
            <div className="number-pad">
              {options.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => (card.needsCritInput ? setPendingTotal(n) : submit(n, null))}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="eyebrow">Saiu algum 6?</div>
            <div className="number-pad">
              {Array.from({ length: pendingTotal + 1 }, (_, i) => i).map((n) => (
                <button key={n} type="button" onClick={() => submit(pendingTotal, n)}>
                  {n}
                </button>
              ))}
            </div>
            <button type="button" className="quiet" onClick={() => setPendingTotal(null)}>
              Voltar ao total
            </button>
          </>
        )}

        <hr className="rule" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="note">
            acumulado da mesa: <span className="num">{accumulated}</span> de{' '}
            <span className="num">{current.effectiveTarget}</span>
          </span>
          {nextActor ? <span className="note">Próximo: {actorName(run, nextActor)}</span> : null}
        </div>
      </div>
    </>
  )
}
