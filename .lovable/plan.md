

## Plano: Incluir "Observações" do pedido em todos os relatórios

### Problema
O campo `observacoes` de cada pedido não aparece nos relatórios WhatsApp, PDF nem Excel.

### Alterações

**1. `src/lib/relatoriosPedidos.ts`**
- Na interface `PedidoReport`, adicionar campo `observacoes?: string`
- No `extractData`, incluir `observacoes: pedido.observacoes || ''`
- No `addPedidoToPDF`: após condições de pagamento, adicionar seção "Observações" (se não vazia)
- No `buildRows` (Excel): adicionar coluna "Observações" no final — valor na primeira linha de cada pedido
- Atualizar array `headers` com "Observações"

**2. `src/pages/Pedidos.tsx`**
- Na função `copiarRelatorioWhatsApp`: adicionar `pedido.observacoes` ao texto copiado, após forma de pagamento (ex: `📝 Observações: ...`)

### Arquivos modificados
- `src/lib/relatoriosPedidos.ts`
- `src/pages/Pedidos.tsx`

