

# Plano: Reformular "Proposta Completa" → "Resumo para Contrato"

## Resumo

Substituir o formulário simplificado do `PropostaCompletaDialog` pelo mesmo formulário completo usado em `AprovacaoOrcamentoDialog` (tipo PJ/PF, detalhes de produção, frete, condições de pagamento), porém **sem** campo de data de pagamento e **sem** criar pedido. Os dados são salvos no orçamento e o PDF é gerado.

## Mudanças

### 1. `PropostaCompletaDialog.tsx` — Reescrever

Reutilizar a mesma estrutura de formulário de `AprovacaoOrcamentoDialog`:
- Tipo de pessoa (PJ/PF) com formulários completos (CNPJ lookup, QSA, múltiplas PFs com validação CPF/Email, CEP auto-fill)
- Detalhes de produção por item (cor pote/tampa condicionais por segmento, sabor/cor conteúdo para gummy/líquido/solúvel)
- Forma de venda
- Detalhamento de frete/envio
- Condições de pagamento
- **Sem** campo de data de pagamento
- **Sem** criação de pedido

Ao submeter: salvar `dados_cliente`, `detalhamento_frete`, `condicoes_pagamento` e `itens_producao` (com detalhes) no orçamento, depois gerar PDF.

Reutilizar o componente `PessoaFisicaFields` — extraí-lo para um componente compartilhado ou duplicá-lo internamente (como já existe em `AprovacaoOrcamentoDialog`).

### 2. Renomear botão em dois lugares

- `src/pages/Orcamentos.tsx` (linha ~326): `"Proposta Completa"` → `"Resumo para Contrato"`
- `src/components/OrcamentoKanbanView.tsx` (linha ~156): tooltip `"Proposta Completa"` → `"Resumo para Contrato"`

### 3. Títulos internos do dialog

- `"Gerar Proposta Completa"` → `"Resumo para Contrato"`
- `"Preview da Proposta Completa"` → `"Preview do Resumo para Contrato"`

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/PropostaCompletaDialog.tsx` | Reescrever com formulário completo (sem data pagamento, sem pedido) |
| `src/pages/Orcamentos.tsx` | Renomear botão |
| `src/components/OrcamentoKanbanView.tsx` | Renomear tooltip |

