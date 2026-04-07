

## Plano: Remover asteriscos do QSA e melhorar fluxo "Novo Cliente"

### Problema 1: Asteriscos enganosos no Responsável QSA (fluxo Pago)

O componente `PessoaFisicaFields` em `AprovacaoOrcamentoDialog.tsx` exibe `<span className="text-destructive">*</span>` em todos os campos (Nome, CPF, RG, Estado Civil, Endereço, CEP, Estado, Cidade, Telefone, Email) nas linhas 91-139. A validação foi removida, mas os asteriscos permanecem.

**Correção:** Aceitar uma prop `required` (default `true`) no componente `PessoaFisicaFields` e, quando `false`, não renderizar os asteriscos. Na chamada do Responsável QSA, passar `required={false}`.

**Arquivo:** `src/components/AprovacaoOrcamentoDialog.tsx`

---

### Problema 2: Botão "Novo" do ClienteSelector é insuficiente nos fluxos finais

O `ClienteSelector` ao clicar "Novo" abre um dialog que pede apenas Nome e Telefone, criando um cliente incompleto. Nos fluxos de Pago e Resumo para Contrato isso não faz sentido — o formulário completo já está ali.

**Solução:** Quando o usuário clica "Novo" nos fluxos finais, em vez de abrir o mini-dialog, limpar o cliente selecionado e deixar o formulário da etapa atual em branco para preenchimento normal. O cliente será criado/salvo automaticamente ao confirmar a etapa (lógica que já existe no `handleConfirmAprovacao` e no `handleSalvar` do contrato).

**Implementação:**
- Adicionar prop opcional `onNovo` ao `ClienteSelector`. Quando fornecida, o botão "Novo" chama `onNovo()` em vez de abrir o dialog interno.
- Em `AprovacaoOrcamentoDialog.tsx` e `InformacoesClienteDialog.tsx`, passar `onNovo` que limpa o `clienteSelecionado` e reseta os campos do formulário para vazios, permitindo preenchimento livre.

**Arquivos:**
- `src/components/ClienteSelector.tsx` — adicionar prop `onNovo`
- `src/components/AprovacaoOrcamentoDialog.tsx` — passar `onNovo`, remover asteriscos QSA
- `src/components/InformacoesClienteDialog.tsx` — passar `onNovo`

