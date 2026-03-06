

# Plan: Batch Code Field + Inventory Mini Dashboard

## 1. Add `codigo` field to Lotes

**Database:** Add a `codigo` (text) column to the `lotes` table via migration.

**Type:** Update `Lote` interface in `src/types/formula.ts` to include `codigo?: string`.

**Hook:** Update `src/hooks/useLotes.ts` to handle the new `codigo` field in add/update/map operations.

**UI (`LotesPanel.tsx`):**
- Add a "Código do Lote" text input field (manually filled) in the add/edit lote dialog
- Display the batch code in each lote row

## 2. Inventory Mini Dashboard

Create a new component `src/components/InventarioDashboard.tsx` placed at the top of the Inventario page (above the tabs). It will use data from `useLotes`, `useInsumos`, and `useEmbalagens` to render three sections in a grid:

**Top 10 Maior Estoque (MP + Embalagens):**
- Aggregate `lotes` by `item_id`/`item_tipo`, sum `quantidade`, sort descending, take top 10
- Display as a ranked list with item name and total stock

**Top 10 Menor Estoque (MP + Embalagens):**
- Same aggregation but sort ascending, filter items with stock > 0, take top 10
- Helps identify items at risk of running out

**Matérias-Primas Próximas do Vencimento (6 meses):**
- Filter lotes where `item_tipo = 'materia_prima'` and `validade` is within next 180 days and `quantidade > 0`
- Sort by validade ascending
- Show item name, batch code, expiry date, and quantity
- Color-coded: red if expired or < 30 days, yellow if < 90 days, orange if < 180 days

Each section will be a `Card` component, laid out in a responsive grid (3 columns on desktop, stacked on mobile).

## Files to change
1. **Migration** — add `codigo text` to `lotes`
2. `src/types/formula.ts` — add `codigo` to `Lote`
3. `src/hooks/useLotes.ts` — handle `codigo`
4. `src/components/LotesPanel.tsx` — add code input + display
5. `src/components/InventarioDashboard.tsx` — new component
6. `src/pages/Inventario.tsx` — import and render dashboard above tabs

