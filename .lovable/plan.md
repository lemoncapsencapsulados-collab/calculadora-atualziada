## Nova aba "Comissionamento" no Painel Administrador

### Regras de negócio (confirmadas)
- **5%** para pedidos do tipo NOVA VENDA, **1%** para RECOMPRA.
- Base de cálculo: **valor líquido da parcela** (descontando juros de cartão — usa `valor_base` da parcela antes do `1 + taxa`).
- Comissão só é apurada **quando a parcela é marcada como paga** (`pago = true` na condição de pagamento).
- Inadimplência: parcela vencida (data < hoje) e não paga.

### O que será construído

#### 1. Nova aba no Painel Administrador
- Em `src/pages/PainelAdministrador.tsx`, adicionar `TabsTrigger value="comissoes"` → "Comissionamento" e respectivo `TabsContent`.
- Novo componente: `src/components/admin/RelatorioComissoes.tsx`.

#### 2. Lib de cálculo de comissão
- Novo arquivo `src/lib/comissoes.ts` que reaproveita `derivarRecebimentos` (já existe em `src/lib/recebimentos.ts`) e expõe:
  - `derivarComissoes(pedido)` → lista de itens `{ parcelaIndice, descricao, data, valorBruto, valorLiquido, percentual, comissao, status, isRecompra }`.
  - `valorLiquido` = base sem juros de cartão (recalcular usando a mesma lógica de `recebimentos.ts`, mas sem `1 + taxa`).
  - `percentual` = 1% se pedido for recompra, senão 5%.
  - Identificação de recompra: presença de `origem_recompra_id` no pedido ou flag `is_recompra` no snapshot. Caso o sistema não marque explicitamente hoje, a regra cobre via tabela `recompras` cruzada com o pedido.

#### 3. Filtros do relatório (topo da tela)
- **Mês de referência** (mês/ano) — padrão: mês atual.
- **Consultor** (combobox, opção "Todos").
- **Status da parcela**: Pagas, A vencer, Vencidas (inadimplência), Todas.
- **Tipo**: Nova venda, Recompra, Todas.

#### 4. Visão "Por consultor" (cards/resumo no topo)
Para cada consultor com movimentação no mês filtrado:
- Total recebido no mês (R$).
- Comissão apurada no mês (R$) — soma das parcelas **pagas** com data dentro do mês.
- Comissão a vencer no mês (R$) — parcelas com vencimento no mês ainda não pagas.
- Comissão inadimplente (R$) — parcelas vencidas e não pagas.
- Quebra: "Deste mês" vs "Parcelas de meses anteriores" (separa comissão de venda fechada no mês × parcelas de vendas anteriores), atendendo ao pedido explícito do usuário.

#### 5. Lista de pedidos (tabela)
Colunas: Consultor • Cliente • CPF/CNPJ • Nº pedido • Valor total • Forma de pagamento • Comissão total do pedido • Comissão no mês filtrado • Status (Em dia / Inadimplente) • Ações.

Ações por linha:
- **Ver detalhes** → abre dialog com:
  - Cabeçalho do pedido (cliente, doc, consultor, valor, método, tipo NOVA/RECOMPRA).
  - Tabela de parcelas: nº, vencimento, valor bruto, valor líquido (base comissão), %, comissão, status (pago/pendente/vencido), botão **marcar como pago / desmarcar** (já existe via update em `condicoes_pagamento` JSONB).
  - Totais: comissão paga, a vencer, inadimplente.
- **Editar pedido** → abre dialog reutilizando `AlterarPagamentoDialog` (senha `021200`) **estendido** para também editar o **valor total do pedido**. A edição grava em `orcamento_snapshot` (campos `valor_total` e `condicoes_pagamento`) e registra entrada em `historico_pagamento` já existente. Itens/fórmulas permanecem intactos.
- **Confirmar pagamento** → atalho que abre o detalhe focado na primeira parcela pendente do mês.

#### 6. Exportação
- Botão "Exportar CSV" com as linhas filtradas (pedido × parcela), pronto para conferência de folha.

### Detalhes técnicos

- **Identificação de recompra:** consultar `recompras` (tabela já existe) com `pedido_id` ou usar campo `tipo` no snapshot se houver. Caso ausente, derivar via existência de `origem_pedido_id`.
- **Marcar parcela como paga:** já existe a flag `pago` nas estruturas `ParcelaPixBoleto` e `CartaoPagamento` (`src/types/orcamento.ts`). A ação fará `UPDATE pedidos SET orcamento_snapshot = jsonb_set(...)`.
- **Edição de valor total:** ajustar `AlterarPagamentoDialog` adicionando um campo opcional "Novo valor total" (visível apenas quando aberto a partir de Comissionamento, via prop `permitirEditarValor`). Mantém senha `021200`. Persiste em `orcamento_snapshot.valor_total` e propaga recálculo das parcelas percentuais automaticamente (as parcelas com `tipo_valor = 'fixo'` permanecem; as `'percentual'` recalculam sobre o novo total).
- **Sem mudanças de schema:** tudo opera sobre `pedidos.orcamento_snapshot` (JSONB) e `recompras`. Não há nova tabela.
- **Performance:** o relatório carrega todos os pedidos do intervalo do filtro (não da página atual) — query direta em `pedidos` filtrando por mês de qualquer parcela (lado cliente, igual ao módulo Sucesso do Cliente faz hoje).

### Fora de escopo
- Não altera fluxo de criação de orçamento/pedido.
- Não mexe em PDFs, webhooks n8n, nem em precificações salvas.
- Não cria sistema separado de "folha de pagamento de consultores" — apenas relatório de apuração.
