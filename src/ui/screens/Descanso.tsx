import { useState } from 'react'
import { afflictionById } from '../../content'
import { SUIT_LABEL } from '../../content/types'
import { derivedPools } from '../../engine/hero'
import type { Run } from '../../engine/state'
import { useDispatch } from '../../store'
import { restHealAmount } from '../../store/reducer'
import { Pips } from '../components/primitives'

/** Quatro passos em sequência, um por vez. O custo primeiro, o benefício depois. */
export function Descanso({ run }: { run: Run }) {
  const rest = run.rest!
  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Descanso · custou 1 carta do monte</div>
          <h1>Descanso</h1>
          <p className="flavor">Nunca é de graça e nunca é seguro.</p>
        </div>
        <div className="note">
          O monte tinha {rest.deckBefore}. Agora tem {run.deck.length}.
        </div>
        <hr className="rule" />
        {rest.step === 'heal' ? <PassoCura run={run} /> : null}
        {rest.step === 'healer' ? <PassoCurador run={run} /> : null}
        {rest.step === 'luck' ? <PassoAzar run={run} /> : null}
        {rest.step === 'done' ? <PassoFim run={run} /> : null}
      </div>
    </div>
  )
}

function PassoCura({ run }: { run: Run }) {
  const dispatch = useDispatch()
  return (
    <div className="stack">
      <h3>1 · Todos recuperam vigor</h3>
      <div className="stack" style={{ gap: '0.4rem' }}>
        {run.heroes.map((h) => {
          const amount = Math.min(restHealAmount(h), h.maxVigor - h.vigor)
          return (
            <div key={h.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                {h.name} {h.down ? '· caído, levanta' : ''}
              </span>
              <span className="note">
                <Pips filled={h.vigor} total={h.maxVigor} /> +{amount}
                {h.wounds.length ? ` · descarta ${Math.min(amount, h.wounds.length)} ferimento(s)` : ''}
              </span>
            </div>
          )
        })}
      </div>
      <button type="button" className="primary" onClick={() => dispatch({ type: 'REST_HEAL' })}>
        Aplicar
      </button>
    </div>
  )
}

function PassoCurador({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const [healerId, setHealerId] = useState<string | null>(null)
  const [successes, setSuccesses] = useState<number | null>(null)
  const [distribution, setDistribution] = useState<Record<string, number>>({})

  const candidates = run.heroes.filter((h) => {
    if (derivedPools(h).fe <= 0) return false
    const blocked = [...h.wounds, ...h.scars]
      .flatMap((id) => afflictionById(id).effects)
      .some((e) => e.kind === 'forbid' && e.what === 'healer')
    return !blocked
  })

  const healer = run.heroes.find((h) => h.id === healerId)
  const spent = Object.values(distribution).reduce((a, b) => a + b, 0)
  const left = (successes ?? 0) - spent

  return (
    <div className="stack">
      <h3>2 · Curador</h3>
      {!healerId ? (
        <>
          <p className="note">Um herói com dados de Fé se oferece. Só um por descanso.</p>
          <div className="option-grid">
            {candidates.map((h) => (
              <button key={h.id} type="button" className="option" onClick={() => setHealerId(h.id)}>
                <strong>{h.name}</strong>
                <span className="note">
                  {derivedPools(h).fe} dados de {SUIT_LABEL.fe}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quiet"
            onClick={() => dispatch({ type: 'REST_HEALER', healerId: null, successes: 0, distribution: [] })}
          >
            Ninguém cura desta vez
          </button>
        </>
      ) : successes === null ? (
        <>
          <p>
            {healer!.name} rola <strong>{derivedPools(healer!).fe}</strong> dados de Fé.
          </p>
          <div className="eyebrow">Quantos sucessos?</div>
          <div className="number-pad">
            {Array.from({ length: derivedPools(healer!).fe + 1 }, (_, i) => i).map((n) => (
              <button key={n} type="button" onClick={() => setSuccesses(n)}>
                {n}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="note">
            Cada sucesso devolve 1 de vigor a quem {healer!.name} escolher — nunca a si mesmo.
            Restam <span className="num">{left}</span>.
          </p>
          <div className="stack" style={{ gap: '0.4rem' }}>
            {run.heroes
              .filter((h) => h.id !== healerId)
              .map((h) => (
                <div key={h.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {h.name} <Pips filled={h.vigor} total={h.maxVigor} />
                  </span>
                  <span className="row" style={{ gap: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={!distribution[h.id]}
                      onClick={() => setDistribution((d) => ({ ...d, [h.id]: (d[h.id] ?? 0) - 1 }))}
                    >
                      −
                    </button>
                    <span className="num" style={{ minWidth: '2ch', textAlign: 'center' }}>
                      {distribution[h.id] ?? 0}
                    </span>
                    <button
                      type="button"
                      disabled={left <= 0}
                      onClick={() => setDistribution((d) => ({ ...d, [h.id]: (d[h.id] ?? 0) + 1 }))}
                    >
                      +
                    </button>
                  </span>
                </div>
              ))}
          </div>
          <button
            type="button"
            className="primary"
            onClick={() =>
              dispatch({
                type: 'REST_HEALER',
                healerId,
                successes,
                distribution: Object.entries(distribution)
                  .filter(([, v]) => v > 0)
                  .map(([heroId, points]) => ({ heroId, points })),
              })
            }
          >
            Confirmar cura
          </button>
        </>
      )}
    </div>
  )
}

/** O dado de azar: uma rolagem por herói curado, não por ponto. */
function PassoAzar({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const rest = run.rest!
  const [rolls, setRolls] = useState<Record<string, boolean | null>>(
    Object.fromEntries(rest.healed.map((id) => [id, null])),
  )
  const pending = rest.healed.some((id) => rolls[id] === null)

  if (!rest.healed.length) {
    return (
      <div className="stack">
        <h3>3 · O dado de azar</h3>
        <p className="note">Ninguém recuperou vigor. Ninguém rola.</p>
        <button type="button" className="primary" onClick={() => dispatch({ type: 'REST_LUCK', rolls: [] })}>
          Seguir
        </button>
      </div>
    )
  }

  return (
    <div className="stack">
      <h3>3 · O dado de azar</h3>
      <p className="note">Quem recuperou vigor rola 1 dado. Quem tirar 1 compra uma Cicatriz.</p>
      <div className="stack" style={{ gap: '0.5rem' }}>
        {rest.healed.map((id) => {
          const hero = run.heroes.find((h) => h.id === id)!
          return (
            <div key={id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{hero.name} · tirou 1?</span>
              <span className="row" style={{ gap: '0.5rem' }}>
                <button
                  type="button"
                  className={rolls[id] === false ? 'primary' : ''}
                  onClick={() => setRolls((r) => ({ ...r, [id]: false }))}
                >
                  Não
                </button>
                <button
                  type="button"
                  className={rolls[id] === true ? 'danger' : ''}
                  onClick={() => setRolls((r) => ({ ...r, [id]: true }))}
                >
                  Sim
                </button>
              </span>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="primary"
        disabled={pending}
        onClick={() =>
          dispatch({
            type: 'REST_LUCK',
            rolls: rest.healed.map((heroId) => ({ heroId, rolledOne: rolls[heroId] === true })),
          })
        }
      >
        Confirmar
      </button>
    </div>
  )
}

function PassoFim({ run }: { run: Run }) {
  const dispatch = useDispatch()
  const newScars = run.rest!.scarRolls.filter((r) => r.rolledOne)
  return (
    <div className="stack">
      <h3>4 · Reequipar e seguir</h3>
      <p className="note">
        É o único momento em que dá para mexer em equipamento — abra a ficha de cada herói na Mesa.
      </p>
      {newScars.length ? (
        <p className="warn">
          {newScars.length} Cicatriz{newScars.length > 1 ? 'es' : ''} comprada{newScars.length > 1 ? 's' : ''} no
          descanso. Ficam na ficha.
        </p>
      ) : null}
      <button type="button" className="primary" onClick={() => dispatch({ type: 'REST_DONE' })}>
        Voltar à descida
      </button>
    </div>
  )
}
