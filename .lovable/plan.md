

## Plano: Adicionar filtros de Consultor e Data de Pagamento na página de Pedidos

### Objetivo
Adicionar dois filtros na página de Pedidos:
1. **Filtro por Consultor** — select/combobox com os consultores existentes nos pedidos
2. **Filtro por Data de Pagamento** — date range picker usando a `data_pagamento` do `orcamento_snapshot`

### Alterações

**Arquivo: `src/pages/Pedidos.tsx`**

1. Adicionar estados para os novos filtros:
   - `filtroConsultor: string` (default `'todos'`)
   - `dataInicioFiltro: Date | undefined`
   - `dataFimFiltro: Date | undefined`

2. Extrair lista única de consultores dos pedidos carregados (do `orcamento_snapshot.consultor_responsavel`) para popular o Select

3. Adicionar na barra de filtros (ao lado do campo de busca e filtro de status existentes):
   - **Select de Consultor**: dropdown com opção "Todos" + lista de consultores
   - **Date pickers**: dois campos de data (De / Até) usando Popover + Calendar para selecionar o intervalo da data de pagamento

4. Atualizar o `filteredPedidos` (useMemo) para incluir:
   - Filtro por consultor: comparar `orcamento_snapshot.consultor_responsavel` com o valor selecionado
   - Filtro por data de pagamento: extrair `orcamento_snapshot.data_pagamento` (string ISO), converter para `YYYY-MM-DD` e comparar com o intervalo selecionado (mesma lógica de string comparison usada no dashboard para evitar problemas de timezone)

5. Adicionar botão "Limpar filtros" para resetar todos os filtros de uma vez

### Detalhes técnicos
- A data de pagamento vem do `orcamento_snapshot.data_pagamento` (timestamp ISO com timezone)
- Comparação via substring `YYYY-MM-DD` para consistência com o padrão já usado no dashboard
- Imports adicionais: `Calendar` de `@/components/ui/calendar`, `Popover/PopoverContent/PopoverTrigger`
- Nenhuma alteração de banco de dados necessária

