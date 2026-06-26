## Problema

Tela branca ao selecionar fórmula do Catálogo no Passo 2 de "Novo Orçamento".

Causa: em `src/components/GerarOrcamentoDialog.tsx`, o helper `itemEhCatalogo` (linha 448) é executado de imediato dentro do `filter` que monta `itensEstabilidade` (linha 456). Ele chama `isCatalogo(...)`, mas `isCatalogo` é um `const` declarado mais abaixo no mesmo componente (linha 812). Isso cai em Temporal Dead Zone (ReferenceError: "Cannot access 'isCatalogo' before initialization"), derrubando a renderização. O erro só aparece quando há ao menos um item ligado a uma precificação de catálogo (antes disso, `itemEhCatalogo` retornava `false` sem chegar a invocar `isCatalogo`).

## Correção

Em `src/components/GerarOrcamentoDialog.tsx`:

1. Mover a declaração de `isCatalogo` para **antes** do bloco de cálculos (acima da linha 448), junto ao restante das constantes derivadas.
2. Remover a declaração duplicada que ficou na antiga posição (linha 812).
3. Nenhuma mudança em lógica, props, UI, tipos, schema ou outros arquivos.

Resultado: `itemEhCatalogo`, `todosItensSaoCatalogo` e os filtros `temPersonalizada` / `temCatalogo` passam a referenciar uma `isCatalogo` já inicializada, eliminando o TDZ e a tela branca.
