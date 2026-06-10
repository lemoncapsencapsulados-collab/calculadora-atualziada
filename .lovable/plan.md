## Objetivo

No Passo 2/5 do "Gerar Orçamento", permitir que o usuário selecione precificações existentes (uma a uma) e as marque como **Fórmulas do Catálogo**, fazendo com que passem a aparecer na seção "Fórmulas do Catálogo" desse orçamento e em todos os próximos.

## Como funcionará (UX)

1. Dentro do seletor **"Fórmulas do Catálogo"** (no Passo 2), incluir um novo botão `+ Importar precificação para o Catálogo`.
2. Ao clicar, abre um sub-painel com:
   - Campo de busca por nome de fórmula / cliente.
   - Lista das precificações que **não** estão no catálogo (cliente diferente de "Catálogo"), cada uma com checkbox.
3. Usuário marca uma ou várias e clica em **"Importar X para o Catálogo"**.
4. Confirmação rápida (toast) e a lista de Fórmulas do Catálogo é atualizada na hora; as fórmulas importadas já aparecem disponíveis para seleção no orçamento atual.

## Regra de negócio aplicada

- A marcação é **permanente**: a coluna `cliente` da fórmula vinculada à precificação passa a ser `"Catálogo"`, que é o critério já usado em `isCatalogo(...)` em todo o projeto.
- Nada mais é alterado (preço, custos, snapshot da fórmula permanecem iguais).
- Padrão consistente com a forma como o sistema já identifica catálogo hoje (não cria nova coluna nem nova flag).

## Detalhes técnicos

**Arquivo principal:** `src/components/GerarOrcamentoDialog.tsx`

1. Novos estados:
   - `showImportarCatalogo: boolean`
   - `selectedParaCatalogo: string[]` (ids de precificações)
   - `buscaImportarCatalogo: string`

2. Lista de origem: derivar de `precificacoes` (já carregadas no componente) filtrando `!isCatalogo(p.formulas?.cliente)`.

3. Ação de importar:
   - Coletar `formula_id` distintos das precificações selecionadas.
   - `await supabase.from('formulas').update({ cliente: 'Catálogo' }).in('id', formulaIds)`.
   - Invalidar as queries `['precificacoes']` e `['formulas']` via `queryClient.invalidateQueries` para refletir imediatamente em `precificacoesCatalogo`.
   - Toast de sucesso e fechar o sub-painel.

4. UI: novo botão dentro do card "Fórmulas do Catálogo" (acima do input de busca atual), e um pequeno bloco condicional que renderiza o seletor de precificações não-catalogadas com checkboxes — reaproveitando o mesmo estilo dos seletores já existentes (linhas 887-961).

5. Sem mudanças de schema, sem mudanças em hooks/lib além do componente acima.

## Fora do escopo

- Não cria um novo seletor de "fórmulas" cruas (sem precificação) — apenas precificações já existentes podem virar catálogo, mantendo a coerência com a tela (que trabalha sempre com precificações).
- Não muda comportamento da seção "Precificação Salva".
- Não toca em pedidos, dashboard ou comissões.
