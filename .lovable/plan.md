## Objetivo

Permitir alterar **data de pagamento** e **forma/condições de pagamento** de cada pedido, com proteção por senha (`021200`) e histórico visível das alterações no Pedido, em **Sucesso do Cliente** e no **Dashboard**.

## Mudanças

### 1. Banco (migration)
Adicionar coluna em `pedidos`:
- `pagamento_alteracoes jsonb NOT NULL DEFAULT '[]'`

Cada entrada do array:
```
{
  "alterado_em": "2026-05-12T...",
  "alterado_por": "<email do usuário logado, se houver>",
  "data_pagamento_anterior": "...",
  "data_pagamento_nova": "...",
  "condicoes_anteriores": { ... },
  "condicoes_novas": { ... },
  "resumo_anterior": "PIX à vista R$ ...",
  "resumo_novo": "Cartão 3x R$ ..."
}
```

Sem mudanças em RLS (já permite UPDATE para autenticados).

### 2. Novo componente `src/components/pedidos/AlterarPagamentoDialog.tsx`
- Gate de senha `021200` (mesmo padrão do `ConfirmarExclusaoPedidoDialog`).
- Após senha correta, exibe:
  - Campo data de pagamento (DatePicker shadcn).
  - Reuso do `CondicoesPagamentoForm` para editar `condicoes_pagamento`.
- Ao salvar: atualiza `pedidos.orcamento_snapshot` (mesclando `data_pagamento` e `condicoes_pagamento`) e faz `append` em `pagamento_alteracoes` com snapshot anterior/novo + `formatarPagamentoResumo` para os textos.
- Toast de sucesso e fechamento.

### 3. `src/pages/Pedidos.tsx`
- Botão "Alterar pagamento" (ícone `Pencil` ou `CreditCard`) em cada cartão de pedido, ao lado dos botões existentes, com `e.stopPropagation()`.
- Estado controlado `pedidoParaEditarPagamento` e única instância do `AlterarPagamentoDialog` no fim da página (mesmo padrão usado para exclusão).
- Quando `pagamento_alteracoes.length > 0`, mostrar badge pequeno "Pagamento alterado (N)" no cartão.

### 4. `src/components/DetalhesPedidoDialog.tsx`
- Nova seção **"Histórico de alterações de pagamento"** listando cada entrada: data/hora, autor, "De: <resumo anterior> → Para: <resumo novo>", e datas de pagamento antes/depois.
- Botão "Alterar pagamento" no cabeçalho do diálogo abrindo o mesmo `AlterarPagamentoDialog`.

### 5. `src/hooks/usePedidos.ts`
- Incluir `pagamento_alteracoes` no mapeamento e na interface `Pedido`.
- Nova função `alterarPagamentoPedido(pedidoId, { data_pagamento, condicoes_pagamento })` que:
  - Lê snapshot atual.
  - Monta entrada de auditoria.
  - Faz `update` em `pedidos` mesclando `orcamento_snapshot` e adicionando ao array.
  - Invalida queries.

### 6. Sucesso do Cliente — `src/pages/SucessoCliente.tsx` / `ProjetoDetalheDialog.tsx`
- Já consome `orcamento_snapshot.data_pagamento`, então a alteração já reflete automaticamente.
- Adicionar, no `ProjetoDetalheDialog`, a mesma seção "Histórico de alterações de pagamento" lendo `pedido.pagamento_alteracoes`.
- Se houver alterações, mostrar badge no `ProjetoCard` ("Pagamento alterado").

### 7. Dashboard — `src/pages/DashboardComercial.tsx` e widgets
- Métricas usam `data_pagamento` do snapshot, então refletem a alteração automaticamente após `queryClient.invalidateQueries`.
- Em `DashboardVendas` (ou painel equivalente que liste pedidos pagos), incluir indicador "Pagamento alterado em DD/MM/AAAA" para pedidos com `pagamento_alteracoes.length > 0`, com tooltip mostrando última alteração (de → para).

### 8. Tipos
- Atualizar `PedidoSnapshotPagamentoAlteracao` em `src/types` (ou inline em `usePedidos.ts`).

## Não escopo
- Não altera lógica de cálculo de valores nem fluxo de exclusão.
- Não altera regras de juros/parcelamento já existentes em `CondicoesPagamentoForm`.
- Senha continua client-side (mesmo padrão atual do projeto). Se desejar gate server-side, é trabalho separado.
