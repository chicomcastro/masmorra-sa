import { useState } from 'react'
import { classById, content, specById } from '../../content'
import { SUITS, SUIT_LABEL } from '../../content/types'
import { derivedPools, derivedThresholds } from '../../engine/hero'
import type { Hero } from '../../engine/state'
import { useDispatch } from '../../store'

/**
 * Abre assim que alguém fecha 2 XP e bloqueia o avanço até ser gasto — é regra
 * do manual e evita XP esquecido, que arruinaria os dados de progressão.
 */
export function Marco({ hero }: { hero: Hero }) {
  const dispatch = useDispatch()
  const [choice, setChoice] = useState<'amplitude' | 'apuro' | 'arte' | null>(null)
  const pools = derivedPools(hero)
  const thresholds = derivedThresholds(hero)
  const klass = classById(hero.classId)
  const available = klass.specializations.filter((id) => !hero.specializations.includes(id))

  const spend = (detail: string) =>
    dispatch({ type: 'SPEND_MARCO', heroId: hero.id, choice: choice!, detail })

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Marco · gasta na hora</div>
          <h1>{hero.name} fechou 2 XP</h1>
          <p className="flavor">{klass.name}. Escolham o que ela vira.</p>
        </div>
        <hr className="rule" />

        {!choice ? (
          <div className="option-grid">
            <button type="button" className="option" onClick={() => setChoice('amplitude')}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>Amplitude</strong>
              <span>+1 dado num naipe à sua escolha.</span>
            </button>
            <button
              type="button"
              className="option"
              onClick={() => setChoice('apuro')}
              disabled={SUITS.every((s) => thresholds[s] === 4)}
            >
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>Apuro</strong>
              <span>O limiar de um naipe passa de 5+ para 4+. É o Marco mais forte do jogo.</span>
            </button>
            <button type="button" className="option" onClick={() => setChoice('arte')} disabled={!available.length}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>Arte</strong>
              <span>Abre 1 das 3 Especializações da classe.</span>
            </button>
          </div>
        ) : choice === 'arte' ? (
          <div className="stack">
            <div className="eyebrow">Especializações de {klass.name}</div>
            <div className="option-grid">
              {available.map((id) => {
                const spec = specById(id)
                return (
                  <button key={id} type="button" className="option" onClick={() => spend(id)}>
                    <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>{spec.name}</strong>
                    <span className="flavor">{spec.flavor}</span>
                    <span>{spec.effectText}</span>
                  </button>
                )
              })}
            </div>
            <button type="button" className="quiet" onClick={() => setChoice(null)}>
              Voltar
            </button>
          </div>
        ) : (
          <div className="stack">
            <div className="eyebrow">{choice === 'amplitude' ? 'Qual naipe ganha o dado?' : 'Qual naipe passa a 4+?'}</div>
            <div className="option-grid">
              {SUITS.map((suit) => (
                <button
                  key={suit}
                  type="button"
                  className="option"
                  disabled={choice === 'apuro' && thresholds[suit] === 4}
                  onClick={() => spend(suit)}
                >
                  <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>
                    {SUIT_LABEL[suit]}
                  </strong>
                  <span className="note">
                    {choice === 'amplitude'
                      ? `${pools[suit]} → ${pools[suit] + 1} dados · ${thresholds[suit]}+`
                      : thresholds[suit] === 4
                        ? 'já está em 4+'
                        : `${pools[suit]} dados · 5+ → 4+`}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className="quiet" onClick={() => setChoice(null)}>
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export const allSpecs = content.specializations
