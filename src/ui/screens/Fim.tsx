import { afflictionById, cardById } from '../../content'
import type { Run } from '../../engine/state'
import { useDispatch } from '../../store'
import { actorName } from '../../store/reducer'

const CAUSE: Record<string, string> = {
  monte: 'O monte acabou antes do chefe.',
  caidos: 'Todos os heróis caíram.',
  furias: 'A terceira Fúria encerrou a descida.',
}

/** Três blocos: o desfecho, a linha do tempo e a matemática oculta, enfim revelada. */
export function Fim({ run, onDebrief, onArchive }: { run: Run; onDebrief: () => void; onArchive: () => void }) {
  const dispatch = useDispatch()
  const newScars = run.heroes.flatMap((h) => h.scars.map((s) => ({ hero: h.name, scar: s })))

  return (
    <div className="screen">
      <div className="center-screen stack">
        <div>
          <div className="eyebrow">Fim da descida</div>
          <h1>
            {run.outcome === 'vitoria' ? 'A descida é de vocês' : run.outcome === 'abandono' ? 'Descida abandonada' : 'Derrota'}
          </h1>
          {run.defeatCause ? <p className="flavor">{CAUSE[run.defeatCause]}</p> : null}
        </div>

        {newScars.length ? (
          <div className="card stack">
            <div className="eyebrow">As Cicatrizes que ficam</div>
            {newScars.map(({ hero, scar }, i) => (
              <div key={i}>
                <strong>{hero}</strong> · {afflictionById(scar).name}{' '}
                <span className="note">{afflictionById(scar).effectText}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="stack">
          <div className="eyebrow">A linha do tempo</div>
          <Timeline run={run} />
        </div>

        <div className="stack">
          <div className="eyebrow">A matemática oculta, enfim revelada</div>
          <p className="note">
            A chance que a mesa tinha e não viu, carta a carta — e onde a escolha de vagas divergiu da ótima.
          </p>
          <div className="stack" style={{ gap: '0.5rem' }}>
            {run.resolved
              .filter((r) => r.hidden)
              .map((r, i) => {
                const gap = (r.hidden!.bestAlternative?.prob ?? 0) - r.hidden!.winProbability
                return (
                  <div key={i} className="card stack" style={{ gap: '0.3rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong>
                        {r.position + 1}. {cardById(r.cardId).name}
                      </strong>
                      <span className={r.result === 'vitoria' ? '' : 'warn'}>
                        {r.declaredTotal} de {r.effectiveTarget} · {r.result}
                      </span>
                    </div>
                    <div className="note">
                      chance {(r.hidden!.winProbability * 100).toFixed(0)}% · esperado{' '}
                      {r.hidden!.expectedTotal.toFixed(1)}
                      {r.hidden!.bestAlternative
                        ? ` · melhor composição ${(r.hidden!.bestAlternative.prob * 100).toFixed(0)}% (${r.hidden!.bestAlternative.slots
                            .map((id) => actorName(run, id))
                            .join(' + ')})`
                        : ''}
                    </div>
                    {gap > 0.05 ? (
                      <div className="warn">
                        A mesa deixou {(gap * 100).toFixed(0)} pontos percentuais na mesa.
                      </div>
                    ) : null}
                    {r.hidden!.eligibleAbstained.length ? (
                      <div className="note">
                        Ficaram de fora podendo entrar:{' '}
                        {r.hidden!.eligibleAbstained.map((id) => actorName(run, id)).join(', ')}
                      </div>
                    ) : null}
                  </div>
                )
              })}
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="primary" onClick={onDebrief}>
            Preencher o debrief
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              dispatch({ type: 'ARCHIVE_RUN' })
              onArchive()
            }}
          >
            Arquivar e voltar ao início
          </button>
        </div>
        <p className="note">
          O debrief pode ficar em branco e ser preenchido dias depois, a partir dos Registros. Uma partida
          sem debrief nunca bloqueia o arquivamento.
        </p>
      </div>
    </div>
  )
}

/** Uma faixa horizontal com as cartas, marcando vitória, falha, recuo e descanso. */
export function Timeline({ run, onPick, picked }: { run: Run; onPick?: (i: number) => void; picked?: number | null }) {
  const color = (result: string | null) =>
    result === 'vitoria' ? 'var(--gold)' : result === 'falha' ? 'var(--danger)' : 'var(--ink-500)'

  return (
    <div className="row" style={{ gap: '3px', flexWrap: 'wrap' }}>
      {run.resolved.map((r, i) => (
        <button
          key={i}
          type="button"
          title={`${cardById(r.cardId).name} · ${r.result}`}
          onClick={() => onPick?.(i)}
          disabled={!onPick}
          style={{
            minHeight: 44,
            minWidth: 26,
            padding: 0,
            borderColor: picked === i ? 'var(--ink)' : color(r.result),
            borderWidth: picked === i ? 2 : 1,
            background: r.result === 'vitoria' ? 'var(--gold-100)' : 'transparent',
            fontSize: '0.7rem',
          }}
        >
          {cardById(r.cardId).kind === 'boss' ? ['I', 'II', 'III'][(cardById(r.cardId) as { phase: number }).phase - 1] : i + 1}
        </button>
      ))}
    </div>
  )
}
