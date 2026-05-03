## Objetivo

Alterar o comportamento do botão **"Ver Orçamento"** dentro de **Insights e Alertas** (Dashboard). Hoje ele navega para `/orcamentos?focus=<id>` e abre automaticamente o **diálogo de edição** do orçamento. O usuário quer apenas ver o card do orçamento na lista (para alterar o status pelo dropdown e ajustar a notificação), sem abrir o editor.

## Mudanças

### 1. `src/pages/Orcamentos.tsx`
- Remover o efeito que faz `setEditandoOrcamento(found)` quando `?focus=<id>` está presente.
- Substituir por um efeito que:
  - Procura o card com `data-orcamento-id={id}` no DOM.
  - Faz `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
  - Aplica um destaque temporário (classe `ring-2 ring-primary` por ~2.5s) para o usuário localizar visualmente o orçamento.
  - Limpa o parâmetro `focus` da URL após aplicar.
- Caso o orçamento não esteja na página atual (paginação/filtros), forçar uma busca para localizar a página correta. Solução simples: limpar `searchTerm`/`consultorFilter` e usar o `numero_orcamento` (já vem no insight) como `searchTerm` para garantir que apareça na primeira página, então rolar e destacar.

### 2. Marcar os cards na lista
- Em `Orcamentos.tsx` (view "list") e em `src/components/OrcamentoKanbanView.tsx`, adicionar `id={`orc-card-${orc.id}`}` (ou `data-orcamento-id`) no elemento raiz de cada card, para permitir o scroll/destaque.

### 3. Sem mudanças em `DashboardInsights.tsx`
- O botão continua navegando para `/orcamentos?focus=<id>&numero=<numero>`. Apenas adicionamos `numero` na URL para o filtro automático funcionar (lido do insight existente).

## Resultado

Ao clicar em **"Ver Orçamento"** numa notificação:
- Usuário é levado para a aba **Orçamentos**.
- A lista é filtrada pelo número do orçamento (ex.: `ORC-026`).
- O card é rolado para o centro da tela e destacado por alguns segundos.
- O diálogo de edição **não** é aberto — o usuário pode usar o dropdown de status (Enviado/Recusado/etc.) diretamente no card e a notificação se ajusta automaticamente.