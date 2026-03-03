

# Popup de Data de Pagamento ao Aprovar + Correção Dashboard por Consultor

## Problemas Identificados

### 1. Falta popup de data de pagamento ao aprovar
Quando o status muda para "aprovado", nada é perguntado. O usuario precisa registrar a data de pagamento do cliente.

### 2. Dados de consultores incompletos no Dashboard
O dashboard filtra por periodo (mes atual). Os orcamentos "enviado" do Kilson sao de fevereiro, por isso nao aparecem. O problema e que a **distribuicao por status** (grafico de barras) deveria mostrar TODOS os orcamentos do consultor independente do periodo, ou o usuario precisa expandir o filtro. A solucao correta: a contagem de status por consultor no card Pipeline deve considerar todos os orcamentos (sem filtro de data), enquanto os KPIs e faturamento continuam filtrados por periodo.

## Alteracoes

### 1. Migração - adicionar coluna `data_pagamento` na tabela `orcamentos`
```sql
ALTER TABLE orcamentos ADD COLUMN data_pagamento timestamp with time zone DEFAULT NULL;
```

### 2. Tipos - `src/types/orcamento.ts`
- Adicionar `data_pagamento?: string` na interface `Orcamento`

### 3. Popup de Data de Pagamento - `src/pages/Orcamentos.tsx`
- Novo state `aprovandoOrcamento` para guardar o orcamento que esta sendo aprovado
- Novo state `dataPagamento` (Date)
- Modificar `handleStatusChange`: quando `newStatus === 'aprovado'`, ao inves de chamar `updateStatus` direto, abrir um Dialog pedindo a data de pagamento
- O Dialog tera um DatePicker (Shadcn Calendar/Popover) com label "Data do Pagamento do Cliente"
- Ao confirmar, chamar `updateStatus` + salvar `data_pagamento` no registro via update

### 4. Kanban - `src/components/OrcamentoKanbanView.tsx`
- Mesmo comportamento: ao dropar na coluna "Aprovado", interceptar e mostrar popup de data de pagamento
- Passar callback `onApproveWithDate` ao inves de chamar `onStatusChange` direto quando target e "aprovado"

### 5. Hook `useOrcamentos.ts`
- Adicionar mutation ou ajustar `updateStatus` para aceitar `data_pagamento` opcional

### 6. Dashboard - `src/hooks/useDashboardComercial.ts`
- **Correcao**: `distribuicaoConsultorStatus` deve usar `orcamentos` (sem filtro de data) ao inves de `orcamentosFiltrados`
- Isso garante que a contagem por status de cada consultor mostra TODOS os orcamentos, independente do periodo selecionado
- KPIs, ranking, pipeline continuam usando `orcamentosFiltrados` (comportamento correto)

### 7. Dashboard Vendas - Exibir data de pagamento
- No card de vendas aprovadas, mostrar `data_pagamento` quando disponivel

## Arquivos Modificados
- Migracao SQL (nova coluna `data_pagamento`)
- `src/types/orcamento.ts`
- `src/pages/Orcamentos.tsx`
- `src/components/OrcamentoKanbanView.tsx`
- `src/hooks/useOrcamentos.ts`
- `src/hooks/useDashboardComercial.ts`

