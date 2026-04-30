## Objetivo

Tornar o tipo da recompra explícito **logo no início do popup**, com dois caminhos distintos:

1. **Novo Pedido** (estoque) — fluxo atual: produtos, quantidade, valor, forma de pagamento.
2. **Print on Demand (Registro de Faturamento)** — apenas registro de consumo já ocorrido: produto + intervalo de datas + qtd consumida + valor unitário. **Sem forma de pagamento** (já foi pago no período).

A escolha do tipo passa a ser um filtro/toggle no topo do diálogo, e a UI se adapta — não mais por linha de produto.

## Mudanças

### 1. `AdicionarRecompraDialog.tsx`

- Adicionar **toggle/RadioGroup** no topo: **"Novo Pedido"** vs **"Print on Demand (registro)"**.
- O campo `modeloNegocio` por linha **deixa de existir na UI**. O modelo é definido pelo tipo selecionado no topo e aplicado a todas as linhas.

**Modo "Novo Pedido":**
- Mantém UI atual: lista de produtos com qtd, valor unit.
- Mantém `CondicoesPagamentoForm`.
- Sem campos de período POD.

**Modo "Print on Demand":**
- Para cada produto selecionado, mostrar:
  - Quantidade consumida (potes)
  - Valor unitário (R$)
  - **Período de consumo único** (Início / Fim) — exibido **uma vez no topo da seção de produtos**, não por linha (todas as linhas compartilham o mesmo intervalo, já que representa o faturamento do período).
- **Ocultar** completamente o `CondicoesPagamentoForm`.
- Validação: período obrigatório, fim ≥ início, ao menos 1 produto com qtd > 0.
- Texto do botão muda para **"Registrar Consumo POD"**; cor mantida (laranja).

### 2. `useRecompras.ts` — `criarRecompraComPedido`

- Aceitar novo campo `modo: 'novo_pedido' | 'print_on_demand'` no payload.
- Se `print_on_demand`:
  - Aplicar `modeloNegocio = 'print_on_demand'` a todos produtos.
  - Propagar `podConsumoInicio`/`podConsumoFim` (vindos do nível raiz) para cada produto.
  - **Não exigir** `condicoes_pagamento` (passar `{}` ou marcador `{ pago_no_periodo: true }` no snapshot).
  - No snapshot do pedido gerado: `tipo_orcamento: 'recompra_pod'` (novo subtipo) para diferenciar visualmente do `'recompra'` regular. Quantidades de produção zeradas (regra POD do projeto).
- Se `novo_pedido`: comportamento atual mantido com `tipo_orcamento: 'recompra'`.

### 3. `Pedidos.tsx` — visualização do card

- Reconhecer o novo `tipo_orcamento === 'recompra_pod'` e exibir badge **"Recompra POD"** (cor diferenciada — ex.: roxo/violeta) ao invés do badge laranja "Recompra".
- No resumo do produto, quando POD: mostrar "Faturamento POD: 500 potes (01/04/26 – 30/04/26)" e ocultar bloco de pagamento.

### 4. Tipos

`src/types/dashboard.ts` — `RecompraProduto` já comporta os campos POD; nada a alterar.

Adicionar campo opcional `tipo_recompra?: 'novo_pedido' | 'print_on_demand'` na interface `Recompra` para filtros futuros no Dashboard Comercial (não obrigatório agora, mas facilita).

## Fluxo visual

```text
Popup "Adicionar Recompra"
 ├─ [ Tipo da Recompra ]  ( Novo Pedido | Print on Demand )
 │
 ├─ Cliente (read-only) | Consultor | Data da recompra
 │
 ├─ SE "Print on Demand":
 │    ├─ Período de consumo (Início → Fim)   ← único bloco
 │    └─ Lista de produtos
 │         └─ checkbox | nome | qtd consumida | valor unit
 │    (sem forma de pagamento)
 │
 ├─ SE "Novo Pedido":
 │    ├─ Lista de produtos
 │    │    └─ checkbox | nome | qtd | valor unit
 │    └─ CondicoesPagamentoForm
 │
 ├─ Observação
 └─ Totais + botão "Registrar Consumo POD" ou "Salvar Recompra"
```

## Não está no escopo

- Filtro/visualização separada de POD vs Novo Pedido no Dashboard Comercial (pode vir em iteração seguinte usando `tipo_recompra`).
- Edição posterior do registro POD.
- Migrações no banco — `produtos` e `orcamento_snapshot` são jsonb e já comportam os campos.
