## Objetivo
Fazer a aba **Comissionamento** funcionar como um espelho real de **Pedidos**: se um pedido for alterado ou excluído em qualquer um dos dois lugares, o outro deve refletir imediatamente os mesmos dados e a mesma lista.

## O que vou implementar
1. **Unificar a origem da listagem de “Pedidos no período”**
   - Garantir que a tabela de Comissionamento derive exclusivamente da coleção `pedidos` já usada na página Pedidos.
   - Remover qualquer comportamento residual que mantenha linhas órfãs ou derivadas apenas de parcelas quando o pedido já não existe mais.

2. **Sincronizar exclusão de forma imediata**
   - Revisar a atualização de cache/realtime para que, ao excluir um pedido em Pedidos, a aba Comissionamento remova esse item na mesma fonte de dados, sem divergência visual.
   - Fazer o mesmo no fluxo inverso, adicionando exclusão também dentro de Comissionamento, já que você quer comportamento bidirecional.

3. **Sincronizar edição de forma bidirecional**
   - Reutilizar na aba Comissionamento o mesmo fluxo de edição do pedido real já usado em Pedidos.
   - Garantir que alterações de pagamento, datas e condições atualizem a mesma entidade base e invalidem todos os caches necessários para refletir na página Pedidos e no relatório.

4. **Ajustar ações na UI de Comissionamento**
   - Manter “Editar” ligado ao pedido real.
   - Adicionar a ação de **Excluir** na tabela/fluxo de Comissionamento com confirmação, usando a mesma mutação já existente em Pedidos.

5. **Validar o espelhamento completo**
   - Confirmar que um pedido excluído não continua aparecendo em Comissionamento.
   - Confirmar que alterações feitas em qualquer lado atualizam a listagem e os detalhes de comissão corretamente.

## Resultado esperado
- **Pedidos** e **Comissionamento** passam a mostrar exatamente o mesmo conjunto de pedidos para o mesmo critério.
- **Excluir em um lado exclui no outro**.
- **Editar em um lado atualiza no outro**.
- A comissão continua sendo calculada a partir do pedido real atualizado, sem manter dados antigos visíveis.

## Detalhes técnicos
- Reaproveitar `usePedidos()` como fonte única de verdade.
- Expandir as invalidações de query para cobrir explicitamente o relatório de comissões, se necessário.
- Usar as mesmas mutações já existentes (`alterarPagamento`, `deletePedidoAsync`, `toggleParcelaPagaAsync`) para evitar duplicidade de regra.
- Ajustar `RelatorioComissoes.tsx` para que toda ação opere sobre `pedido.id` e nunca sobre estruturas derivadas independentes.