

# Plano: Padronizar campos da Fórmula ("Pó" → "Solúvel" + renomear campos genéricos)

## Problema

Os campos da tabela `formulas` têm nomes específicos de um tipo de produto, mas são usados para todos os tipos:

| Campo atual (DB) | Problema | Novo nome proposto |
|---|---|---|
| `qtd_capsulas` | Usado para cápsulas, gummies, mL, gramas — não é só cápsula | `quantidade_por_pote` |
| `unidade_po` | Referencia "Pó" que será renomeado para "Solúvel" | `unidade_soluvel` |
| `tipo_produto = 'Pó'` | Deve ser `'Solúvel'` conforme solicitado | valor `'Solúvel'` |

## Mudanças

### 1. Migration SQL

```sql
-- Renomear colunas
ALTER TABLE formulas RENAME COLUMN qtd_capsulas TO quantidade_por_pote;
ALTER TABLE formulas RENAME COLUMN unidade_po TO unidade_soluvel;

-- Atualizar valores existentes
UPDATE formulas SET tipo_produto = 'Solúvel' WHERE tipo_produto = 'Pó';
UPDATE margens_lucro SET tipo_produto = 'Solúvel' WHERE tipo_produto = 'Pó';
```

### 2. Tipos TypeScript (`src/types/formula.ts`)

- `Formula.qtd_capsulas` → `quantidade_por_pote`
- `Formula.unidade_po` → `unidade_soluvel`
- `tipo_produto: 'Pó'` → `'Solúvel'` em todos os union types

### 3. Arquivos afetados (substituição de referências)

| Arquivo | Mudanças |
|---|---|
| `src/types/formula.ts` | Renomear campos + tipo `'Solúvel'` |
| `src/types/precificacao.ts` | `'Pó'` → `'Solúvel'` |
| `src/types/orcamento.ts` | Já usa `'Solúvel'` no frete (OK) |
| `src/hooks/useFormulas.ts` | `qtd_capsulas` → `quantidade_por_pote`, `unidade_po` → `unidade_soluvel` |
| `src/hooks/useFormulasPaginadas.ts` | Idem |
| `src/pages/Calculator.tsx` | ~50 referências: campos + labels + lógica `'Pó'` → `'Solúvel'` |
| `src/pages/Cotacoes.tsx` | Referências a `qtd_capsulas`, `unidade_po`, `'Pó'` |
| `src/components/VerFormulaDialog.tsx` | `qtd_capsulas` → `quantidade_por_pote` |
| `src/components/DetalhesPedidoDialog.tsx` | Referências no snapshot |
| `src/components/GerarOrcamentoDialog.tsx` | Segmento labels |
| `src/components/GerarPedidoDialog.tsx` | `nome_formula` ref |
| `src/components/PrecificacoesSalvas.tsx` | Tipo cast |
| `src/components/AprovacaoOrcamentoDialog.tsx` | Detecção de segmento `'pó'` → `'solúvel'` |
| `src/lib/pdfGenerator.ts` | `qtd_capsulas`, labels |
| `src/lib/propostaGenerator.ts` | `qtd_capsulas`, `unidades_por_dose`, labels |
| `src/lib/precificacaoCalculator.ts` | `'Pó'` nas margens config |
| `src/lib/localStorage.ts` | Tipo `'Pó'` → `'Solúvel'` |

### 4. Observações

- A coluna no DB será renomeada (não cria nova + migra), mantendo dados intactos
- O campo `unidade_soluvel` continua nullable, usado apenas quando `tipo_produto = 'Solúvel'`
- Labels na UI: "Quantidade Total de Pó" → "Quantidade Total de Solúvel", etc.
- Snapshots existentes em `pedidos.formula_snapshot` (JSONB) manterão os nomes antigos — o código de leitura de snapshots tratará ambos os nomes para retrocompatibilidade

