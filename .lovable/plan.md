

# Ajustes: Renomear aba, duplicação ao precificar, remover botão Settings, filtro dashboard por data de pagamento

## 1. Renomear "Precificações Salvas" → "Produtos Precificados"
**Arquivos:** `src/pages/Precificacao.tsx`, `src/components/PrecificacoesSalvas.tsx`
- Atualizar label da tab e títulos internos

## 2. Permitir alterar nome do cliente e fórmula ao precificar
**Arquivo:** `src/pages/Precificacao.tsx`
- Na modal de precificação (após `handleSelectFormula`), adicionar estados `nomeClienteEdit` e `nomeFormulaEdit` pré-preenchidos com os valores da fórmula original
- Campos editáveis no header da modal (substituir badges por inputs)
- No `handleSalvar`: se o nome do cliente ou fórmula mudou, primeiro duplicar a fórmula no banco (`supabase.from('formulas').insert(...)`) com os novos nomes, depois salvar a precificação apontando para o novo `formula_id`
- A fórmula original permanece intacta

## 3. Remover botão de Settings
**Arquivo:** `src/pages/Precificacao.tsx` (linhas 305-307)
- Remover o `<Button variant="outline" size="icon"><Settings /></Button>`
- Remover import `Settings` do lucide-react

## 4. Filtro do Dashboard por data de pagamento
**Arquivo:** `src/hooks/useDashboardComercial.ts` (linhas 60-73)
- Alterar filtro de `o.created_at` para `o.data_pagamento`
- Apenas orçamentos com `data_pagamento` preenchida e dentro do range serão incluídos
- Orçamentos sem `data_pagamento` ficam fora do filtro temporal (mas ainda visíveis no pipeline geral)

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Precificacao.tsx` | Renomear aba, campos editáveis na modal, duplicação de fórmula, remover Settings |
| `src/components/PrecificacoesSalvas.tsx` | Renomear título |
| `src/hooks/useDashboardComercial.ts` | Filtrar por `data_pagamento` |

