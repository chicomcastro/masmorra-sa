import { useState } from 'react'
import { cardById } from '../../content'
import type { Run } from '../../engine/state'
import { useAppState, useDispatch } from '../../store'
import { formatMs } from '../components/charts'
import { TwoTapButton } from '../components/primitives'
import { LogSheet } from './Sheets'
import { Debrief } from './Debrief'
import { Timeline } from './Fim'

/** Partidas arquivadas. Abrir uma mostra seu log e permite completar o debrief depois. */
export function Registros({ onBack }: { onBack: () => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [openId, setOpenId] = useState<string | null>(null)
  const [logId, setLogId] = useState<string | null>(null)
  const [debriefId, setDebriefId] = useState<string | null>(null)

  const debriefing = state.archive.find((r) => r.id === debriefId)
  if (debriefing) return <Debrief run={debriefing} archived onDone={() => setDebriefId(null)} />

  const logRun = state.archive.find((r) => r.id === logId)

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Registros · {state.archive.length} partidas</div>
          <h1>O que ficou</h1>
        </div>
        <hr className="rule" />

        {!state.archive.length ? <p className="note">Nenhuma partida arquivada ainda.</p> : null}

        {state.archive.map((run) => (
          <div key={run.id} className="card stack">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <h3>
                  {run.outcome === 'vitoria' ? 'Vitória' : run.outcome === 'abandono' ? 'Abandono' : 'Derrota'}
                  {run.defeatCause ? ` · ${run.defeatCause}` : ''}
                </h3>
                <div className="note">
                  {run.mode === 'duo' ? 'Duo' : `${run.heroes.length} jogadores`} ·{' '}
                  {new Date(run.startedAt).toLocaleDateString('pt-BR')} ·{' '}
                  {run.endedAt
                    ? formatMs(new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime())
                    : '—'}{' '}
                  · {run.resolved.length} cartas · conteúdo {run.contentVersion}
                </div>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="quiet"
                  style={{ minHeight: 44 }}
                  onClick={() => setOpenId(openId === run.id ? null : run.id)}
                >
                  {openId === run.id ? 'Fechar' : 'Abrir'}
                </button>
                <TwoTapButton
                  className="danger"
                  confirmLabel="Tocar de novo apaga o registro"
                  onConfirm={() => dispatch({ type: 'DELETE_ARCHIVED', runId: run.id })}
                >
                  Apagar
                </TwoTapButton>
              </div>
            </div>

            {openId === run.id ? <RunDetail run={run} onLog={() => setLogId(run.id)} onDebrief={() => setDebriefId(run.id)} /> : null}

            {!run.debrief?.savedAt ? (
              <button type="button" className="quiet" onClick={() => setDebriefId(run.id)}>
                Preencher o debrief
              </button>
            ) : (
              <div className="note">
                Debrief salvo em {new Date(run.debrief.savedAt).toLocaleDateString('pt-BR')} ·
                jogariam de novo: {run.debrief.wouldPlayAgain ?? '—'}
              </div>
            )}
          </div>
        ))}

        <div className="row">
          <button type="button" className="quiet" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>
      {logRun ? <LogSheet run={logRun} onClose={() => setLogId(null)} /> : null}
    </div>
  )
}

function RunDetail({ run, onLog, onDebrief }: { run: Run; onLog: () => void; onDebrief: () => void }) {
  return (
    <div className="stack">
      <Timeline run={run} />
      <div className="note">
        {run.heroes
          .map((h) => `${h.name} (${h.scars.length} cicatriz${h.scars.length === 1 ? '' : 'es'})`)
          .join(' · ')}
      </div>
      <div className="stack" style={{ gap: '0.3rem' }}>
        {run.resolved.slice(0, 6).map((c, i) => (
          <div key={i} className="note">
            {c.position + 1}. {cardById(c.cardId).name} · {c.declaredTotal} de {c.effectiveTarget} ·{' '}
            {c.result}
            {c.hidden ? ` · chance ${(c.hidden.winProbability * 100).toFixed(0)}%` : ''}
          </div>
        ))}
        {run.resolved.length > 6 ? <div className="note">…</div> : null}
      </div>
      <div className="row">
        <button type="button" className="quiet" onClick={onLog}>
          Ver o log completo · {run.events.length} eventos
        </button>
        <button type="button" className="quiet" onClick={onDebrief}>
          {run.debrief?.savedAt ? 'Revisar debrief' : 'Preencher debrief'}
        </button>
      </div>
    </div>
  )
}
