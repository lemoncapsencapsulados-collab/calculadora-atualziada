## Objetivo
Mostrar detalhes completos de cada cobrança retornada pelo Asaas — incluindo parcela (nº/total), datas de vencimento, forma de pagamento amigável, descontos/juros/multa, número da fatura, links (fatura, boleto, comprovante) e informações de assinatura, seguindo o modelo do objeto `Payment` da API (docs.asaas.com).

## 1. Edge Function `asaas-consultar-vendas`
Ampliar o mapeamento de `itens` para incluir todos os campos úteis do payload do Asaas:
- `installment` (id do grupo de parcelamento), `installmentNumber`, `installmentCount` — para exibir "Parcela X/Y".
  - Quando `installment` estiver presente e `installmentCount` não vier no objeto, buscar `/installments/{id}` (com cache por id) para obter total de parcelas.
- `subscription` (assinatura recorrente).
- `dueDate`, `originalDueDate`, `clientPaymentDate`, `confirmedDate`, `creditDate`.
- `billingType` (mapeado para PT-BR: Boleto, Cartão, Pix, Transferência, etc.).
- `discount.value`, `fine.value`, `interest.value` (quando existirem).
- `invoiceNumber`, `invoiceUrl`, `bankSlipUrl`, `transactionReceiptUrl`, `nossoNumero`.
- `externalReference`, `description`.
- Nome do cliente (já feito) + email/cpfCnpj do cliente (adicionar ao cache de `/customers/{id}`).
- Dados essenciais de cartão quando `billingType = CREDIT_CARD` (`creditCard.creditCardBrand`, `creditCardNumber` últimos 4).

Manter compat: os campos antigos (`valor`, `liquido`, `forma`, etc.) continuam presentes.

## 2. UI — `AsaasConsultaCard.tsx`
- Adicionar seção **"Detalhes das cobranças"** (colapsável) abaixo da tabela "Por cliente".
- Tabela com colunas: Data pagto · Cliente · Descrição · Forma · Parcela (ex.: `3/12`) · Vencimento · Bruto · Líquido · Ações.
- Coluna Ações: botões-ícone para abrir `invoiceUrl`, `bankSlipUrl` e `transactionReceiptUrl` em nova aba (quando existirem).
- Ícone/badge indicando "Assinatura" quando `subscription` presente e "Parcelado" quando `installment` presente.
- Linha expansível (`Collapsible`) por cobrança mostrando: Nº fatura, externalReference, nosso número, descontos/juros/multa, e-mail/CPF do cliente, bandeira/final do cartão.
- Formatar `billingType` via helper (`labelFormaPagamento`).

## 3. PDF (opcional, leve)
- Manter o PDF atual; adicionar tabela extra "Detalhes das cobranças" com colunas resumidas (Data · Cliente · Forma · Parcela · Bruto · Líquido) quando houver `itens`.

## 4. Fora do escopo
- Não alterar cálculo de comissão, salvar consulta, ou integração com `RelatorioComissoes`.
- Não implementar emissão de NF (documentação apenas consultada) — apenas exibir `invoiceNumber` já existente.

Sem migrations, sem novas secrets.
