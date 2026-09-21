# Arquitetura

## As camadas

Cada camada só pode importar as que estão acima dela. O engine não conhece
React; a interface não conhece regra de jogo.

```mermaid
flowchart TD
    C["<b>content</b><br/>content.json + validador<br/><i>imutável, carregado uma vez</i>"]
    E["<b>engine</b><br/>monte · alvo efetivo · off-suit<br/>dano · probabilidade oculta<br/><i>funções puras, sem React</i>"]
    S["<b>store</b><br/>reducer + eventos + persistência<br/><i>única fonte do log</i>"]
    U["<b>ui</b><br/>doze telas, cinco sobreposições<br/><i>nenhuma regra mora aqui</i>"]
    L[("localStorage<br/>msa.profiles · msa.currentRun · msa.archive")]

    C --> E --> S --> U
    S <--> L
    U -. "dispatch(action)" .-> S
```

## O fluxo de uma ação

A regra dura: nenhuma ação escreve no log direto da interface. Se um evento não
nasce do reducer, ele não existe — é assim que o log não fica com buraco quando
alguém recarrega a página no meio de uma rodada.

```mermaid
sequenceDiagram
    participant M as Mesa
    participant R as reducer
    participant G as engine (puro)
    participant P as persist

    M->>R: dispatch(action)
    R->>G: calcula com PRNG semeado
    G-->>R: novo estado
    R->>R: emite evento com t
    R->>P: debounce 300 ms
    P-->>M: re-render
    Note over R,G: rngCalls é gravado junto da semente,<br/>para retomar continuar a sequência
```

## A máquina de estados

Nove estados. O campo `run.phase` governa o que a Mesa mostra e o que ela
aceita; toda transição emite evento.

```mermaid
stateDiagram-v2
    [*] --> setup
    setup --> awaitingReveal: iniciar

    awaitingReveal --> deciding: revelar obstáculo
    awaitingReveal --> bossPhase: revelar fase do chefe
    awaitingReveal --> resting: descansar (1 carta)
    awaitingReveal --> ended: abandonar

    deciding --> entering: confirmar vagas
    deciding --> awaitingReveal: recuar (2 cartas · 1 no Duo)
    bossPhase --> entering: confirmar vagas
    bossPhase --> entering: Fase III entra direto

    entering --> resolving: todos declararam
    resolving --> consequences: confirmar veredito

    consequences --> awaitingReveal: seguir
    consequences --> bossPhase: repetir fase (base)
    consequences --> ended: vitória ou derrota

    resting --> awaitingReveal: descanso concluído
    ended --> [*]: arquivar

    note right of deciding
        Aqui a conta é calculada
        e escondida. Nenhuma
        probabilidade chega à tela.
    end note
```

Guardas: `deciding → entering` exige ao menos uma vaga ocupada; ao entrar em
`entering` as vagas travam, porque depois de rolar não há recuo. Derrota é
verificada ao sair de `consequences`: monte vazio antes de a Fase III fechar,
todos caídos, ou 3 Fúrias no Duo.

## O que a mesa não vê

```mermaid
flowchart LR
    A["vagas confirmadas"] --> B["engine calcula<br/>esperado · chance · melhor composição"]
    B --> C[("current.hidden<br/>+ evento card_committed")]
    C -.->|"nunca"| D["tela em deciding"]
    C ==>|"só no fim"| F["T9 · Fim de partida"]
    C ==>|"agregado"| G["T12 · Dashboard"]

    style D stroke-dasharray: 4 4
```

A conta existe desde o commit das vagas e não chega à árvore de render antes de
`ended`. Um teste renderiza a Mesa em `deciding` e falha se o DOM contiver `%`,
"chance", "esperado" ou "sugest" — a regra fica verificada, não combinada.
