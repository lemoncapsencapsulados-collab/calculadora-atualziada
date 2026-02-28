
# Drag and Drop no Kanban de Orcamentos

## Resumo
Implementar drag and drop nativo (HTML5 Drag and Drop API) no componente `OrcamentoKanbanView` para permitir arrastar cards entre colunas, alterando automaticamente o status do orcamento. Cada coluna ordenara os cards do mais recente para o mais antigo.

## Alteracoes

### 1. Componente `OrcamentoKanbanView.tsx`
- Adicionar prop `onStatusChange: (id: string, newStatus: string) => void` na interface
- Implementar drag and drop usando a API nativa do HTML5 (sem bibliotecas externas):
  - `onDragStart` no card: armazena o `id` do orcamento no `dataTransfer`
  - `onDragOver` na coluna: permite o drop com `preventDefault()`
  - `onDrop` na coluna: recupera o `id` e chama `onStatusChange(id, colStatus)`
  - Estado visual de destaque na coluna durante o drag (borda/fundo diferente)
- Ordenar os items de cada coluna por `created_at` decrescente (mais recente primeiro)
- Adicionar `cursor-grab` nos cards para indicar que sao arrastáveis

### 2. Pagina `Orcamentos.tsx`
- Passar a prop `onStatusChange={handleStatusChange}` ao `OrcamentoKanbanView`
- A funcao `handleStatusChange` ja existe e chama `updateStatus.mutateAsync` + `invalidateAll()`

## Detalhes Tecnicos

Nao sera necessario instalar nenhuma biblioteca adicional. A API nativa de drag and drop do HTML5 e suficiente para este caso de uso simples (sem reordenacao dentro da mesma coluna, apenas movimentacao entre colunas).

**Arquivos modificados:**
- `src/components/OrcamentoKanbanView.tsx` - adicionar drag/drop e ordenacao
- `src/pages/Orcamentos.tsx` - passar prop onStatusChange
