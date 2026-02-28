

## Plano: Paginacao server-side na aba Precificacoes Salvas

### Mudancas

#### 1. Novo hook `usePrecificacoesPaginadas`

Criar um hook dedicado para buscar precificacoes com paginacao no banco:

- Aceita `page`, `pageSize` (15) e `searchTerm`
- Query de contagem com filtro por `nome_formula` ou `cliente` via join com `formulas`
- Query de dados com `.range()`, `order('created_at', { ascending: false })` e join `formulas(nome_formula, cliente, tipo_produto)`
- Retorna `{ precificacoes, totalCount, totalPages, isLoading }`

O filtro de busca sera feito no banco usando `or` na tabela `formulas` via relacionamento. Como o Supabase permite filtrar em colunas de tabelas relacionadas usando a sintaxe `formulas.nome_formula`, isso sera usado para manter a busca server-side.

#### 2. Atualizar `PrecificacoesSalvas.tsx`

- Substituir `usePrecificacao` por `usePrecificacoesPaginadas` para a listagem
- Manter `usePrecificacao` apenas para as mutations (deletar)
- Adicionar estado `currentPage` (default 1), resetar para 1 ao mudar `searchTerm`
- Remover filtragem client-side (`precificacoesFiltradas`)
- Adicionar controles de paginacao abaixo da lista: botoes Anterior/Proxima + indicador "Pagina X de Y" + total de resultados

### Detalhes tecnicos

**Novo arquivo: `src/hooks/usePrecificacoesPaginadas.ts`**

```text
usePrecificacoesPaginadas({ page, pageSize, searchTerm })
  -> Query count: precificacoes com join formulas, filtro ilike
  -> Query data: precificacoes com join formulas, order created_at DESC, range
  -> Retorna: { precificacoes, totalCount, totalPages, isLoading }
```

**Arquivo modificado: `src/components/PrecificacoesSalvas.tsx`**

- Importar e usar `usePrecificacoesPaginadas` em vez do `usePrecificacao` para listagem
- Importar `usePrecificacao` apenas para `deletarPrecificacao`
- Adicionar `currentPage` state + `useEffect` para resetar ao mudar busca
- Adicionar componente de paginacao (botoes + indicador) apos a lista de cards
- Invalidar queries de paginacao apos deletar

