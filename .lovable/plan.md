

# Plano: Arredondamento em Cascata para Valores em Reais

## Diagnóstico

O sistema tem valores monetários formatados de maneiras inconsistentes:

- **`formatCurrency` em `src/lib/unitConversion.ts`** — permite até 13 casas decimais (principal problema)
- **6+ definições locais de `formatCurrency`** espalhadas por componentes (GerarOrcamentoDialog, Pedidos, DashboardVendas, DashboardGraficos, OrcamentoKanbanView, Cotacoes) — cada uma usando `toLocaleString` ou `Intl.NumberFormat` sem padronização
- **Cálculos retornando floats brutos** em `precificacaoCalculator.ts`, `useLotes.ts` (custo médio), `calcularCustoInsumo`
- **~50+ usos de `.toFixed(2)`** diretos no JSX, que não aplicam arredondamento em cascata

## Solução

### 1. Criar função utilitária `arredondarReais(value: number): number`

Em `src/lib/utils.ts`, implementar o arredondamento em cascata:
- Pegar todas as casas decimais do float
- Da última casa para a esquerda, aplicar regra 0-4 mantém / 5-9 soma 1
- Repetir até sobrar 2 casas decimais
- Retorna o número arredondado (não string)

### 2. Unificar `formatCurrency` central

Em `src/lib/unitConversion.ts`:
- `formatCurrency(value)` → aplica `arredondarReais` e formata com exatamente 2 casas
- `formatCurrencyDetailed` → remover ou manter apenas para exibição de massa/volume (não monetários)
- Exportar também de `src/lib/utils.ts` para fácil importação

### 3. Aplicar nos cálculos que retornam R$

- **`precificacaoCalculator.ts`**: aplicar `arredondarReais` em cada campo monetário do resultado (`PrecificacaoCalculada`)
- **`useLotes.ts`** → `getCustoMedioPonderado`: arredondar o retorno
- **`calcularCustoInsumo`** em `unitConversion.ts`: arredondar o retorno
- **`useFormulas.ts`** → `total_mp`, `total_embalagem`, `custo_total`: arredondar ao salvar

### 4. Eliminar `formatCurrency` locais

Substituir todas as definições locais em ~6 componentes pelo import centralizado:
- `GerarOrcamentoDialog.tsx`
- `Pedidos.tsx`
- `DashboardVendas.tsx`
- `DashboardGraficos.tsx`
- `OrcamentoKanbanView.tsx`
- `Cotacoes.tsx`

### 5. Substituir `.toFixed(2)` por `formatCurrency` ou `arredondarReais`

Em `Precificacao.tsx`, `PrecificacoesSalvas.tsx`, `pdfGenerator.ts`, `propostaGenerator.ts`, `orcamentoGenerator.ts` — trocar interpolações `R$ ${x.toFixed(2)}` pelo `formatCurrency(x)`.

## Arquivos afetados

1. `src/lib/utils.ts` — adicionar `arredondarReais`
2. `src/lib/unitConversion.ts` — atualizar `formatCurrency`, `calcularCustoInsumo`
3. `src/lib/precificacaoCalculator.ts` — arredondar saídas
4. `src/hooks/useLotes.ts` — arredondar custo médio
5. `src/pages/Precificacao.tsx` — substituir `.toFixed(2)` e usar `formatCurrency` central
6. `src/components/PrecificacoesSalvas.tsx` — idem
7. `src/components/GerarOrcamentoDialog.tsx` — remover `formatCurrency` local
8. `src/pages/Pedidos.tsx` — idem
9. `src/components/dashboard/DashboardVendas.tsx` — idem
10. `src/components/dashboard/DashboardGraficos.tsx` — idem
11. `src/components/OrcamentoKanbanView.tsx` — idem
12. `src/lib/pdfGenerator.ts` — usar `formatCurrency`
13. `src/lib/propostaGenerator.ts` — usar `formatCurrency`
14. `src/lib/orcamentoGenerator.ts` — usar `formatCurrency`

