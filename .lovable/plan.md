

# Plano: Status 'aprovado' → 'pago' + Auto-preenchimento + Tipagem Snapshot + Validação Data

## 1. Migration SQL (dados existentes)
```sql
UPDATE orcamentos SET status = 'pago' WHERE status = 'aprovado';
```

## 2. Tipos (`src/types/orcamento.ts`)

### 2a. Extrair e expandir `DetalhesProducao`
Criar interface separada com todos os campos (incluindo `sabor_liquido`, `cor_liquido`, `observacao_producao`).

### 2b. Expandir `ItemProducao`
Adicionar campos estruturados vindos da fórmula:
- `tipo_produto?: string`
- `quantidade_por_pote?: number`
- `unidade_por_pote?: string`
- `quantidade_por_dose?: number`
- `unidade_por_dose?: string`
- `quantidade_doses?: number`

Manter `dose_diaria_sugerida` para compatibilidade com dados existentes.

### 2c. Status `'aprovado'` → `'pago'`
Em `Orcamento`, `OrcamentoInsert`, `OrcamentoUpdate`: substituir `'aprovado'` por `'pago'` no union type.

### 2d. Criar `OrcamentoSnapshot`
```typescript
export interface OrcamentoSnapshot {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  consultor_responsavel?: string;
  tipo_orcamento: TipoOrcamento;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
  condicoes_pagamento?: CondicoesPagamento;
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  data_pagamento?: string;
  observacoes?: string;
  updated_at?: string;
}
```

## 3. Tipo Pedido (`src/types/formula.ts`)
- `orcamento_snapshot?: any` → `orcamento_snapshot?: OrcamentoSnapshot` (importar de orcamento.ts)

## 4. Hook `usePedidos.ts`
- Remover todos os `as any` para `orcamento_id` e `orcamento_snapshot`
- Tipar `createPedidoFromOrcamento` com `Orcamento` em vez de `any`
- Snapshot criado usando `OrcamentoSnapshot`
- Toast: "orçamento aprovado" → "orçamento pago"

## 5. Hook `useOrcamentos.ts`
- Snapshot nos pedidos vinculados: tipar com `OrcamentoSnapshot` em vez de `any`

## 6. Auto-preenchimento (`src/components/GerarOrcamentoDialog.tsx`)
- Em `handleAddPrecificacoes`: buscar fórmula completa (`tipo_produto`, `quantidade_por_pote`, `unidades_por_dose`, `unidade_soluvel`)
- Preencher automaticamente: `tipo_produto`, `quantidade_por_pote`, `unidade_por_pote` (derivado do tipo), `quantidade_por_dose`, `unidade_por_dose`, `quantidade_doses`
- No Step 2, tornar esses campos **read-only** para itens do tipo `'precificacao'`
- Para itens `'avulso'`, manter editáveis

## 7. Validação de data (`src/components/AprovacaoOrcamentoDialog.tsx`)
- Adicionar `disabled={(date) => date > new Date()}` no Calendar
- Status: `'aprovado'` → `'pago'`
- Labels: "Aprovar" → "Confirmar Pagamento", "Aprovando" → "Confirmando..."

## 8. Status labels em todos os arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/Orcamentos.tsx` | STATUS_CONFIG: `aprovado` → `pago` com label "Pago". SelectItem values. `isAprovado` → `isPago`. `newStatus === 'aprovado'` → `'pago'` |
| `src/components/OrcamentoKanbanView.tsx` | COLUMNS: `aprovado` → `pago`, label "Pago" |
| `src/components/dashboard/DashboardPipeline.tsx` | STATUS_CONFIG: `aprovado` → `pago`, label "Pago" |
| `src/hooks/useDashboardComercial.ts` | Todos os `.filter(o => o.status === 'aprovado')` → `'pago'` (~15 ocorrências) |
| `src/types/dashboard.ts` | `aprovado: number` → `pago: number` |
| `src/lib/orcamentoGenerator.ts` | `aprovado: 'APROVADO'` → `pago: 'PAGO'` + cor |

## Arquivos modificados (14)
1. Migration SQL (dados)
2. `src/types/orcamento.ts`
3. `src/types/formula.ts`
4. `src/types/dashboard.ts`
5. `src/hooks/usePedidos.ts`
6. `src/hooks/useOrcamentos.ts`
7. `src/hooks/useDashboardComercial.ts`
8. `src/components/GerarOrcamentoDialog.tsx`
9. `src/components/AprovacaoOrcamentoDialog.tsx`
10. `src/pages/Orcamentos.tsx`
11. `src/components/OrcamentoKanbanView.tsx`
12. `src/components/dashboard/DashboardPipeline.tsx`
13. `src/lib/orcamentoGenerator.ts`
14. `src/components/DetalhesPedidoDialog.tsx` (adaptar leitura de snapshot)

