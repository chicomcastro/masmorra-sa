# ADR 0001 — Stack e forma do app

Status: aceito · 2026-09-21

## Contexto

A spec sugere React + Vite + TypeScript sem impor. O que ela impõe: SPA, rodar
offline, nenhuma requisição de rede em tempo de jogo, instalável na tela inicial
do tablet.

## Decisão

React 19 + Vite + TypeScript, com Vitest para o engine. Zero dependências de
runtime além de React e React DOM. Sem biblioteca de estado, sem router, sem
biblioteca de gráficos — a navegação é um funil de doze telas e os gráficos são
cinco formas em SVG escrito à mão.

Camadas, na ordem em que podem se importar: `content` → `engine` → `store` → `ui`.
O engine é puro: sem React, sem DOM, sem `Date.now()` (o tempo entra por
parâmetro, vindo do reducer).

## Consequências

O bundle fica pequeno o bastante para o service worker pré-cachear tudo. Em
troca, escrevemos à mão o roteamento, a persistência e os gráficos.
