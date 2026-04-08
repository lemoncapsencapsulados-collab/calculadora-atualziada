
## Plano: Filtro global nos Insights + Paginação

### Contexto
Os insights já são gerados a partir de `pedidosFiltrados` e `orcamentosFiltrados` no hook, que respeitam o filtro de consultor global. Porém, o componente `DashboardInsights` tem um filtro de consultor próprio redundante. Além disso, todos os insights são exibidos de uma vez, gerando uma lista potencialmente infinita.

### Alterações

**Arquivo:** `src/components/dashboard/DashboardInsights.tsx`

1. **Remover filtro de consultor local** — eliminar o estado `filtroConsultor`, o `Select` de consultores e o cálculo de `consultoresUnicos`. Manter apenas o filtro por tipo (alerta, atenção, positivo, oportunidade).

2. **Adicionar paginação com 15 itens por página:**
   - Novo estado `paginaAtual` (default 1)
   - Calcular `totalPaginas` a partir de `insightsFiltrados.length / 15`
   - Exibir apenas o slice da página atual
   - Adicionar controles de paginação abaixo da lista usando o componente `Pagination` já existente no projeto
   - Resetar para página 1 quando o filtro de tipo mudar

Nenhum outro arquivo precisa ser alterado — o filtro global do dashboard já filtra os dados antes de chegarem ao componente.
