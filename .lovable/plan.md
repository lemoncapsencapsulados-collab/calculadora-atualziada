## Objetivo

Você continua gerando a cobrança direto no painel do Asaas (do jeito que já faz hoje). Quando o cliente pagar, o webhook chega aqui e o sistema **acha o orçamento sozinho pelo CNPJ/CPF do pagador** — sem colar ID, sem botão novo, sem mexer em nada no Asaas.

## Como vai funcionar

1. Você gera a cobrança no Asaas como sempre fez.
2. Cliente paga → Asaas dispara `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` para o webhook.
3. Edge function `asaas-webhook` recebe o evento e:
   - Busca o **customer** no Asaas via API (`GET /customers/{id}`) pra pegar o `cpfCnpj`.
   - Normaliza (só dígitos) e procura na tabela `orcamentos` por CNPJ/CPF dentro de `dados_cliente` (PJ ou PF).
   - Filtra apenas orçamentos com `status IN ('rascunho','enviado')`.
4. Decisão de match:
   - **1 orçamento** → marca como `pago`, salva `data_pagamento`, `asaas_payment_id`, gera pedido.
   - **Vários abertos** → casa pelo de **valor mais próximo** ao `value` da cobrança (tolerância R$ 0,01). Se ainda empatar, pega o **mais recente** e registra log.
   - **Nenhum** → grava na nova tabela `asaas_webhook_pendentes` pra você revisar manualmente num painel simples.
5. Idempotência: se `asaas_payment_id` já consta em algum orçamento pago, ignora o evento (evita parcela duplicada / reenvio do Asaas).

## Parcelado

Asaas manda 1 webhook por parcela. Como você quer "só marcar pago quando todas confirmarem":
- No primeiro webhook de uma cobrança parcelada (campo `installment` preenchido), o sistema busca `GET /installments/{id}` pra saber o total de parcelas.
- Salva em `pagamentos_recebidos jsonb` cada parcela recebida + `asaas_parcelas_total`.
- Status vira `pago` só quando `pagamentos_recebidos.length === asaas_parcelas_total`.

## Casos de borda

- **Cliente sem CNPJ/CPF no orçamento** → vai pra fila de pendentes.
- **CNPJ existe mas nenhum orçamento aberto** → fila de pendentes (pode ser pagamento avulso ou recompra antiga).
- **Estorno (`PAYMENT_REFUNDED`)** → só logamos, status não muda automaticamente.
- **Pagamento manual** → arrastar o card pra "Pago" no Kanban continua funcionando.

## Mudanças técnicas

**Banco** (migração):
- `orcamentos`: `asaas_payment_id text`, `asaas_installment_id text`, `asaas_parcelas_total int`, `pagamentos_recebidos jsonb default '[]'`, índice em `asaas_payment_id`.
- Nova tabela `asaas_webhook_pendentes` (id, payload jsonb, cpf_cnpj, valor, motivo, resolved boolean, created_at) — RLS pra `authenticated`.

**Edge function nova**: `supabase/functions/asaas-webhook/index.ts` com `verify_jwt = false`. Valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`. Usa `ASAAS_API_KEY` pra consultar customer/installment.

**Frontend**: nenhuma mudança obrigatória. Opcional: pequeno badge "X/Y parcelas" no card do Kanban quando `asaas_parcelas_total > 1`, e uma página simples `/asaas-pendentes` listando a fila pra você reconciliar com 1 clique (vincular ao orçamento certo).

**Secrets necessários**:
- `ASAAS_API_KEY` (você cadastra)
- `ASAAS_WEBHOOK_TOKEN` (você define qualquer string e cola no painel Asaas)
- `ASAAS_BASE_URL` (sandbox ou produção)

**Configuração no Asaas (1 vez)**:
- URL: `https://nawhpweyisawxaymmusg.supabase.co/functions/v1/asaas-webhook`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`
- Token: mesmo valor de `ASAAS_WEBHOOK_TOKEN`

## Risco honesto do match por CNPJ

Se o mesmo cliente tem 2 orçamentos abertos com valores muito parecidos, o automático pode acertar o "errado". Por isso o desempate por valor + a fila de pendentes — assim nada some, no pior caso fica esperando você confirmar.
