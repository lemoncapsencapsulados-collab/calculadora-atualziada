# Recompra Print on Demand → calcular faturamento e marcar como pago

## O que muda (comportamento)

Hoje, ao salvar uma recompra no modo **Print on Demand**, o cartão do pedido criado mostra **TOTAL = R$ 0,00**, porque o snapshot zera quantidade e subtotal dos itens POD. Vamos ajustar para que:

1. Cada produto POD tenha o cálculo: **faturamento = quantidade de potes consumidos × custo por pote**.
2. A soma dos produtos selecionados gere o **valor_total do pedido**, exibido em destaque no campo **TOTAL** do card em "Pedidos → Visão Geral".
3. O pedido POD seja registrado como **PAGO** (data de pagamento = data do registro da recompra) e identificado como tal no card, já que o pagamento ocorreu dentro do período informado.
4. O selo "Recompra POD" continua aparecendo, mas agora acompanhado do valor de faturamento real (ex.: *Recompra POD — R$ 12.500,00 — Pago em 30/04/2026*).

## Onde mexer (técnico)

### 1. `src/hooks/useRecompras.ts` — `criarRecompraComPedido`
- Remover o "zerar" do POD nos itens do snapshot. Hoje:
  ```ts
  const qtd = isPOD ? 0 : p.quantidade;
  const subtotal = isPOD ? 0 : (p.quantidade * p.valorUnitario);
  ```
  Passar a usar **sempre** `p.quantidade` e `p.quantidade * p.valorUnitario`, mantendo `pod_consumo_quantidade/inicio/fim` para os itens POD (rastreabilidade do período).
- Com isso, `subtotalProducao` e `valor_total` do snapshot já refletem o faturamento POD automaticamente.
- Em `pedidos.insert`, manter `quantidade_produto = quantidadeTotal` (já faz isso).
- Para POD, definir o pedido como pago:
  - `status: 'concluido'` (em vez de `aguardando_producao`), pois não há produção a executar — é apenas registro de faturamento.
  - `novoSnapshot.data_pagamento` continua sendo a data da recompra (já preenchido).
  - `condicoes_pagamento` do snapshot: passar a gravar `{ pago_no_periodo: true, periodo_inicio, periodo_fim }` para o card poder mostrar o período.

### 2. `src/pages/Pedidos.tsx` — card da Visão Geral
- O campo TOTAL (`snap.valor_total`) passará a refletir o faturamento POD automaticamente, sem código novo.
- Adicionar, no badge/linha "Recompra POD", um sufixo "Pago" (verde) quando `tipo_orcamento === 'recompra_pod'`, e exibir o período de consumo logo abaixo (já existe a renderização das datas POD por item; manteremos).
- Exportações CSV/PDF que dependem de `snap.valor_total` passam a contar o faturamento POD corretamente — nenhuma mudança extra necessária.

### 3. `src/components/pedidos/AdicionarRecompraDialog.tsx`
- Trocar o rótulo do bloco de total no modo POD de "Faturamento do período" para algo mais explícito: **"Faturamento POD (qtd × valor unit.)"**, deixando claro que esse valor irá para o TOTAL do pedido como já pago.
- Pequeno texto de apoio: *"Este valor será registrado como faturamento já recebido no período informado."*

### 4. Subpáginas de entregáveis e demais telas
- Como recompras POD são apenas registro de faturamento (não geram entregáveis de setup), nada muda em `SubpaginaEntregaveis` / `DemandasSetupResumo`. O filtro atual já ignora tipos `recompra*` para entregáveis de setup; manteremos.

## Resultado esperado

```text
[ Card do Pedido — Cliente X ]
  PED-042  •  Recompra POD  •  Pago em 30/04/2026
  Período: 01/04/2026 – 30/04/2026
  Produto Y — 500 potes × R$ 25,00
  --------------------------------
  TOTAL                      R$ 12.500,00
```

Nenhuma migração de banco é necessária — os dados antigos com `valor_total = 0` permanecem como estão; novos registros POD passam a vir com o faturamento correto.