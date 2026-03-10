

# Correção: Erro de chave duplicada ao gerar pedido do orçamento

## Problema identificado

Dois bugs combinados causam o erro `duplicate key value violates unique constraint "pedidos_numero_pedido_key"`:

1. **Geração de número incorreta**: A query busca apenas o último pedido criado (`ORDER BY created_at DESC LIMIT 1`). O último pedido tem `numero_pedido: "OP-20260306130939"`, que não corresponde ao padrão `PED-(\d+)`. O regex falha e o sistema tenta criar `PED-001`, que já existe.

2. **Race condition com sync**: O sync automático (que roda ao montar a página de Pedidos) também cria pedidos para orçamentos pagos. Se o sync já criou o pedido para aquele orçamento, o `createPedidoFromOrcamento` tenta criar um duplicado.

## Correção

**Arquivo**: `src/hooks/usePedidos.ts`

### 1. Corrigir geração do numero_pedido
Em vez de buscar apenas o último pedido, buscar TODOS os `numero_pedido` que seguem o padrão `PED-*`, extrair o maior número e incrementar. Isso garante que mesmo com pedidos tipo `OP-*` no meio, o próximo `PED-XXX` será correto.

### 2. Evitar duplicata por orcamento_id
Antes de inserir, verificar se já existe um pedido com o mesmo `orcamento_id`. Se existir, apenas atualizar o snapshot em vez de criar um novo.

### 3. Mesma correção no sync
Aplicar a mesma lógica de busca do maior número PED no sync automático.

**Resultado**: A geração de pedidos não falhará mais com chave duplicada, independente da ordem de execução sync vs. aprovação manual.

