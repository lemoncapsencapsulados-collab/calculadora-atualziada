## Objetivo

Refinar a aba **Comissionamento** do Painel Administrativo para que:
1. O **status de pagamento do pedido** mostre 3 estados reais: **Pago**, **Parcialmente Pago**, **Atrasado** (além de "Em dia" para pedidos ainda sem parcelas vencidas).
2. Todos os filtros (Mês, Consultor, Status da parcela, Tipo de venda) funcionem corretamente também no bloco **"Pedidos no período"**, incluindo o filtro de **data de pagamento**.
3. As parcelas e datas dos pedidos sejam puxadas corretamente para refletir a comissão devida em cada mês (mês de fechamento vs. parcelas de meses anteriores que caem no mês selecionado).

## Mudanças

### 1) `src/components/admin/RelatorioComissoes.tsx` — Status do pedido

Substituir o badge único "Em dia / Inadimplente" por uma função `statusPedido(parcelasDoPedido)` que devolve:
- **Pago** — todas as parcelas do pedido estão pagas.
- **Atrasado** — existe pelo menos uma parcela `vencido` (data passada e não paga).
- **Parcialmente Pago** — há pelo menos uma parcela paga e ao menos uma ainda pendente (sem atraso).
- **Em dia** — nenhuma paga ainda, nenhuma vencida (pedido novo, parcelas futuras).

Status é calculado sobre **todas as parcelas do pedido** (não apenas as do mês filtrado), para refletir a realidade global do contrato.

Badges com cores semânticas:
- Pago → verde (`bg-emerald-600`)
- Parcialmente Pago → âmbar/secundário
- Atrasado → `destructive`
- Em dia → outline

### 2) Filtros no bloco "Pedidos no período"

Hoje os filtros já são aplicados em `parcelasFiltradas` e os pedidos são derivados delas, mas há 3 problemas:

a) **Filtro de mês com data de pagamento**: parcelas pagas com `data_pagamento` real (quando existir no snapshot) não são consideradas — só o `data_vencimento`. Ajustar `parcelasFiltradas` para casar o mês contra **`data_pagamento` se a parcela estiver paga**, senão `data_vencimento`. Isso permite ver a comissão "do mês em que foi efetivamente recebida".

b) **Filtro de Consultor / Tipo / Status no bloco de pedidos**: garantir que a derivação `linhasPedido` use apenas parcelas que passaram pelos filtros (já é o caso) e que o pedido só apareça se tiver ao menos uma parcela compatível. Corrigir o caso atual em que parcelas `sem_data` aparecem por engano quando `statusFiltro === 'todos'`.

c) **Adicionar coluna/seletor "Data de pagamento"** no filtro: já coberto por (a) — o filtro de Mês passa a representar "mês de pagamento/vencimento". Manter rotulagem clara no `<Label>`.

### 3) Lib `src/lib/comissoes.ts` — propagar data efetiva de pagamento

Estender `ItemComissao` com `dataPagamento: string | null`. Em `expandirPixBoleto` e `expandirCartoes`, ler `p.data_pagamento` / `c.data_pagamento` quando existirem no snapshot (já são gravados pelo `AlterarPagamentoDialog`). Usar essa data como referência de mês quando `pago === true`.

### 4) Resumo por consultor

Recalcular `recebidoMes` e `comissaoPaga` usando a data efetiva de pagamento (não a de vencimento) — assim o resumo mostra o que **realmente entrou no caixa naquele mês**, separado de "Deste mês de fechamento" (primeira parcela) vs. "Parcelas antigas" (parcelas de pedidos antigos pagas neste mês).

## Detalhes técnicos

- Nenhuma migração de banco; tudo é derivado do `orcamento_snapshot` já existente.
- `aplicarStatusPago` continua o mesmo; só leitura é alterada.
- Tipos TS atualizados em `ItemComissao`.
- Nenhuma alteração nos hooks (`usePedidos`), apenas no componente e na lib.

## Fora de escopo

- Não mexer em exclusão de pedidos, RLS, ou outras abas do Painel.
- Não alterar regras de cálculo de comissão (5% nova venda / 1% recompra) nem base líquida.
