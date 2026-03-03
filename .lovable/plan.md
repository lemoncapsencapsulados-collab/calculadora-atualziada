

# Campos Obrigatórios + Inscrição Estadual na Aprovação de Orçamento

## Alterações

### 1. Tipo `DadosCliente` — `src/types/orcamento.ts`
- Adicionar campo `inscricao_estadual?: string`

### 2. `AprovacaoOrcamentoDialog.tsx` — Validação e UI

**Adicionar campo "Inscrição Estadual"** no formulário de Informações do Cliente (após CNPJ/Razão Social).

**Validação obrigatória em `handleConfirmAprovacao`** — antes de prosseguir, verificar que os seguintes campos estão preenchidos:
- `nome_completo`
- `email`
- `cpf`
- `cnpj`
- `telefone`
- `inscricao_estadual`
- `formaVenda` diferente de `'sem_informacao'`
- `dataPagamento` (já validado)
- Condições de pagamento (já validado)
- Detalhamento de frete já é preenchido por padrão (radio groups), então basta manter

Se algum campo obrigatório estiver vazio, exibir toast de erro listando o que falta e não prosseguir.

**Labels com asterisco** (`*`) nos campos obrigatórios para indicação visual.

### 3. Também em `PropostaCompletaDialog.tsx`
- Adicionar campo "Inscrição Estadual" no formulário (mesma posição)
- Manter consistência entre os dois dialogs

## Arquivos Modificados
- `src/types/orcamento.ts` — adicionar `inscricao_estadual`
- `src/components/AprovacaoOrcamentoDialog.tsx` — campo + validação obrigatória
- `src/components/PropostaCompletaDialog.tsx` — campo Inscrição Estadual (consistência)

