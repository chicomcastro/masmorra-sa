# ADR 0003 — Aleatoriedade auditável e persistência

Status: aceito · 2026-09-21

## Contexto

O app não rola dados de teste, mas sorteia: embaralhar o monte, comprar espólio,
ferimento e cicatriz. A spec pede PRNG com semente gravada em `run.seed`, para
replay determinístico.

## Decisão

`mulberry32`, com a semente e o **número de chamadas consumidas** gravados na
partida (`run.seed`, `run.rngCalls`). Só a semente não basta: retomar uma partida
depois de recarregar a página precisa continuar a sequência de onde parou, não
recomeçá-la. Ao retomar, o app reconstrói o gerador com `makeRng(seed, rngCalls)`.

Persistência em três chaves `msa.*` versionadas, com debounce de 300 ms:
`msa.profiles`, `msa.currentRun`, `msa.archive`.

## Consequências

A mesma semente com as mesmas decisões produz a mesma descida, carta por carta.
É o que prova que o app não escolheu o pior ferimento de propósito.
