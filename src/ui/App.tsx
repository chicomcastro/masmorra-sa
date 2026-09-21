import { useState } from 'react'
import { StoreProvider, useAppState } from '../store'
import { Dashboard } from './screens/Dashboard'
import { Debrief } from './screens/Debrief'
import { Fim } from './screens/Fim'
import { Registros } from './screens/Registros'
import { Inicio, type Screen } from './screens/Inicio'
import { Mesa } from './screens/Mesa'
import { Perfis } from './screens/Perfis'
import { Preparo } from './screens/Preparo'

export function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}

/**
 * O app é um funil: T1 leva ao jogo, o jogo leva ao fim, o fim leva ao arquivo.
 * Sem abas, sem menu hambúrguer.
 */
function Router() {
  const state = useAppState()
  const [screen, setScreen] = useState<Screen>('inicio')
  const run = state.currentRun

  if (run && run.phase === 'ended') {
    if (screen === 'debrief') {
      return <Debrief run={run} archived={false} onDone={() => setScreen('inicio')} />
    }
    return <Fim run={run} onDebrief={() => setScreen('debrief')} onArchive={() => setScreen('inicio')} />
  }
  if (run && screen === 'inicio') return <Mesa run={run} />

  switch (screen) {
    case 'preparo':
      return <Preparo onDone={() => setScreen('inicio')} onBack={() => setScreen('inicio')} />
    case 'perfis':
      return <Perfis onBack={() => setScreen('inicio')} />
    case 'registros':
      return <Registros onBack={() => setScreen('inicio')} />
    case 'dashboard':
      return <Dashboard onBack={() => setScreen('inicio')} />
    default:
      return <Inicio go={setScreen} />
  }
}
