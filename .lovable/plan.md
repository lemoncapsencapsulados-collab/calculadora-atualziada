

# Plano: Filtros nos Insights, Correção de Pesquisa, Entregáveis Estruturados

## 1. Filtros nos Insights e Alertas

**`src/components/dashboard/DashboardInsights.tsx`**
- Adicionar state local para `filtroTipo` e `filtroConsultor`
- Extrair lista de consultores únicos dos insights (campo `consultor`)
- Adicionar dois `Select` no CardHeader:
  - Tipo: "Todos", "Alerta", "Atenção", "Positivo", "Oportunidade"
  - Consultor: "Todos" + lista extraída
- Filtrar `insights` com `useMemo` antes de renderizar

## 2. Correção da Pesquisa (debounce)

O problema: `searchTerm` está no `queryKey` dos hooks paginados, disparando query a cada tecla.

**`src/components/PrecificacoesSalvas.tsx`** e **`src/pages/Orcamentos.tsx`**
- Manter `searchTerm` para o input (resposta imediata ao digitar)
- Criar `debouncedSearchTerm` com `useEffect` + `setTimeout` (300ms)
- Passar `debouncedSearchTerm` ao hook paginado ao invés de `searchTerm`

## 3. Entregáveis Estruturados nos Serviços de Marca

**`src/types/orcamento.ts`**
- Adicionar interface `Entregavel`:
```typescript
export interface Entregavel {
  nome: string;
  incluso: boolean;
  quantidade: number;
}
```
- Adicionar campo `entregaveis?: Entregavel[]` em `ServicoMarca`

**`src/components/GerarOrcamentoDialog.tsx`** (formulário de serviço, Step 3)
- Substituir formulário simples por formulário com:
  - Nome do plano (input)
  - Lista de entregáveis com checkbox (define `incluso: boolean`) + dropdown de quantidade quando aplicável:
    - Registro de Marca no INPI (sem dropdown)
    - Criação da Logomarca (sem dropdown)
    - Criação de rótulo (dropdown 1-9)
    - Criação de Mockup 3D (sem dropdown)
    - Página de Venda (dropdown 1-9)
    - Call Estratégica (dropdown 1-2)
  - Descrição (textarea)
  - Valor (input numérico)
- Na lista de serviços, mostrar entregáveis inclusos como badges
- Ao editar, carregar entregáveis previamente salvos

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/dashboard/DashboardInsights.tsx` | Filtros por tipo e consultor |
| `src/components/PrecificacoesSalvas.tsx` | Debounce no searchTerm |
| `src/pages/Orcamentos.tsx` | Debounce no searchTerm |
| `src/types/orcamento.ts` | Interface `Entregavel`, atualizar `ServicoMarca` |
| `src/components/GerarOrcamentoDialog.tsx` | Formulário de entregáveis com checkboxes |

