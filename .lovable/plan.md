## Objetivo
Impedir que o botão **"Enviar contrato para Financeiro"** seja clicado enquanto houver campos obrigatórios em branco no "Projeto para Contrato". Hoje a validação só dispara depois do clique (via `toast.error`), permitindo a sensação de que é possível avançar sem preencher.

## Mudanças (apenas em `src/components/PropostaCompletaDialog.tsx`)

1. **Função `getCamposPendentes()`** que devolve a lista de pendências avaliando em tempo real:
   - **Cliente PJ**: `CNPJ` com 14 dígitos, `Razão Social`, `Endereço`, `CEP`, `Cidade`, `Estado`, `Email`, `Responsável (nome + CPF)`.
   - **Cliente PF**: pelo menos 1 pessoa com `Nome` e `CPF` válido; `Endereço` e `Email` do contratante.
   - **Detalhamento do Frete**: opção selecionada (Produtor ou Lemon Caps) e `detalhamento_envio` preenchido.
   - **Condições de Pagamento**: usa `validarCondicoesPagamento()` já existente (método, parcelas, vencimentos e soma = valor total).
   - **Itens de produção**: pelo menos um item presente.

2. **Botão "Enviar contrato para Financeiro"**:
   - `disabled` quando `getCamposPendentes().length > 0` ou `isSubmitting`.
   - Tooltip/label auxiliar mostrando a quantidade de pendências (ex.: "Preencha 3 campos obrigatórios").

3. **Painel de pendências acima do footer**: quando houver itens faltando, exibe um `Alert` destructive com a lista clicável — clicar rola/foca no card correspondente (Cliente, Frete, Pagamento). Isso substitui o toast pós-clique.

4. **Marcadores visuais nos cards**: badge "obrigatório" ao lado dos títulos "1. Dados do Cliente", "4. Detalhamento do Frete" e reforço de asterisco vermelho nos labels dos campos obrigatórios que ainda não têm.

5. **Preserva a validação atual** (`handleGenerateProposta` mantém checagens como defesa em profundidade) — apenas remove-se o caminho onde o usuário conseguiria clicar sem preencher.

## Fora de escopo
- Não altera o fluxo do preview (3 botões), envio de email, ou geração do PDF.
- Não altera regras de negócio das condições de pagamento nem cálculos.
- Não mexe em ZapSign, VHSys ou outras integrações.
