# ADR 0004 — Deploy no GitHub Pages

Status: aceito · 2026-09-21

## Contexto

O app é local e offline, mas precisa chegar ao tablet de alguém. Pages resolve
a distribuição sem contradizer "zero servidor": o servidor entrega os arquivos
uma vez e nunca mais é consultado.

## Decisão

GitHub Actions publica em Pages a cada merge na `main`. O `base` do Vite é
`/masmorra-sa/`. Um `404.html` igual ao `index.html` faz o SPA sobreviver a um
refresh em qualquer rota. O CI roda `tsc`, o validador de conteúdo e os testes
antes de publicar — um `content.json` quebrado não vai ao ar.

Manifest + service worker com pré-cache de tudo: depois da primeira visita o app
abre em modo avião, que é um critério de aceite da spec.

## Consequências

"Tudo local" continua verdade em tempo de jogo. A rede só aparece para instalar
e para atualizar.
