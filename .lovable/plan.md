

## Plano: Discriminar Setup e Produção no relatório WhatsApp

### Alteração
**Arquivo**: `src/pages/Pedidos.tsx` — função `copiarRelatorioWhatsApp` (linha 99).

Adicionar duas linhas após `Valor da venda`, extraindo do `orcamento_snapshot`:
- `Valor de Produção: R$ X` ← `snap.subtotal_producao`
- `Valor de Setup: R$ Y` ← `snap.subtotal_servicos`

### Texto resultante
```
Valor da venda: R$ 10.000,00
Valor de Produção: R$ 7.000,00
Valor de Setup (Serviços de Marca): R$ 3.000,00
```

Linhas só aparecem quando o valor for > 0, para evitar poluição em pedidos só de produção ou só de setup.

### Arquivo modificado
- `src/pages/Pedidos.tsx`

