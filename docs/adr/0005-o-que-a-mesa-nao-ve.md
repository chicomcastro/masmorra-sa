# ADR 0005 — Como a matemática oculta fica oculta

Status: aceito · 2026-09-21

## Contexto

O princípio central da spec: o app calcula alvo efetivo, esperado e chance,
grava tudo e **não mostra nada** entre `deciding` e `resolving`. Um critério de
aceite é explícito: buscar por "%" no DOM durante `deciding` não pode retornar nada.

## Decisão

`HiddenMath` é calculado no commit das vagas, dentro do reducer, e gravado em
`current.hidden` e no evento `card_committed`. Nenhum componente de `deciding`
recebe esse objeto como prop — ele não chega à árvore de render antes de `ended`.

Um teste de aceite renderiza a tela de Mesa em `deciding` e falha se o DOM
contiver `%`, "chance", "esperado" ou "sugest". A regra fica verificada, não
combinada.

A linha que separa: o app **pode** mostrar regra ("sem Arcano você conta 2 por 1",
"esse dano viraria Cicatriz") e **não pode** mostrar prognóstico. Regra a mesa
leria no manual; prognóstico ela teria que intuir — e é a intuição que está
sendo medida.

## Consequências

`bestAlternative` faz uma busca exaustiva das composições possíveis. Com até 5
heróis mais Escudeiros e no máximo 3 vagas, são poucas dezenas de convoluções:
mais barato que qualquer heurística, e exato.
