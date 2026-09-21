import { useState } from 'react'
import { afflictionById } from '../../content'
import { useAppState, useDispatch } from '../../store'
import { TwoTapButton } from '../components/primitives'

/** Cicatrizes persistem por perfil, não por partida. Visíveis e removíveis aqui. */
export function Perfis({ onBack }: { onBack: () => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [name, setName] = useState('')

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Perfis</div>
          <h1>Quem volta</h1>
          <p className="flavor">A campanha é feita das marcas que vocês não conseguiram evitar.</p>
        </div>
        <hr className="rule" />

        <div className="row">
          <input
            value={name}
            placeholder="Nome do jogador"
            onChange={(e) => setName(e.target.value)}
            style={{
              font: 'inherit',
              flex: 1,
              padding: '0.5rem',
              minHeight: '56px',
              border: '1px solid var(--divider)',
              borderRadius: 'var(--radius)',
              background: 'transparent',
            }}
          />
          <button
            type="button"
            className="primary"
            disabled={!name.trim()}
            onClick={() => {
              dispatch({ type: 'UPSERT_PROFILE', id: null, name: name.trim() })
              setName('')
            }}
          >
            Criar perfil
          </button>
        </div>

        {!state.profiles.length ? <p className="note">Nenhum perfil ainda.</p> : null}

        {state.profiles.map((p) => (
          <div key={p.id} className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{p.name}</h3>
              <TwoTapButton
                className="danger"
                confirmLabel="Tocar de novo apaga o perfil"
                onConfirm={() => dispatch({ type: 'DELETE_PROFILE', profileId: p.id })}
              >
                Apagar
              </TwoTapButton>
            </div>
            {p.scars.length ? (
              p.scars.map((s, i) => (
                <div key={`${s}-${i}`} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <strong>{afflictionById(s).name}</strong>{' '}
                    <span className="note">{afflictionById(s).effectText}</span>
                  </span>
                  <button
                    type="button"
                    className="quiet"
                    style={{ minHeight: 44 }}
                    onClick={() => dispatch({ type: 'REMOVE_SCAR', profileId: p.id, scarId: s })}
                  >
                    Remover
                  </button>
                </div>
              ))
            ) : (
              <p className="note">Sem cicatrizes. Ainda.</p>
            )}
          </div>
        ))}

        <div className="row">
          <button type="button" className="quiet" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
