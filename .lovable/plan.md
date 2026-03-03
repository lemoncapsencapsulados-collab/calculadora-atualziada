

# Alertas de Atualização de Preço + Fornecedor Obrigatório no Inventário

## Alterações

### 1. Migração SQL
- Adicionar coluna `fornecedor` na tabela `embalagens` (text, nullable — para dados existentes, mas obrigatório no front)
- As tabelas `insumos` e `embalagens` já possuem `updated_at` com trigger automático

### 2. Tipos — `src/types/formula.ts`
- Adicionar `updated_at?: string` em `Insumo` e `Embalagem`
- Adicionar `fornecedor?: string` em `Embalagem`

### 3. Hooks — `useInsumos.ts` e `useEmbalagens.ts`
- Mapear `updated_at` do DB para os objetos
- Mapear `fornecedor` no hook de embalagens

### 4. Página Inventário — `src/pages/Inventario.tsx`

**Fornecedor obrigatório (insumos):**
- Tornar campo "Fornecedor" obrigatório no form (required, asterisco no label)
- Validação no `handleSaveInsumo`: bloquear se fornecedor vazio

**Fornecedor em embalagens:**
- Adicionar campo "Fornecedor *" no form de embalagens (obrigatório)
- Validação no `handleSaveEmbalagem`

**Data de atualização nos cards:**
- Exibir "Atualizado em: DD/MM/YYYY" em cada card de insumo e embalagem

**Alertas visuais baseados em `updated_at`:**
- Função utilitária que calcula dias desde última atualização
- **Vermelho** (>= 60 dias): borda vermelha no card + badge "AJUSTE DE PREÇO NECESSÁRIO"
- **Amarelo** (>= 53 dias e < 60 dias): borda amarela + badge "Restam X dias para a atualização de preço"
- Aplicar tanto em insumos quanto em embalagens

## Arquivos Modificados
- Migração SQL (coluna `fornecedor` em `embalagens`)
- `src/types/formula.ts`
- `src/hooks/useInsumos.ts`
- `src/hooks/useEmbalagens.ts`
- `src/pages/Inventario.tsx`

