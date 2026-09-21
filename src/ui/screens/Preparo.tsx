import { useState } from 'react'
import { afflictionById, classById, content, raceById, squireById } from '../../content'
import { SUITS, SUIT_LABEL } from '../../content/types'
import type { Suit } from '../../content/types'
import { startingPools } from '../../engine/hero'
import { useAppState, useDispatch } from '../../store'
import type { HeroSetup } from '../../store/actions'
import { suggestedSquires } from '../../store/reducer'

const EMPTY: HeroSetup = {
  name: '',
  profileId: null,
  raceId: 'race-humano-generico',
  classId: 'class-barbaro',
  freeSuits: ['forca'],
}

function freeSuitsNeeded(setup: HeroSetup): number {
  const race = raceById(setup.raceId).poolGrants
  const klass = classById(setup.classId).poolGrants
  return (race.livre ? 1 : 0) + (klass.escolha2 ? 2 : 0)
}

export function Preparo({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [mode, setMode] = useState<'base' | 'duo'>('duo')
  const [heroes, setHeroes] = useState<HeroSetup[]>([{ ...EMPTY }, { ...EMPTY }])
  const [squires, setSquires] = useState<string[] | null>(null)

  const setCount = (n: number) => {
    setHeroes((prev) => {
      const next = [...prev]
      while (next.length < n) next.push({ ...EMPTY })
      return next.slice(0, n)
    })
    setSquires(null)
  }

  const update = (i: number, patch: Partial<HeroSetup>) => {
    setHeroes((prev) => prev.map((h, j) => (j === i ? { ...h, ...patch } : h)))
    setSquires(null)
  }

  const ready =
    heroes.every((h) => h.name.trim() && h.freeSuits.length === freeSuitsNeeded(h)) &&
    (mode === 'base' ? heroes.length >= 3 && heroes.length <= 5 : heroes.length === 2)

  const suggested = squires ?? (mode === 'duo' ? suggestedSquires(heroes) : [])

  const start = () =>
    dispatch({
      type: 'START_RUN',
      mode,
      heroes: heroes.map((h) => ({ ...h, name: h.name.trim() })),
      squireIds: mode === 'duo' ? suggested : [],
    })

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Preparo da mesa</div>
          <h1>Quem desce</h1>
        </div>
        <hr className="rule" />

        <div className="stack" style={{ gap: '0.5rem' }}>
          <div className="eyebrow">Modo</div>
          <div className="row">
            <button
              type="button"
              className={mode === 'duo' ? 'primary' : 'quiet'}
              onClick={() => {
                setMode('duo')
                setCount(2)
              }}
            >
              Duo · 2 jogadores
            </button>
            <button
              type="button"
              className={mode === 'base' ? 'primary' : 'quiet'}
              onClick={() => {
                setMode('base')
                setCount(Math.max(3, heroes.length))
              }}
            >
              Base · 3 a 5
            </button>
          </div>
          {mode === 'base' ? (
            <div className="row">
              {[3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={heroes.length === n ? 'primary' : 'quiet'}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <p className="note">
              Sem cartas de 3 vagas. Monte de 17, obstáculo de 2 vagas vale alvo −1, recuar custa 1 carta,
              e o chefe conta Fúrias.
            </p>
          )}
        </div>

        {heroes.map((hero, i) => (
          <HeroSetupCard
            key={i}
            index={i}
            hero={hero}
            profiles={state.profiles}
            onChange={(patch) => update(i, patch)}
          />
        ))}

        {mode === 'duo' ? (
          <div className="card stack">
            <div className="eyebrow">Escudeiros</div>
            {suggested.length ? (
              <>
                <p style={{ margin: 0 }}>
                  A dupla não cobre {suggested.map((id) => SUIT_LABEL[squireById(id).suit]).join(' e ')}.
                </p>
                <div className="option-grid">
                  {content.squires.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`option${suggested.includes(s.id) ? ' on' : ''}`}
                      onClick={() =>
                        setSquires(
                          suggested.includes(s.id)
                            ? suggested.filter((x) => x !== s.id)
                            : [...suggested, s.id],
                        )
                      }
                    >
                      <strong>{s.name}</strong>
                      <span className="note">
                        {s.pool} dados de {SUIT_LABEL[s.suit]} · 5+
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="note">A dupla cobre os quatro naipes. Nenhum Escudeiro é necessário.</p>
            )}
          </div>
        ) : null}

        <div className="row">
          <button type="button" className="quiet" onClick={onBack}>
            Voltar
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="primary"
            disabled={!ready}
            onClick={() => {
              start()
              onDone()
            }}
          >
            Começar a descida
          </button>
        </div>
      </div>
    </div>
  )
}

function HeroSetupCard({
  index,
  hero,
  profiles,
  onChange,
}: {
  index: number
  hero: HeroSetup
  profiles: { id: string; name: string; scars: string[] }[]
  onChange: (patch: Partial<HeroSetup>) => void
}) {
  const race = raceById(hero.raceId)
  const klass = classById(hero.classId)
  const needed = freeSuitsNeeded(hero)
  const pools = startingPools(hero.raceId, hero.classId, hero.freeSuits)
  const profile = profiles.find((p) => p.id === hero.profileId)

  const toggleFree = (suit: Suit) => {
    const has = hero.freeSuits.includes(suit)
    if (has) onChange({ freeSuits: hero.freeSuits.filter((s) => s !== suit) })
    else if (hero.freeSuits.length < needed) onChange({ freeSuits: [...hero.freeSuits, suit] })
    else onChange({ freeSuits: [...hero.freeSuits.slice(1), suit] })
  }

  return (
    <div className="card stack">
      <div className="eyebrow">Jogador {index + 1}</div>
      <input
        value={hero.name}
        placeholder="Nome do herói"
        onChange={(e) => onChange({ name: e.target.value })}
        style={{
          font: 'inherit',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.5rem',
          padding: '0.5rem',
          border: '1px solid var(--divider)',
          borderRadius: 'var(--radius)',
          background: 'transparent',
          minHeight: '56px',
        }}
      />

      {profiles.length ? (
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          <span className="note">Perfil:</span>
          <button
            type="button"
            className={`chip${hero.profileId === null ? ' on' : ''}`}
            onClick={() => onChange({ profileId: null })}
          >
            avulso
          </button>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip${hero.profileId === p.id ? ' on' : ''}`}
              onClick={() => onChange({ profileId: p.id, name: hero.name || p.name })}
            >
              {p.name}
              {p.scars.length ? ` · ${p.scars.length} cicatriz` : ''}
            </button>
          ))}
        </div>
      ) : null}

      {profile?.scars.length ? (
        <p className="warn" style={{ margin: 0 }}>
          Herda: {profile.scars.map((s) => afflictionById(s).name).join(', ')}
        </p>
      ) : null}

      <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
        {content.races.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`chip${hero.raceId === r.id ? ' on' : ''}`}
            onClick={() => onChange({ raceId: r.id, freeSuits: [] })}
          >
            {r.name}
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: 0 }}>
        {race.effectText} · Vigor {race.vigor}
      </p>

      <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
        {content.classes.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${hero.classId === c.id ? ' on' : ''}`}
            onClick={() => onChange({ classId: c.id, freeSuits: [] })}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: 0 }}>
        {klass.effectText}
      </p>

      {needed > 0 ? (
        <div className="stack" style={{ gap: '0.4rem' }}>
          <div className="eyebrow">
            Escolha {needed} naipe{needed > 1 ? 's' : ''} livre{needed > 1 ? 's' : ''}
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
            {SUITS.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${hero.freeSuits.includes(s) ? ' on' : ''}`}
                onClick={() => toggleFree(s)}
              >
                {SUIT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="row" style={{ gap: '1.2rem', flexWrap: 'wrap' }}>
        {SUITS.map((s) => (
          <span key={s}>
            {SUIT_LABEL[s]} <span className="num">{pools[s]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
