import { useMemo, useRef, useState } from 'react'
import {
  MIN_RUNS_FOR_SIGNAL,
  NO_FILTERS,
  abstentions,
  applyFilters,
  damagePerClass,
  deadConsumables,
  deaths,
  filterLabel,
  restStats,
  tableIntuition,
  times,
  winRates,
} from '../../engine/analytics'
import type { Filters } from '../../engine/analytics'
import { useAppState, useDispatch } from '../../store'
import {
  cardsCsv,
  download,
  entriesCsv,
  eventsCsv,
  fileName,
  runsCsv,
  toBundle,
} from '../../store/export'
import { BarRow, Legend, RateWithInterval, StackedBars, formatMs } from '../components/charts'

const COLORS = { monte: 'var(--ink-500)', caidos: 'var(--danger)', furias: 'var(--gold)' }

/** Leitura fria, longe da mesa. Só se acessa de T1, nunca durante a partida. */
export function Dashboard({ onBack }: { onBack: () => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const runs = useMemo(() => applyFilters(state.archive, filters), [state.archive, filters])
  const label = filterLabel(filters)
  const versions = [...new Set(state.archive.map((r) => r.contentVersion))]

  const rates = winRates(runs)
  const deathRows = deaths(runs)
  const abstained = abstentions(runs).slice(0, 8)
  const dead = deadConsumables(runs).slice(0, 8)
  const timing = times(runs)
  const rest = restStats(runs)
  const damage = damagePerClass(runs)
  const intuition = tableIntuition(runs)

  const exportJson = () =>
    download(fileName('completo', 'json', label), JSON.stringify(toBundle(state, runs), null, 2), 'application/json')

  const exportCsv = () => {
    const tables: [string, string][] = [
      ['runs', runsCsv(runs)],
      ['cards', cardsCsv(runs)],
      ['entries', entriesCsv(runs)],
      ['events', eventsCsv(runs)],
    ]
    for (const [name, content] of tables) download(fileName(name, 'csv', label), content, 'text/csv')
  }

  const importJson = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text())
      dispatch({ type: 'IMPORT', payload })
      setImportMsg('Importado. Partidas com id já existente foram mantidas como estavam.')
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Não deu para ler o arquivo.')
    }
  }

  return (
    <div className="screen">
      <div className="center-screen stack" style={{ maxWidth: '58rem' }}>
        <div>
          <div className="eyebrow">
            {runs.length} partidas · {runs.filter((r) => r.mode === 'base').length} base ·{' '}
            {runs.filter((r) => r.mode === 'duo').length} duo
          </div>
          <h1>Dashboard</h1>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          {(['todos', 'base', 'duo'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`chip${filters.mode === m ? ' on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, mode: m }))}
            >
              {m}
            </button>
          ))}
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`chip${filters.players === n ? ' on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, players: f.players === n ? null : n }))}
            >
              {n} jogadores
            </button>
          ))}
          {versions.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip${filters.contentVersion === v ? ' on' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, contentVersion: f.contentVersion === v ? null : v }))}
            >
              conteúdo {v}
            </button>
          ))}
        </div>

        {!state.archive.length ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              Nenhuma partida arquivada. Faltam <span className="num">{MIN_RUNS_FOR_SIGNAL}</span> partidas
              para o primeiro número significar alguma coisa.
            </p>
          </div>
        ) : (
          <>
            <Panel title="Divergência do simulador" note="Taxa observada contra a meta, com intervalo de Wilson.">
              {rates.map((r) =>
                r.n === 0 ? null : (
                  <div key={r.mode} className="stack" style={{ gap: '0.2rem' }}>
                    <RateWithInterval
                      label={r.mode}
                      rate={r.rate}
                      low={r.low}
                      high={r.high}
                      target={r.target}
                      n={r.n}
                    />
                    {r.n < MIN_RUNS_FOR_SIGNAL ? (
                      <div className="warn">
                        Com {r.n} partida{r.n === 1 ? '' : 's'}, isto ainda não significa nada. Faltam{' '}
                        {MIN_RUNS_FOR_SIGNAL - r.n}.
                      </div>
                    ) : null}
                  </div>
                ),
              )}
            </Panel>

            <Panel title="Onde as partidas morrem" note="Por posição no monte, com as três fases do chefe ao final.">
              <StackedBars
                rows={deathRows.map((b) => ({
                  label: b.label,
                  parts: [
                    { name: 'monte', value: b.monte, color: COLORS.monte },
                    { name: 'caídos', value: b.caidos, color: COLORS.caidos },
                    { name: 'fúrias', value: b.furias, color: COLORS.furias },
                  ],
                }))}
              />
              <Legend
                items={[
                  { name: 'monte acabou', color: COLORS.monte },
                  { name: 'todos caídos', color: COLORS.caidos },
                  { name: '3 fúrias', color: COLORS.furias },
                ]}
              />
            </Panel>

            <Panel
              title="Vagas evitadas"
              note="Vezes em que havia herói elegível que não entrou. É o painel que mais informa balanceamento de custo."
            >
              {abstained.map((row) => (
                <BarRow
                  key={row.cardId}
                  label={row.name}
                  value={row.rate}
                  max={1}
                  caption={`${(row.rate * 100).toFixed(0)}% · ${row.seen} vez${row.seen === 1 ? '' : 'es'}`}
                />
              ))}
            </Panel>

            <Panel title="Consumíveis mortos" note="Zero jogadas em muitas obtenções é carta a refazer.">
              {dead.map((row) => (
                <BarRow
                  key={row.id}
                  label={row.name}
                  value={row.played}
                  max={Math.max(1, ...dead.map((d) => d.taken))}
                  tone={row.played === 0 ? 'danger' : 'gold'}
                  caption={`${row.played} de ${row.taken}`}
                />
              ))}
              {!dead.length ? <p className="note">Nenhum consumível registrado ainda.</p> : null}
            </Panel>

            <Panel title="Tempo" note="Mediana e p90 — a média mente quando uma mesa trava vinte minutos.">
              {timing.map((t) => (
                <div key={t.label} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{t.label}</span>
                  <span className="note">
                    mediana <span className="num">{formatMs(t.median)}</span> · p90 {formatMs(t.p90)} · n={t.n}
                  </span>
                </div>
              ))}
            </Panel>

            <Panel
              title="Descanso e cicatrizes"
              note="Se quase toda cicatriz vier do descanso, o dado de azar está caro demais."
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Descansos por partida</span>
                <span className="num">{rest.restsPerRun.toFixed(1)}</span>
              </div>
              <BarRow label="cicatrizes do dano" value={rest.scarsByCause.damage} max={Math.max(1, rest.scarsByCause.damage + rest.scarsByCause.rest)} caption={String(rest.scarsByCause.damage)} />
              <BarRow label="cicatrizes do descanso" value={rest.scarsByCause.rest} max={Math.max(1, rest.scarsByCause.damage + rest.scarsByCause.rest)} tone="danger" caption={String(rest.scarsByCause.rest)} />
            </Panel>

            <Panel title="Dano por classe" note="Normalizado por vagas ocupadas: dano por entrada, não dano bruto.">
              {damage.map((row) => (
                <BarRow
                  key={row.key}
                  label={row.label}
                  value={row.perEntry}
                  max={Math.max(0.1, ...damage.map((d) => d.perEntry))}
                  caption={`${row.perEntry.toFixed(2)} por entrada · ${row.entries} entradas`}
                />
              ))}
            </Panel>

            <Panel
              title="Intuição da mesa"
              note="Quanto a mesa deixa na mesa: a diferença média entre a composição escolhida e a ótima."
            >
              {intuition.n ? (
                <>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span>Diferença média para o ótimo</span>
                    <span className="num">{(intuition.meanGap * 100).toFixed(1)} p.p.</span>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span>Decisões ótimas</span>
                    <span className="num">{(intuition.optimalRate * 100).toFixed(0)}%</span>
                  </div>
                  <p className="note">
                    {intuition.meanGap < 0.02
                      ? 'Perto de zero: a decisão de vagas pode estar óbvia demais, e o jogo sem tensão.'
                      : intuition.meanGap > 0.2
                        ? 'Diferença enorme e constante: alguma informação essencial não está legível na carta.'
                        : 'A mesa erra o suficiente para a decisão ter peso, e acerta o suficiente para ela fazer sentido.'}
                  </p>
                </>
              ) : (
                <p className="note">Nenhuma decisão de vaga registrada ainda.</p>
              )}
            </Panel>
          </>
        )}

        <hr className="rule" />
        <div className="stack">
          <div className="eyebrow">Exportar e importar</div>
          <p className="note">
            Importar mescla por id de partida e nunca sobrescreve: conflito mantém o existente.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="quiet" onClick={exportJson} disabled={!runs.length}>
              Exportar JSON
            </button>
            <button type="button" className="quiet" onClick={exportCsv} disabled={!runs.length}>
              Exportar CSV · 4 tabelas
            </button>
            <button type="button" className="quiet" onClick={() => fileInput.current?.click()}>
              Importar JSON
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importJson(file)
                e.target.value = ''
              }}
            />
          </div>
          {importMsg ? <p className="note">{importMsg}</p> : null}
        </div>

        <div className="row">
          <button type="button" className="quiet" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="card stack">
      <div>
        <h3>{title}</h3>
        <p className="note" style={{ margin: 0 }}>
          {note}
        </p>
      </div>
      {children}
    </div>
  )
}
