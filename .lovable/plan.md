

# Plano: Pesquisa em tempo real, renomear botão PDF, entregáveis no PDF, webhook de pedidos

## 1. Pesquisa em tempo real (sem debounce)

O padrão usado em "Produto Criado" (`src/pages/Precificacao.tsx`) é filtro client-side com `useMemo` — sem debounce, sem query paginada no servidor. O `searchTerm` filtra diretamente a lista em memória.

**Problema atual**: `PrecificacoesSalvas` e `Orcamentos` usam hooks paginados com `searchTerm` no `queryKey`, causando re-fetch a cada tecla.

**Solução**: Remover o `debouncedSearchTerm` e usar `searchTerm` direto nos hooks paginados, mas com `keepPreviousData: true` no `useQuery` para evitar flickering. Isso mantém os dados anteriores visíveis enquanto a nova query carrega, dando a sensação de filtro em tempo real.

**Arquivos**:
- `src/components/PrecificacoesSalvas.tsx` — remover `debouncedSearchTerm`, passar `searchTerm` direto, remover useEffect de debounce
- `src/pages/Orcamentos.tsx` — idem
- `src/hooks/usePrecificacoesPaginadas.ts` — adicionar `placeholderData: keepPreviousData` 
- `src/hooks/useOrcamentosPaginados.ts` — idem nos dois hooks

## 2. Renomear botão "Gerar Orçamento" → "Gerar PDF"

**Arquivo**: `src/pages/Orcamentos.tsx` (linha 332)
- Alterar texto de `Gerar Orçamento` para `Gerar PDF`

## 3. Incluir entregáveis no PDF de orçamento

**Arquivo**: `src/lib/orcamentoGenerator.ts` (função `renderServicos`, ~linha 384)
- Após a tabela de serviços, iterar sobre `servico.entregaveis` (quando existirem)
- Para cada serviço, listar os entregáveis inclusos (`incluso === true`) com nome e quantidade
- Renderizar como sub-lista ou linhas adicionais na tabela de serviços

## 4. Webhook POST ao criar/editar pedido

**Arquivo**: `src/hooks/usePedidos.ts`
- Criar função auxiliar `notifyWebhook(snapshot)` que faz `fetch('https://n8n.lemoncaps.com.br/webhook/request-order', { method: 'POST', body: JSON.stringify(snapshot) })`
- Chamar no `onSuccess` de:
  - `createPedido` (linha 174)
  - `createPedidoFromOrcamento` (linha 224)
  - `updateStatus` (linha 246) — enviar snapshot atualizado
  - `updateObservacoes` (linha 268) — enviar snapshot atualizado
- Tratamento: fire-and-forget (não bloquear o fluxo se o webhook falhar), apenas `console.error` em caso de erro

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/PrecificacoesSalvas.tsx` | Remover debounce, usar searchTerm direto |
| `src/pages/Orcamentos.tsx` | Remover debounce, renomear botão para "Gerar PDF" |
| `src/hooks/usePrecificacoesPaginadas.ts` | Adicionar `placeholderData: keepPreviousData` |
| `src/hooks/useOrcamentosPaginados.ts` | Adicionar `placeholderData: keepPreviousData` |
| `src/lib/orcamentoGenerator.ts` | Listar entregáveis inclusos na seção de serviços do PDF |
| `src/hooks/usePedidos.ts` | Adicionar chamada webhook POST ao criar/editar pedido |

