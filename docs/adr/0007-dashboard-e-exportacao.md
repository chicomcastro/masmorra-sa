# ADR 0007 — Dashboard, exportação e o painel bônus

Status: aceito · 2026-09-21

## Contexto

Sete painéis, um por pergunta de pesquisa, mais o painel bônus da intuição da
mesa. A spec pede gráficos em SVG escrito à mão, sem biblioteca de charts.

## Decisão

**SVG à mão.** São três formas — barra, barra empilhada e ponto com intervalo.
Uma biblioteca de charts custaria mais em bytes e em amarração do que o código
que ela substituiria, e o app precisa caber num service worker.

**Wilson, não intervalo normal.** Com n abaixo de 30 o intervalo normal produz
limites fora de [0,1] e mente sobre a incerteza. O painel também diz o n e,
abaixo de 10 partidas, avisa em vermelho que o número ainda não significa nada —
exibir uma taxa de vitória de 3 partidas como se fosse resultado é a forma mais
rápida de tomar uma decisão de design errada.

**Mediana e p90, nunca média.** A média mente quando uma mesa trava vinte
minutos numa carta, que é exatamente o caso que interessa detectar.

**Importar mescla por `run.id` e nunca sobrescreve.** Conflito de id mantém o
existente e avisa. Perfis mesclam por nome, unindo as Cicatrizes sem duplicar —
é o que permite juntar dados de tablets diferentes sem perder campanha.

**Quatro CSVs, uma linha por unidade de análise.** `runs`, `cards`, `entries` e
`events`. `cards.csv` leva a matemática oculta junto, que é o que torna a análise
de divergência possível numa planilha.

## Consequências

O dashboard só se acessa da tela inicial, nunca durante a partida: estatística na
mesa contamina a mesa, que é exatamente o que este app existe para medir.
