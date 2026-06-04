## Objetivo

Alinhar o bloco "Pedidos no período" do Painel Administrativo → Comissionamento para puxar exatamente os mesmos pedidos exibidos na página **Pedidos** quando os mesmos filtros (consultor + mês) são aplicados. Hoje a página Pedidos filtra por `orcamento_snapshot.data_pagamento` (data de fechamento do pedido) com 1 linha por pedido, enquanto Comissionamento expande cada parcela e inclui o pedido se qualquer parcela cair no mês — por isso aparece mais pedidos para o Everton em maio.

## Mudanças

### 1) `src/components/admin/RelatorioComissoes.tsx` — critério de inclusão do pedido

- Adicionar derivação `pedidoEntraNoMes(pedido, mes)` que olha **apenas** `pedido.orcamento_snapshot.data_pagamento` (substring 0..7 === mes). Mesma regra da página Pedidos.
- Construir `linhasPedido` a partir de `pedidos` (não de `parcelasFiltradas`):
  - Percorrer `pedidos`, manter os que passam em `pedidoEntraNoMes` + filtros de consultor (`snap.consultor_responsavel`) e tipo de venda.
  - Para cada pedido incluído, derivar as parcelas via `derivarComissoes(pedido)` para calcular:
    - `comissaoTotalPedido` = soma de todas as parcelas do pedido.
    - `comissaoNoMes` = soma das parcelas cuja data efetiva (pago→`dataPagamento`, senão `dataVencimento`) caia no mês. Pode ser 0 se nenhuma parcela vence/foi paga no mês — ainda assim o pedido aparece (porque o fechamento foi no mês).
    - `statusPedido` continua calculado sobre todas as parcelas (Pago / Parcialmente Pago / Atrasado / Em dia).
  - Aplicar o filtro de "Status da parcela" como filtro adicional sobre o pedido: o pedido passa se tiver pelo menos uma parcela com aquele status (mantém compatibilidade com o seletor existente).
- Resultado: a lista de pedidos no mês fica 1:1 com `/pedidos` filtrado por consultor + intervalo de datas do mês.

### 2) Resumo por consultor e cards do topo

- Manter a lógica atual baseada em **parcelas que caem no mês** (pagamento efetivo ou vencimento). Esses números refletem caixa/comissão a pagar do mês e **não devem** ser amarrados à data de fechamento, sob pena de quebrar parcelados.
- Adicionar uma legenda curta abaixo do título "Pedidos no período" deixando explícito: *"Lista de pedidos fechados no mês (mesmo critério da página Pedidos). A coluna 'Comissão no mês' considera apenas parcelas com vencimento/pagamento no mês selecionado."*

### 3) Filtro "Status da parcela"

- Continuar funcionando; apenas passa a operar sobre o conjunto de parcelas do pedido já incluído pelo critério de fechamento.

## Fora do escopo

- Não muda cálculo de comissão (regras 5%/1%, base líquida) nem o resumo por consultor.
- Não muda a página `/pedidos`.
- Não muda nenhuma RLS, schema ou edge function.

## Arquivos afetados

- `src/components/admin/RelatorioComissoes.tsx` (único arquivo).
