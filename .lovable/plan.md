

# Plano: 7 melhorias no fluxo Produto → Precificação → Orçamento

## 1. Custo de rótulo visível na precificação

Na tela de precificação (`Precificacao.tsx`), adicionar linha "Rótulo: R$ 1,00" nos Custos Diretos, separando-o visualmente do total de embalagem. Apenas exibição — o cálculo já inclui.

**Arquivo**: `src/pages/Precificacao.tsx`

## 2. Editar fórmula redireciona ao Calculador com upsert

Ao clicar "Editar" num produto criado, salvar a fórmula em `localStorage('loadFormula')` e navegar para `/calculator`.

No `Calculator.tsx` → `handleSave`: antes de inserir, buscar no banco se já existe uma fórmula com mesmo `cliente` (case-insensitive) e `nome_formula`. Se existir, fazer `update` nessa fórmula em vez de `insert`. Isso evita duplicatas ao editar e re-salvar.

**Arquivos**: `src/pages/Precificacao.tsx`, `src/pages/Calculator.tsx`

## 3. Bloquear precificação abaixo da margem mínima

- **Salvar**: Em `Precificacao.tsx` → `handleSalvar`, verificar se `validacaoMargem?.status === 'baixa'` e bloquear com toast. Desabilitar botão visualmente.
- **Orçamento**: Em `GerarOrcamentoDialog.tsx`, filtrar `precificacoesDisponiveis` para excluir as com margem abaixo do mínimo (usando `MARGENS_CONFIG` ou buscando da tabela `margens_lucro`).

**Arquivos**: `src/pages/Precificacao.tsx`, `src/components/GerarOrcamentoDialog.tsx`

## 4. Botão "Ver Fórmula" em Produtos Precificados

Adicionar botão que abre `VerFormulaDialog` em modo somente leitura (sem `onUpdateFormula`), buscando a fórmula pelo `formula_id`.

**Arquivo**: `src/components/PrecificacoesSalvas.tsx`

## 5. Botão duplicar produto criado e precificado

- **Produto Criado** (`Precificacao.tsx`): Dialog pedindo novo cliente/fórmula, insere cópia no banco.
- **Produto Precificado** (`PrecificacoesSalvas.tsx`): Dialog similar, duplica fórmula e precificação apontando para a nova.

**Arquivos**: `src/pages/Precificacao.tsx`, `src/components/PrecificacoesSalvas.tsx`

## 6. Remover produto avulso na criação de orçamento

Remover o botão "Produto Avulso", os states `showProdutoAvulso`/`produtoAvulso`, o handler `handleAddProdutoAvulso` e o formulário correspondente.

**Arquivo**: `src/components/GerarOrcamentoDialog.tsx`

## 7. POD — valor total não considera custo de pote

Atualmente POD calcula `subtotal = preco_unitario` (quantidade fixa em 1). O pedido do usuário é que o custo por pote apareça normalmente, mas o valor total do orçamento não o considere (como se quantidade de potes = 0).

**Solução**: Quando `modelo_negocio === 'print_on_demand'`, setar `subtotal = 0` e `quantidade = 0` para esse item. O preço unitário continua exibido para referência. No cálculo de `subtotalProducao`, itens POD contribuem com 0.

Atualizar `handleUpdateModeloNegocio` e `handleUpdateItemQuantidade` para refletir isso.

**Arquivo**: `src/components/GerarOrcamentoDialog.tsx`

## Resumo de arquivos

| Arquivo | Mudanças |
|---|---|
| `src/pages/Precificacao.tsx` | Rótulo visível, editar→calculador, bloquear margem baixa, duplicar produto |
| `src/pages/Calculator.tsx` | Upsert: buscar fórmula existente por cliente+nome antes de inserir |
| `src/components/PrecificacoesSalvas.tsx` | Ver fórmula, duplicar precificação |
| `src/components/GerarOrcamentoDialog.tsx` | Remover avulso, filtrar margem baixa, POD subtotal=0 |

