# ADR 0006 — Log append-only e Desfazer

Status: aceito · 2026-09-21

## Contexto

A spec tem uma regra dura: nenhuma ação escreve no log direto da UI. Se um evento
não nasce do reducer, ele não existe.

## Decisão

O reducer devolve `{ state, events }`. A UI despacha ações e nunca constrói
eventos. O timestamp `t` é gravado no reducer, nunca no render.

Desfazer tem profundidade de um passo e é implementado guardando o estado
anterior inteiro, não invertendo ações. Ele emite `undo` no log e marca o evento
original `undone: true` em vez de apagá-lo — desfazer repetido no mesmo ponto do
fluxo é diagnóstico de usabilidade de graça.

## Consequências

Recarregar a página no meio de uma rodada não deixa buraco no log. O log
exportado permite reconstruir cada decisão de vaga e cada total declarado, que
é outro critério de aceite.
