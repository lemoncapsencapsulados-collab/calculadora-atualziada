## Objetivo

No Excel exportado em **Pedidos**, corrigir duas coisas em `src/lib/relatoriosPedidos.ts` (única alteração — sem mexer em UI, CSV, PDF ou regras de comissão):

1. **Formato de data BR (dd/mm/aaaa)** em todas as células de data das 5 abas.
2. **Colunas mensais de pagamento** na aba `Pedidos`, com o valor recebido de cada pedido distribuído por mês.

## 1. Formato de data dd/mm/aaaa

Hoje as datas são gravadas como `Date` nativas sem `numFmt`, então o Excel exibe no locale do sistema (frequentemente mm/dd/aaaa em contas em inglês). Vou aplicar `z: 'dd/mm/yyyy'` (e `t: 'd'`) em **todas** as células de data das abas:

- **Pedidos**: `Data 1ª Parcela`, `Data Última Parcela`, `Data Pagamento (aprovação)`
- **Parcelas**: `Data Vencimento`, `Data Pagamento`
- **Detalhamento por Pedido**: `Data Pedido`, `Data Pagamento`, vencimentos e pagamentos da tabela de parcelas

As colunas `Mês/Ano Vencimento` e `Mês/Ano Pagamento` continuam como texto — mas passam de `YYYY-MM` para **`MM/AAAA`** (padrão BR), mantendo a ordenação correta via coluna auxiliar oculta `Ordem Mês` (`YYYYMM` numérico) para AutoFilter/ordenamento.

## 2. Colunas mensais na aba `Pedidos`

Depois das colunas de pagamento atuais (`… | Status Pagamento`), adicionar N colunas dinâmicas, uma para cada mês em que houve/haverá pagamento no conjunto de pedidos exportado:

```text
… | Status Pagamento | 01/2026 | 02/2026 | 03/2026 | … | 12/2026 | 01/2027 | …
```

Regras de preenchimento (linha-resumo de cada pedido; linhas-filhas de produtos ficam vazias):

- Percorre `derivarRecebimentos(pedido)` de cada pedido.
- Para cada parcela, escolhe o **mês de referência**:
  - `pago` → mês da `data_pagamento`
  - demais status → mês do `data_vencimento`
  - `sem_data` → não entra em nenhuma coluna
- Soma o `valor` (bruto, com juros — mesmo total já exibido em `Valor Bruto`) na célula do mês correspondente.
- Formato BRL (`"R$" #,##0.00;[Red]("R$" #,##0.00);-`), zeros mostrados como `-`.

O conjunto de meses é calculado varrendo todos os pedidos exportados (união de todos os meses referenciados), ordenado cronologicamente. Se nenhum pedido tem parcelas datadas, nenhuma coluna mensal é adicionada.

**Validação:** para cada linha-resumo, `SUM(colunas mensais) == Valor Bruto` do pedido (exceto parcelas sem data, que ficam de fora — mesma regra usada na aba `Entradas por Mês`).

Também vou adicionar as mesmas colunas mensais na aba `Comissões por Consultor / Mês` no formato `MM/AAAA` para manter a consistência de formato de data em todo o workbook (mudança de rótulo apenas).

## Fora do escopo

- Nada muda em UI, CSV, PDF, edge functions ou regras de comissão.
- Aba `Detalhamento por Pedido` continua com o mesmo layout — só as datas passam a exibir dd/mm/aaaa.
