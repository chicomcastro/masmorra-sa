# ADR 0008 — Offline e instalação

Status: aceito · 2026-09-21

## Contexto

Critério de aceite: em modo avião, do começo ao fim, sem uma única requisição de
rede. E a spec quer o app instalável na tela inicial do tablet — é a diferença
entre "abre o navegador e procura a aba" e "toca no ícone".

## Decisão

Service worker escrito à mão, cache-first para tudo da própria origem, com o
`index.html` em cache respondendo a qualquer navegação — o SPA sobrevive a um
refresh em qualquer rota, no Pages e instalado.

**Fontes self-hosted.** Cormorant Garamond e Lora vêm do repositório, subsets
latin e latin-ext, 232 KB em oito arquivos. Carregá-las do Google Fonts seria
uma requisição de rede em tempo de jogo, o que o critério de aceite proíbe.

**Ícones em SVG.** Um `any` e um `maskable`. O sistema de design dos impressos
não tem arte; um ícone vetorial de duas formas é coerente e pesa 300 bytes.

## Consequências

Atualizar o app exige recarregar com o service worker novo. Aceitável: o app é
usado em sessões de playtest, não continuamente.
