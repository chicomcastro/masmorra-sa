# ADR 0002 — Transcrição das cartas e extensões do schema

Status: aceito · 2026-09-21

## Contexto

A tarefa zero da spec é transcrever as cartas para `content.json`. Ao transcrever,
três pontos do schema da spec não cobriram o que está impresso nas cartas.

## Decisão

**1. Dezoito obstáculos, cinco por andar no monte.** As cartas trazem 6 obstáculos
por andar; o manual manda sortear 5 de cada. O `content.json` guarda os 18 e o
`buildDeck` sorteia 5 (4 no Andar III do Duo). O validador exige ao menos 5 por
andar, não exatamente 5.

O corte do Duo fecha sozinho: tirando as cartas de 3 vagas sobram exatamente
5 · 5 · 4 = 14 obstáculos, que é a composição que o manual pede.

**2. Slots de corpo além dos cinco da spec.** A spec lista
`mao | corpo | cabeca | cinto`. As cartas impressas usam também pernas (Botas,
Grevas), colo (Rosário, Broche, Amuleto) e mãos como vestimenta (Luvas). O
enum vira `mao | maos | corpo | cabeca | cinto | pernas | colo`, com `maoA` e
`maoB` para os dois itens de mão. Mapear Botas em "corpo" desequilibraria o
jogo — dois itens disputariam um slot que as cartas nunca pretenderam compartilhar.

**3. Tipos de efeito além dos nove da spec.** A spec lista nove `kind` e manda
que o resto vire `manual`. Sete efeitos que o engine precisa calcular cairiam
em `manual` e quebrariam a matemática oculta: `offSuitPolicy` (Escriba Sem Mãos,
Bardo, Investida), `successDelta`, `slotDelta`, `damageCap`, `restHealDelta`,
`healPerSuccess`, `lootOrder`, `lootDraw`, `choosePoolSwap`, `ignoreEquipment`.
Todos são discriminados e fechados, como a spec exige; a lista apenas ficou maior.

O princípio da spec continua valendo: **nada é interpretado de texto livre**.
O que o engine não calcula é `manual`, e o app mostra o texto e pede confirmação.

## Consequências

`content.json` é a fonte única e o validador roda no boot em desenvolvimento e
como teste no CI. Mudar balanceamento é editar o JSON e recarregar.
