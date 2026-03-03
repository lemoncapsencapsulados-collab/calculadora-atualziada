

# Tipo de Orçamento: Novo Produtor vs Recompra

## Resumo
Adicionar campo obrigatório no Passo 1 do orçamento para classificar como "Novo Produtor" ou "Recompra". Essa informação será exibida nos cards de orçamento e alimentará a Dashboard com métricas separadas por tipo.

## Alterações

### 1. Migração SQL
Adicionar coluna `tipo_orcamento` na tabela `orcamentos`:
```sql
ALTER TABLE public.orcamentos ADD COLUMN tipo_orcamento text NOT NULL DEFAULT 'novo_produtor';
```

### 2. Tipos - `src/types/orcamento.ts`
- Adicionar `tipo_orcamento: 'novo_produtor' | 'recompra'` nas interfaces `Orcamento`, `OrcamentoInsert` e `OrcamentoUpdate`

### 3. Componente - `src/components/GerarOrcamentoDialog.tsx`
- Novo state `tipoOrcamento` com default `'novo_produtor'`
- No Step 1, adicionar dois botões toggle estilizados (destacados, obrigatórios) logo no topo: "Novo Produtor" e "Recompra"
- Carregar valor ao editar orçamento existente
- Incluir `tipo_orcamento` no `handleSubmit` (tanto create quanto update)
- Validação: `canGoNext` já exige campos preenchidos; `tipoOrcamento` terá default então sempre estará preenchido

### 4. Cards de orçamento - `src/pages/Orcamentos.tsx`
- Exibir badge "Novo Produtor" (azul) ou "Recompra" (laranja) ao lado do status em cada card da lista

### 5. Kanban - `src/components/OrcamentoKanbanView.tsx`
- Exibir badge de tipo no card do kanban também

### 6. Dashboard - `src/hooks/useDashboardComercial.ts`
- Adicionar `tipo_orcamento` no select da query
- Criar novas métricas por consultor: quantidade e valor de "novo_produtor" vs "recompra" nos orçamentos aprovados
- Expor dados separados para o componente de vendas

### 7. Dashboard UI - `src/components/dashboard/DashboardVendas.tsx` ou `DashboardKPIs.tsx`
- Exibir KPIs ou seção mostrando, por consultor, quanto veio de "Novo Produtor" e quanto de "Recompra"

## Arquivos Modificados
- Migração SQL (nova coluna)
- `src/types/orcamento.ts`
- `src/components/GerarOrcamentoDialog.tsx`
- `src/pages/Orcamentos.tsx`
- `src/components/OrcamentoKanbanView.tsx`
- `src/hooks/useDashboardComercial.ts`
- `src/components/dashboard/DashboardVendas.tsx`

