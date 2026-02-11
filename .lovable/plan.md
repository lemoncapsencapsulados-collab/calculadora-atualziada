

## Plano: Precisao de 5 casas decimais para precos

### Problema

O campo de preco de embalagens no inventario usa `step="0.01"`, limitando a entrada a 2 casas decimais. Uma capsula que custa R$ 0,018 e arredondada para R$ 0,02, gerando distorcao significativa em grandes volumes.

### Alteracoes

#### 1. `src/pages/Inventario.tsx` - Campo de preco de embalagens

Alterar o input de preco de embalagem:
- `step="0.01"` para `step="0.00001"`
- `placeholder="0.00"` para `placeholder="0.00000"`

#### 2. `src/lib/unitConversion.ts` - Exibicao de valores

A funcao `formatCurrency` ja suporta ate 13 casas decimais (`maximumFractionDigits: 13`), entao os calculos e exibicao de valores detalhados ja funcionam corretamente. Nenhuma alteracao necessaria aqui.

#### 3. `src/pages/Inventario.tsx` - Exibicao do preco na listagem

Atualmente usa `formatCurrency(embalagem.preco_unitario)` que ja suporta precisao. Nenhuma alteracao necessaria na exibicao.

#### 4. `supabase/functions/import-inventory/index.ts` - Tolerancia de comparacao

A comparacao de precos na importacao usa tolerancia de `0.01`:
```
Math.abs(existing.preco_unitario - embalagem.preco_unitario) > 0.01
```
Alterar para `0.00001` para respeitar a nova precisao.

#### 5. Outros campos com `step="0.01"` (escopo completo)

Como voce mencionou que "essa linha de raciocinio serve para tudo", os seguintes campos tambem serao atualizados para `step="0.00001"`:

| Arquivo | Campo |
|---------|-------|
| `src/pages/Inventario.tsx` | Preco embalagem |
| `src/components/EditarPrecificacaoDialog.tsx` | Custo MP, Custo Embalagem, Preco Venda |
| `src/components/GerarOrcamentoDialog.tsx` | Preco produto avulso, Valor servico |
| `src/components/DetalhamentoFreteDialog.tsx` | Valor do plano |
| `src/components/dashboard/NovaRecompraDialog.tsx` | Valor unitario |
| `src/pages/Precificacao.tsx` | Custos indiretos, valor input, servicos extras |
| `src/components/CondicoesPagamentoForm.tsx` | Valor entrada, valor termino |

#### 6. Banco de dados

A coluna `preco_unitario` na tabela `embalagens` ja e do tipo `numeric` sem restricao de casas decimais, entao aceita qualquer precisao. Nenhuma migracao necessaria.

### Resumo

- Todas as entradas numericas de valores monetarios passam a aceitar ate 5 casas decimais
- A exibicao ja suporta precisao alta (formatCurrency com ate 13 casas)
- O banco de dados ja suporta (tipo numeric)
- A importacao passa a respeitar a nova precisao

