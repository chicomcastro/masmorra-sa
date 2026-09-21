import { useState } from 'react'
import { cardById } from '../../content'
import type { Debrief as DebriefData, Run } from '../../engine/state'
import { useDispatch } from '../../store'
import { formatMs } from '../components/charts'
import { Timeline } from './Fim'

const EMPTY: DebriefData = {
  funStoppedAtCard: null,
  confusingCards: [],
  longDiscussion: '',
  leftOutHeroes: [],
  defeatFairness: null,
  rulesPlayedWrong: '',
  wouldPlayAgain: null,
  savedAt: null,
}

const inputStyle = {
  font: 'inherit',
  width: '100%',
  padding: '0.6rem',
  minHeight: '56px',
  border: '1px solid var(--divider)',
  borderRadius: 'var(--radius)',
  background: 'transparent',
} as const

/**
 * Quem preenche é o facilitador, sozinho, olhando a linha do tempo. Nenhum
 * jogador responde nada: troca autorrelato enviesado por observação estruturada.
 */
export function Debrief({ run, archived, onDone }: { run: Run; archived: boolean; onDone: () => void }) {
  const dispatch = useDispatch()
  const [d, setD] = useState<DebriefData>(run.debrief ?? EMPTY)
  const patch = (p: Partial<DebriefData>) => setD((prev) => ({ ...prev, ...p }))

  const revealed = [...new Set(run.resolved.map((r) => r.cardId))]
  const longest = run.events
    .filter((e) => e.type === 'card_committed' && typeof e.payload.deliberationMs === 'number')
    .sort((a, b) => Number(b.payload.deliberationMs) - Number(a.payload.deliberationMs))[0]
  const suggestion = longest
    ? `a carta ${cardById(String(longest.payload.cardId)).name} levou ${formatMs(Number(longest.payload.deliberationMs))}`
    : null

  const abstentions = run.heroes.map((h) => ({
    hero: h,
    count: run.resolved.filter((c) => c.hidden?.eligibleAbstained.includes(h.id)).length,
  }))

  const duration = run.endedAt
    ? formatMs(new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime())
    : '—'

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">
            Debrief · {run.outcome} · {run.heroes.length} jogadores · {duration}
          </div>
          <h1>O que a mesa mostrou</h1>
          <p className="flavor">Sete perguntas. Pode ficar em branco e ser preenchido dias depois.</p>
        </div>

        <div className="stack">
          <div className="eyebrow">A descida</div>
          <Timeline
            run={run}
            picked={d.funStoppedAtCard}
            onPick={(i) => patch({ funStoppedAtCard: d.funStoppedAtCard === i ? null : i })}
          />
        </div>
        <hr className="rule" />

        <div className="stack">
          <strong>1 · Em que momento a mesa parou de se divertir?</strong>
          <p className="note">
            {d.funStoppedAtCard === null
              ? 'Toque numa carta da linha do tempo acima, ou deixe em branco para "nunca".'
              : `Carta ${d.funStoppedAtCard + 1} · ${cardById(run.resolved[d.funStoppedAtCard].cardId).name}`}
          </p>
        </div>

        <div className="stack">
          <strong>2 · Qual carta ninguém entendeu?</strong>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
            {revealed.map((id) => (
              <button
                key={id}
                type="button"
                className={`chip${d.confusingCards.includes(id) ? ' on' : ''}`}
                onClick={() =>
                  patch({
                    confusingCards: d.confusingCards.includes(id)
                      ? d.confusingCards.filter((x) => x !== id)
                      : [...d.confusingCards, id],
                  })
                }
              >
                {cardById(id).name}
              </button>
            ))}
            <button
              type="button"
              className={`chip${d.confusingCards.length === 0 ? ' on' : ''}`}
              onClick={() => patch({ confusingCards: [] })}
            >
              nenhuma
            </button>
          </div>
        </div>

        <div className="stack">
          <strong>3 · Houve discussão longa? Sobre o quê?</strong>
          {suggestion ? (
            <button type="button" className="quiet" onClick={() => patch({ longDiscussion: suggestion })}>
              Usar a leitura do log: {suggestion}
            </button>
          ) : null}
          <input
            value={d.longDiscussion}
            onChange={(e) => patch({ longDiscussion: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="stack">
          <strong>4 · Alguém ficou de fora demais?</strong>
          <p className="note">A contagem de vagas evitadas já está calculada. Confirme ou corrija a leitura.</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
            {abstentions.map(({ hero, count }) => (
              <button
                key={hero.id}
                type="button"
                className={`chip${d.leftOutHeroes.includes(hero.id) ? ' on' : ''}`}
                onClick={() =>
                  patch({
                    leftOutHeroes: d.leftOutHeroes.includes(hero.id)
                      ? d.leftOutHeroes.filter((x) => x !== hero.id)
                      : [...d.leftOutHeroes, hero.id],
                  })
                }
              >
                {hero.name} · {count} vagas evitadas
              </button>
            ))}
          </div>
        </div>

        {run.outcome === 'derrota' ? (
          <div className="stack">
            <strong>5 · A derrota pareceu justa?</strong>
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
              {['arbitrária', 'quase arbitrária', 'nem uma coisa nem outra', 'quase merecida', 'merecida'].map(
                (label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`chip${d.defeatFairness === i + 1 ? ' on' : ''}`}
                    onClick={() => patch({ defeatFairness: i + 1 })}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : null}

        <div className="stack">
          <strong>6 · Alguma regra foi jogada errado?</strong>
          {run.events.filter((e) => e.type === 'override').length ? (
            <p className="note">
              Ajustes manuais desta partida:{' '}
              {run.events
                .filter((e) => e.type === 'override')
                .map((e) => `${e.payload.path} ${e.payload.from}→${e.payload.to}`)
                .join(' · ')}
            </p>
          ) : (
            <p className="note">Nenhum ajuste manual nesta partida.</p>
          )}
          <input
            value={d.rulesPlayedWrong}
            onChange={(e) => patch({ rulesPlayedWrong: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="stack">
          <strong>7 · Jogariam de novo agora?</strong>
          <div className="row" style={{ gap: '0.4rem' }}>
            {(['sim', 'talvez', 'nao'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`chip${d.wouldPlayAgain === v ? ' on' : ''}`}
                onClick={() => patch({ wouldPlayAgain: v })}
              >
                {v === 'nao' ? 'não' : v}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <button type="button" className="quiet" onClick={onDone}>
            Deixar em branco
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="primary"
            onClick={() => {
              dispatch({ type: 'SAVE_DEBRIEF', debrief: d, runId: archived ? run.id : undefined })
              onDone()
            }}
          >
            Salvar debrief
          </button>
        </div>
      </div>
    </div>
  )
}
