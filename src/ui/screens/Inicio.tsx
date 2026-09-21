import { cardById } from '../../content'
import { useAppState, useDispatch } from '../../store'
import { STORAGE_WARN_RUNS, storageUsedKb } from '../../store/persist'
import { TwoTapButton } from '../components/primitives'

export type Screen = 'inicio' | 'preparo' | 'registros' | 'dashboard' | 'perfis' | 'debrief'

/** Havendo partida em andamento, retomar domina a tela. */
export function Inicio({ go }: { go: (screen: Screen) => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const run = state.currentRun

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Mesa digital</div>
          <h1>Masmorra S.A.</h1>
          <p className="flavor">A pergunta nunca é como vencer esta carta, e sim quem entra nela.</p>
        </div>
        <hr className="rule" />

        {run ? (
          <div className="card stack">
            <div className="eyebrow">Descida em andamento</div>
            <h3>
              {run.mode === 'duo' ? 'Duo' : `${run.heroes.length} jogadores`} ·{' '}
              {run.resolved.length} cartas resolvidas · {run.deck.length} no monte
            </h3>
            <p className="note">
              {run.heroes.map((h) => h.name).join(' · ')}
              {run.current ? ` · na carta ${cardById(run.current.cardId).name}` : ''}
            </p>
            <div className="row">
              <button type="button" className="primary" onClick={() => go('inicio')}>
                Retomar descida
              </button>
              <TwoTapButton
                className="danger"
                confirmLabel="Tocar de novo apaga esta descida"
                onConfirm={() => dispatch({ type: 'DISCARD_RUN' })}
              >
                Descartar
              </TwoTapButton>
            </div>
          </div>
        ) : (
          <button type="button" className="primary" onClick={() => go('preparo')}>
            Nova descida
          </button>
        )}

        {state.archive.length >= STORAGE_WARN_RUNS ? (
          <p className="warn">
            {state.archive.length} partidas guardadas ({storageUsedKb()} KB). Exporte pelo dashboard antes que
            o armazenamento do navegador encha.
          </p>
        ) : null}

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="quiet" onClick={() => go('registros')}>
            Registros · {state.archive.length}
          </button>
          <button type="button" className="quiet" onClick={() => go('dashboard')}>
            Dashboard
          </button>
          <button type="button" className="quiet" onClick={() => go('perfis')}>
            Perfis · {state.profiles.length}
          </button>
        </div>
      </div>
    </div>
  )
}
