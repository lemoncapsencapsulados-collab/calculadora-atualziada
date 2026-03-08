

# Remover botões "Baixar Orçamento" e "Gerar Proposta"

## Mudanças

### 1. `src/pages/Calculator.tsx` (linha 1315-1318)
- Remover o botão "Baixar Orçamento" e a função `handleExport` associada

### 2. `src/pages/Precificacao.tsx` (linhas 739-742)
- Remover o botão "Gerar Proposta" da modal de precificação
- O botão "Salvar Precificação" passa a ocupar largura total (`flex-1` → `w-full`)
- Remover o dialog de "Gerar Proposta" (linhas 784-891) e states/imports relacionados (`propostaDialog`, `propostaData`, etc.)

### Arquivos modificados
- `src/pages/Calculator.tsx`
- `src/pages/Precificacao.tsx`

