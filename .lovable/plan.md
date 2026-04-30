## Objetivo

Em **Pedidos → Visão Geral**, adicionar em cada card de pedido um botão **"Adicionar Recompra"**. Ao clicar, abre um popup pré-preenchido com os dados do cliente/consultor do pedido original onde o usuário escolhe:

- Produto(s) que entram na recompra (vindos do próprio pedido)
- Quantidade e valor unitário de cada produto
- Modelo de negócio: **Estoque** ou **Print on Demand**
- Forma/condições de pagamento
- (Opcional) Observação

Ao salvar, o sistema cria **dois registros**:

1. Um novo **pedido** (PED-XXX) vinculado ao mesmo cliente, herdando consultor e dados do pedido original. Esse pedido aparece como mais um card na Visão Geral.
2. Um registro em **`recompras`** (alimenta o Dashboard Comercial existente).

### Regra POD: consumo em período personalizado

Quando o modelo selecionado for **Print on Demand**, cada produto exibe campos extras:
- Quantidade de potes consumidos
- Período: data inicial e data final (ex.: 01/04/2026 → 30/04/2026)

Esses dados são gravados no produto da recompra/pedido para histórico de consumo. Em POD, a quantidade do pedido fica zerada (regra do projeto), mas o consumo no período fica registrado.

## Mudanças propostas

### 1. Tipos
`src/types/dashboard.ts` — estender `RecompraProduto`:
```ts
interface RecompraProduto {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  modeloNegocio?: 'estoque' | 'print_on_demand';
  // Apenas POD
  podConsumoQuantidade?: number;
  podConsumoInicio?: string; // YYYY-MM-DD
  podConsumoFim?: string;    // YYYY-MM-DD
  // Referência ao item original do pedido (opcional)
  precificacaoId?: string;
}
```

### 2. Novo componente `src/components/pedidos/AdicionarRecompraDialog.tsx`
Popup com os passos:
- **Cabeçalho**: Cliente (read-only do pedido), Consultor (editável), Data da recompra (DatePicker, default hoje).
- **Produtos**: lista pré-carregada a partir de `pedido.orcamento_snapshot.itens_producao`. Usuário marca quais entram, ajusta quantidade, valor unitário e escolhe modelo (Estoque / POD).
  - Se POD: aparecem 3 inputs (Qtd consumida, Início, Fim) usando o DatePicker padrão (`Calendar` em `Popover` com `pointer-events-auto`).
- **Pagamento**: reutilizar componente já existente `CondicoesPagamentoForm` (mesmo usado no orçamento), gravando o objeto `condicoes_pagamento` no snapshot do novo pedido.
- **Observação**: textarea opcional.
- **Totais**: soma automática quantidade + valor.

### 3. Hook `useRecompras` — extensão
Adicionar mutation `criarRecompraComPedido` que:
1. Faz `INSERT` em `recompras` (já existe).
2. Faz `INSERT` em `pedidos` montando um `orcamento_snapshot` "sintético" com:
   - `tipo_orcamento: 'recompra'`
   - `nome_cliente`, `consultor_responsavel`, `dados_cliente` herdados do pedido original
   - `itens_producao` derivados dos produtos selecionados (com `modelo_negocio` e — em POD — quantidade zerada conforme regra do projeto, e `dados_extras` guardando consumo POD)
   - `condicoes_pagamento` do formulário
   - `valor_total`, `subtotal_producao`, `subtotal_servicos: 0`
   - `numero_orcamento` placeholder do tipo `RECOMPRA-{numero_pedido_origem}-{nº}`
3. Numera o pedido com `PED-XXX` (mesma função `getNextPedNumber`).
4. Invalida queries de `pedidos` e `recompras` para que o novo card apareça imediatamente na Visão Geral.

### 4. Botão no card do pedido (`src/pages/Pedidos.tsx`)
- Acrescentar botão **"Adicionar Recompra"** (ícone `RefreshCw` ou `RotateCcw`) na barra de ações do card, dentro do bloco da Visão Geral. Mostrar apenas para pedidos com `orcamento_snapshot` (recompra precisa do contexto de cliente/itens).
- Ao clicar, abre `AdicionarRecompraDialog` com o pedido como contexto.

### 5. Visualização no card gerado
Como reaproveitamos o snapshot atual de pedido + `tipo_orcamento: 'recompra'`, o card já será exibido com o badge "Recompra" laranja existente (já renderizado em `renderOrcamentoPedido`). Em POD, mostraremos no resumo do produto a linha "Consumo: 500 potes (01/04/26–30/04/26)".

## Detalhes técnicos

```text
AdicionarRecompraDialog
 ├─ Cliente / Consultor / DatePicker(Data)
 ├─ Lista de produtos pré-preenchidos do pedido original
 │    ├─ checkbox incluir
 │    ├─ qtd, valor unit
 │    ├─ select modelo (Estoque | POD)
 │    └─ se POD:
 │         ├─ qtd consumida (input number)
 │         ├─ DatePicker início
 │         └─ DatePicker fim  (validação: fim >= início)
 ├─ CondicoesPagamentoForm (existente)
 ├─ Observação
 └─ Totais + Salvar
```

Persistência:
- `recompras.produtos` (jsonb) recebe array com novos campos.
- `pedidos.orcamento_snapshot` (jsonb) recebe um snapshot sintético com `tipo_orcamento='recompra'` e `itens_producao[].dados_extras = { pod_consumo_qtd, pod_consumo_inicio, pod_consumo_fim }`.
- Sem migração: ambos os campos já são jsonb. Datas em formato `YYYY-MM-DD` (regra do projeto).

Validações:
- Pelo menos 1 produto com qtd > 0 e valor > 0.
- POD: período obrigatório com `fim >= início`.
- Consultor obrigatório.

## Não está no escopo

- Mexer no fluxo de orçamento original.
- Disparar webhook n8n para a nova recompra (manter comportamento atual de pedidos é suficiente — o `INSERT` em `pedidos` já dispara o sync existente).
- Edição posterior do consumo POD (pode ser próxima iteração).
