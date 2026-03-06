# Plano: Lotes, Categorias Duplicadas e Rename Insumo → Matéria Prima

---

## 1. Análise de Categorias Duplicadas

### Matérias Primas (tabela `insumos`)

Categorias atuais no banco:


| Grupo | Categorias encontradas                       | Sugestão de unificação             |
| ----- | -------------------------------------------- | ---------------------------------- |
| 1     | "Aminoácidos" + "Aminoácidos e Derivados"    | **Aminoácidos e Derivados**        |
| 2     | "Aromas" + "Aromas e Corantes"               | **Aromas e Corantes**              |
| 3     | "Enzimas" + "Enzimas e Catalisadores"        | **Enzimas e Catalisadores**        |
| 4     | "Fibra Alimentar" + "Carboidratos e Fibras"  | **Fibras e Carboidratos**          |
| 5     | "Minerais" + "Minerais e Compostos Quelados" | **Minerais e Compostos Quelados**  |
| 6     | "Óleos" + "Lipídeos e Óleos Vegetais"        | **Óleos e Lipídeos**               |
| 7     | "Sacarose"                                   | Mover para "Fibras e Carboidratos" |


Categorias sem conflito: Vitaminas, Substâncias Bioativas, Ativos Emagrecedores, Suplemento Alimentar, Suplemento Ergogênico, Extratos e Fitoterápicos, Compostos Funcionais Ácidos e Bases, Compostos Alimentares e Espessantes, Outros.

### Embalagens


| Grupo | Categorias encontradas          | Sugestão de unificação |
| ----- | ------------------------------- | ---------------------- |
| 1     | "Frasco" + "Pote" + "Potes PET" | **Frascos e Potes**    |
| 2     | "Tampa" + "Tampas Plásticas"    | **Tampas**             |


Sem conflito: Cápsulas, Sachê, Sílica, Acessórios.

**Preciso da sua aprovação sobre cada unificação antes de executar.** Confirme quais aceita e se quer alterar algum nome final. (TUDO APROVADO)

---

## 2. Sistema de Lotes

### Nova tabela `lotes`

```text
lotes
├── id (uuid, PK)
├── item_id (uuid, NOT NULL)         -- referência ao item (matéria prima ou embalagem)
├── item_tipo (text, NOT NULL)       -- 'materia_prima' | 'embalagem'
├── quantidade (numeric, NOT NULL)   -- quantidade em estoque neste lote
├── validade (date, nullable)        -- data de validade do lote
├── custo_unitario (numeric, NOT NULL) -- custo por unidade de compra neste lote
├── fornecedor (text, nullable)      -- fornecedor deste lote específico
├── observacoes (text, nullable)
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### Lógica de custo médio

O preço exibido no item será calculado como a **média ponderada** do `custo_unitario` de todos os lotes com `quantidade > 0`. Quando não houver lotes, mantém o preço cadastrado manualmente.

### UI do Inventário

- Cada item terá um botão "Ver Lotes" que expande/abre um painel com a lista de lotes
- Formulário para adicionar/editar lote: quantidade, validade, custo unitário
- Alerta visual para lotes com validade vencida ou próxima (30 dias)
- Exibição do custo médio calculado no card do item

---

## 3. Rename Completo: Insumo → Matéria Prima

### Banco de dados

- Renomear tabela `insumos` → `materias_primas`
- Renomear coluna `normalized_name` (manter)
- Atualizar funções do banco (`set_normalized_name`, `normalize_insumo_name` → `normalize_mp_name`)
- Atualizar triggers

### Código (arquivos afetados)

- `src/types/formula.ts` — interface `Insumo` → `MateriaPrima`, `FormulaItem.insumo_id` → `materia_prima_id`
- `src/hooks/useInsumos.ts` → `src/hooks/useMateriasPrimas.ts`
- `src/hooks/useImportInsumos.ts` → `src/hooks/useImportMateriasPrimas.ts`
- `src/components/InsumoAutocomplete.tsx` → `src/components/MateriaPrimaAutocomplete.tsx`
- `src/components/ImportInsumosDialog.tsx` → `src/components/ImportMateriasPrimasDialog.tsx`
- `src/components/ImportInventoryDialog.tsx` — referências internas
- `src/pages/Inventario.tsx` — labels, variáveis, imports
- `src/pages/Cotacoes.tsx` — referências
- `src/components/FichaTecnicaDialog.tsx` — referências
- `src/lib/migrateToSupabase.ts` — referências à tabela
- `supabase/functions/import-insumos/` → `supabase/functions/import-materias-primas/`
- `supabase/functions/import-inventory/` — referências internas
- Edge functions que referenciam a tabela `insumos`

### Textos de UI

Todos os labels, toasts, placeholders, títulos trocam de "Insumo/Insumos" para "Matéria Prima/Matérias Primas".

---

## Ordem de execução

1. Migração DB: renomear tabela + funções + criar tabela `lotes`
2. Unificar categorias duplicadas (UPDATE no banco após aprovação)
3. Reescrever hooks, types, componentes com novo nome
4. Implementar UI de lotes com custo médio
5. Atualizar edge functions