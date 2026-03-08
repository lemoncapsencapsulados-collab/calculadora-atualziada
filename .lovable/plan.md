

# Plano: Sync completo orçamentos pagos → pedidos, renomear, dashboard baseado em pedidos

## 1. Sync completo: orçamentos pagos → pedidos
**Arquivo:** `src/hooks/usePedidos.ts`

Ao carregar o hook, executar sync automático:
- Buscar TODOS orçamentos com `status = 'pago'`
- Buscar TODOS pedidos existentes
- Para cada orçamento pago:
  - Se já existe pedido com `orcamento_id` correspondente → **atualizar** o `orcamento_snapshot` com dados completos do orçamento atual (complementar dados faltantes)
  - Se NÃO existe pedido → **criar** novo pedido com snapshot completo (mesma lógica de `createPedidoFromOrcamento`)
- Usar `useEffect` com guard para executar uma única vez por sessão

## 2. Renomear "Pedidos Gerados" → "Pedidos"
**Arquivos:** `src/components/Navigation.tsx` (linha 20), `src/pages/Pedidos.tsx` (linha 263)

## 3. Dashboard baseado em Pedidos
**Arquivo:** `src/hooks/useDashboardComercial.ts` — Reescrever:
- Buscar da tabela `pedidos` em vez de `orcamentos`
- Extrair dados do `orcamento_snapshot` de cada pedido: `nome_cliente`, `consultor_responsavel`, `valor_total`, `tipo_orcamento`, `itens_producao`, `servicos_marca`, `dados_cliente`, `subtotal_producao`, `subtotal_servicos`, `data_pagamento`
- Filtro temporal: `data_pagamento` do snapshot
- KPIs: faturamento, vendas, ticket médio — calculados dos pedidos
- Pipeline: pedidos com status `aguardando_producao` (em produção)
- Distribuição por status de pedido: `aguardando_producao`, `no_estoque`, `enviado`, `concluido`
- Ranking, produtos vendidos, mix, canais, evolução temporal — tudo do snapshot

**Arquivo:** `src/types/dashboard.ts`
- `DistribuicaoConsultorStatus`: campos `rascunho/enviado/pago/recusado` → `aguardando_producao/no_estoque/enviado/concluido`

**Arquivo:** `src/components/dashboard/DashboardPipeline.tsx`
- STATUS_CONFIG: atualizar labels e cores para status de pedido

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePedidos.ts` | Sync automático (criar + atualizar) para todos orçamentos pagos |
| `src/components/Navigation.tsx` | "Pedidos Gerados" → "Pedidos" |
| `src/pages/Pedidos.tsx` | Renomear título |
| `src/hooks/useDashboardComercial.ts` | Reescrever para buscar de pedidos |
| `src/types/dashboard.ts` | Status de pedido no type |
| `src/components/dashboard/DashboardPipeline.tsx` | Labels/cores de status de pedido |

