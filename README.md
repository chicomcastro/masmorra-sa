# Masmorra S.A. · Mesa Digital

Um web app local que conduz a descida, guarda cada decisão e devolve os números
que a simulação não alcança.

O objetivo primário não é jogar melhor — é gerar dados de playtest que hoje só
existiriam se alguém anotasse tudo à mão.

## Os quatro princípios

| | |
|---|---|
| **A mesa manda** | O app nunca decide por ninguém. Ele lembra, conta e registra. |
| **Decidir no escuro** | O app calcula probabilidades e não as mostra durante a partida. |
| **Dado de graça** | Toda telemetria que der para inferir do estado é inferida. |
| **Tudo local** | Zero servidor, zero rede, zero conta. `localStorage` e um botão de exportar. |

## Rodando

```sh
npm install
npm run dev      # servidor de desenvolvimento
npm run test     # engine + validador de content.json
npm run check    # typecheck + testes + build, o mesmo que o CI roda
```

## Camadas

| | |
|---|---|
| `src/content` | Dados imutáveis das cartas, mais o validador. Carregado uma vez, nunca mutado. |
| `src/engine` | Funções puras: monte, alvo efetivo, off-suit, dano, probabilidade oculta. Sem React. |
| `src/store` | Estado + reducer. Cada ação produz novo estado e eventos de telemetria. |
| `src/ui` | Telas. Nenhuma regra de jogo mora aqui. |

## Telas

Doze telas e cinco sobreposições, num funil sem abas nem menu: o início leva ao
jogo, o jogo leva ao fim, o fim leva ao arquivo. O dashboard é o único desvio, e
só se acessa do início — estatística na mesa contamina a mesa, que é exatamente
o que este app existe para medir.

## Decisões

As decisões de projeto ficam em [`docs/adr`](docs/adr), uma por arquivo, com o
motivo. Se o motivo mudar, a decisão pode mudar.

## Deploy

Merge na `main` publica no GitHub Pages via Actions. O CI roda typecheck, testes
e o validador de conteúdo antes — um `content.json` quebrado não vai ao ar.
