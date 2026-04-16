

## Plano: Adicionar informações de método de pagamento nos Detalhes, WhatsApp e PDF de Pedidos

### Problema
As condições de pagamento (`condicoes_pagamento`) já estão salvas no `orcamento_snapshot` do pedido, mas:
- Os **Detalhes do Pedido** só mostram campos legados (valor_entrada/termino) e ignoram os novos campos (metodo_principal, parcelas_pix_boleto, cartoes, misto)
- O **Copiar Relatório WhatsApp** não inclui nenhuma informação de pagamento
- O **Relatório PDF** não inclui informação de pagamento

### Estrutura dos dados de pagamento
O `condicoes_pagamento` pode conter:
- `metodo_principal`: `'pix_boleto'`, `'cartao_credito'` ou `'misto'`
- `parcelas_pix_boleto`: array de parcelas com tipo_valor e valor
- `cartoes`: array com valor, parcelas e tipo_valor
- Campos `misto_*` para pagamento misto
- Tabela de juros: 1-3x sem juros, 4x 7%, 5x 8%, 6x 9%

### Alterações

**1. `src/components/DetalhesPedidoDialog.tsx`** — Seção "Condições de Pagamento" completa
- Substituir a condição atual (que só mostra se tem valor_entrada ou valor_termino) por uma que detecta qualquer dado de pagamento
- Exibir método principal (Pix/Boleto, Cartão de Crédito, Misto)
- Listar parcelas Pix/Boleto com valores
- Listar cartões com número de parcelas e valores
- Para misto, mostrar ambas as seções
- Manter compatibilidade com campos legados

**2. `src/pages/Pedidos.tsx`** — Função `copiarRelatorioWhatsApp`
- Adicionar bloco de texto com forma de pagamento após a comissão
- Formato: "Forma de pagamento: Cartão de Crédito - 6x de R$ 1.200,00 (juros de 9%)" ou "Pix/Boleto - 2 parcelas" etc.

**3. `src/lib/relatoriosPedidos.ts`** — PDF e Excel
- Extrair dados de pagamento no `extractData`
- Adicionar seção "Condições de Pagamento" no PDF após serviços/total
- Adicionar colunas de pagamento no Excel

### Função auxiliar
Criar uma função `formatarCondicoesPagamento(condicoes)` reutilizável que retorna um array de strings descritivas, usada nos 3 locais.

### Arquivos modificados
- `src/components/DetalhesPedidoDialog.tsx`
- `src/pages/Pedidos.tsx`
- `src/lib/relatoriosPedidos.ts`

