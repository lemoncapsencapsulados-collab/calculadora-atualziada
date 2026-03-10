
# Plano: 3 ajustes na Aprovação de Orçamento

## 1. CNPJ não obrigatório
Remover a validação que exige CNPJ (linha 121) e remover o asterisco vermelho do label (linha 268).

## 2. Encapsulados — Cores corretas
- **Tampa do Pote**: Preta / Branca (atualmente Preta / Transparente)
- **Cor do Pote**: Preta / Transparente (já está correto, sem alteração)

Arquivo: `src/components/AprovacaoOrcamentoDialog.tsx`, linhas 336-338 — trocar "Transparente" por "Branca" na tampa.

## 3. Forma de Venda aceitar "Sem informação"
Remover a validação da linha 124 que bloqueia quando `formaVenda === 'sem_informacao'`.

## Arquivo modificado
- `src/components/AprovacaoOrcamentoDialog.tsx`
