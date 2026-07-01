## Ajustes no fluxo "Confirmar Pagamento" e "Detalhamento de Frete"

### 1. Popup de aprovação para "Pago" — `src/components/AprovacaoOrcamentoDialog.tsx`

**CNPJ obrigatório + auto-preenchimento**
- A busca automática por CNPJ (via BrasilAPI) já dispara quando são digitados 14 dígitos. Vou apenas reforçar UX:
  - Marcar o campo CNPJ visualmente como obrigatório (asterisco) na seção PJ.
  - Manter validação já existente (`CNPJ` e `CNPJ inválido` em `camposFaltando`) — nenhuma mudança de regra necessária, apenas garantir que o auto-fill preenche Razão Social, Endereço, CEP, Cidade e Estado imediatamente ao completar 14 dígitos.
  - Adicionar feedback visual (spinner) enquanto `isSearchingCnpj` está ativo.

**Detalhamento de produção deixa de ser obrigatório**
- Remover do bloco de validação (`handleConfirmAprovacao`) todas as entradas em `camposFaltando` referentes a: `Cor da Tampa`, `Cor do Pote`, `Sabor`, `Cor do Conteúdo` e `Observação de Produção`.
- Os campos continuam existindo no formulário para preenchimento opcional; o que for preenchido continua sendo salvo em `itens_producao[i].detalhes_producao`.

### 2. Detalhamento de Frete — `src/components/DetalhamentoFreteDialog.tsx` e mesma seção dentro de `AprovacaoOrcamentoDialog.tsx`

**Nova opção padronizada de logística**
- Substituir a lista atual de rádios ("Todo envio para o Produtor", "Toda logística via Lemon Caps", "Envio Parcial") por três opções com textos revisados. A opção principal que o cliente pediu passa a ser exatamente:
  - "Enviar produção completa para o Produtor, Lemon Caps fará a logística enviando para cliente final."
- Manter também as opções "Toda logística via Lemon Caps" e "Envio Parcial" (com descrição livre) para não quebrar históricos existentes. O texto novo será exibido como a opção principal/recomendada.

**Remover "usar tabela tradicional de envio"**
- Excluir o bloco de rádios `Usar tabela tradicional de envio?` e o Card que renderiza a `TABELA_FRETE`.
- Remover o estado `usaTabelaTradicional`, o rádio "Frete com a Lemon Caps fazendo direto para o cliente final?" e todos os controles de "Planos de Envio Personalizados" (o card com Selects de `tipo_produto`, `plano`, `valor` e a lista de `planosCustomizados`).
- Ao salvar `DetalhamentoFrete`, gravar `usa_tabela_tradicional: false` e `planos_customizados: []` para preservar compatibilidade com o tipo.
- Mesma limpeza dentro do `AprovacaoOrcamentoDialog.tsx` (bloco "Detalhamento de Frete").

### 3. Condições de Pagamento seguem para "Pedidos"

Análise: `condicoes_pagamento` já é gravada em `orcamentos` no `handleConfirmAprovacao` (linha 507) e copiada para o `orcamento_snapshot` do pedido em `createPedidoFromOrcamento` (`src/hooks/usePedidos.ts`). O `DetalhesPedidoDialog.tsx` já lê `snap.condicoes_pagamento`.

- Verificar visualmente que o `DetalhesPedidoDialog.tsx` exibe todos os detalhes (método principal, parcelas Pix/Boleto, cartões, datas, valores, status pago) usando `formatarPagamentoResumo`/`HistoricoPagamentoLista`. Se algum campo estiver oculto (ex.: datas de vencimento por parcela), acrescentar a exibição para garantir que "todas as informações detalhadas solicitadas nessa etapa" apareçam no Pedido.

### Arquivos afetados
- `src/components/AprovacaoOrcamentoDialog.tsx` (validação, UI CNPJ, bloco frete)
- `src/components/DetalhamentoFreteDialog.tsx` (remoção de tabela tradicional + planos customizados, novo texto)
- `src/components/DetalhesPedidoDialog.tsx` (revisar/complementar exibição das condições de pagamento)
