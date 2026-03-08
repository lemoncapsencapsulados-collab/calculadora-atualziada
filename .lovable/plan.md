

# Reestruturação: "Criação de Produto" + "Precificação de Produto"

## Resumo

3 mudanças principais:
1. **Calculator.tsx**: Renomear para "Criação de Produto" + custo rótulo R$ 1,00
2. **Precificacao.tsx**: Reestruturar completamente — aba "Produtos Criados" (conteúdo vindo de Cotacoes.tsx com busca, filtros, accordion com detalhes de MP/Embalagem, botões VER FÓRMULA + PRECIFICAR) e aba "Precificações Salvas"
3. **Navigation.tsx + App.tsx**: Remover rota `/cotacoes`, renomear labels

---

## Detalhamento

### 1. `src/pages/Calculator.tsx`
- Linha 358: `custoRotulo = 0.5` → `custoRotulo = 1.00`
- Título da página (se existir): "Calcular Fórmula" → "Criação de Produto"

### 2. `src/components/Navigation.tsx`
- `/` label: "Calcular Fórmula" → "Criação de Produto"
- Remover link `/cotacoes` (Cotações Salvas)
- `/precificacao` label: "Precificação Final" → "Precificação de Produto"

### 3. `src/App.tsx`
- Remover import e rota de `Cotacoes`

### 4. `src/pages/Precificacao.tsx` — Reestruturação completa

**Título da página**: "Precificação de Produto"

**Aba 1: "Produtos Criados"** — Migra toda a lógica de `Cotacoes.tsx`:
- Busca + filtros por tipo (Todos, Encapsulados, Solúvel, Gummy, Líquido)
- Usa `useFormulas` (todas as fórmulas, não paginadas como antes)
- Accordion com cards expandíveis para cada produto mostrando:
  - Nome do Cliente
  - Tipo de produto, Quantidade por pote, Data de criação
  - Custo Total do Produto
  - Lista de Matérias Primas (individuais + total)
  - Lista de Embalagens (individuais + total)
  - Botão **"VER FÓRMULA"** → usa `VerFormulaDialog` existente (já tem PNG, copiar, editar matérias primas). Expandir para incluir edição de embalagens também.
  - Botão **"PRECIFICAR"** → abre a modal fullscreen existente de precificação (custos diretos/indiretos, margem 20%, impostos, preço de venda). Ao clicar "Salvar Precificação" → muda para aba "Precificações Salvas"
  - Botões de Exportar CSV e Excluir (mantidos de Cotações)

**Aba 2: "Precificações Salvas"** — Componente `PrecificacoesSalvas` existente (sem alterações)

**Modal de precificação** permanece idêntica à atual (já sem "Gerar Proposta" — removido anteriormente).

### 5. `src/components/VerFormulaDialog.tsx` — Expandir edição
- Adicionar seção de embalagens na visualização (nome + custo)
- No modo "EDITAR": permitir adicionar/remover/alterar embalagens além de matérias primas
- Recalcular custos ao salvar edições

### 6. Arquivo `src/pages/Cotacoes.tsx`
- Pode ser deletado (rota removida)

---

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/pages/Calculator.tsx` | Custo rótulo R$ 1,00 |
| `src/components/Navigation.tsx` | Renomear labels, remover /cotacoes |
| `src/App.tsx` | Remover rota /cotacoes |
| `src/pages/Precificacao.tsx` | Reestruturação completa: 2 abas |
| `src/components/VerFormulaDialog.tsx` | Adicionar embalagens na visualização e edição |
| `src/pages/Cotacoes.tsx` | Deletar |

