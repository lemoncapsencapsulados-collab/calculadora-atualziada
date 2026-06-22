## Visão geral

Quando uma conta a receber é liquidada no VHSys, o sistema vai:
1. Receber o webhook do VHSys (gatilho principal) **OU** detectar via rotina horária (fallback).
2. Reconfirmar via API do VHSys que a receita está realmente liquidada.
3. Localizar o orçamento interno correspondente (por CNPJ/CPF + nº do orçamento na observação da receita).
4. Marcar orçamento como **Pago** e gerar o pedido automaticamente, sem duplicar.
5. Registrar tudo em uma tabela de logs com reprocessamento manual.

Toda a lógica de conversão fica centralizada em **uma única função interna** reaproveitada pelo webhook, pela rotina horária e pelo botão "Reprocessar".

## Vínculo orçamento ↔ conta a receber

Conforme escolhido: **identificação por CNPJ/CPF + nº do orçamento**. Não há criação automática da receita no VHSys nesta entrega (o financeiro continua criando manualmente). O matching será:

- A função consulta a receita no VHSys e lê `cnpj_cli` e `obs_rec` (ou `descricao_rec`).
- Procura na tabela `orcamentos` por: status `enviado` + cliente com CNPJ/CPF compatível + `numero_orcamento` presente nas observações da receita.
- Quando achar, salva o `id_receita_vhsys` no orçamento como cache (evita rebuscar nas próximas execuções e serve como trava de unicidade).

**Requisito operacional:** o financeiro deve incluir o número do orçamento (ex.: `ORC-2026-0123`) no campo "descrição/observação" da conta a receber no VHSys. Vou documentar isso no painel admin de Logs.

## Mudanças no banco

Migration única adicionando:

1. Coluna `id_receita_vhsys bigint` (nullable, indexada UNIQUE) em `orcamentos` — cache do vínculo + trava de duplicidade.
2. Coluna `pedido_id_gerado uuid` em `orcamentos` — referência ao pedido criado (também serve como segunda trava).
3. Tabela `vhsys_eventos_log`:
   - `origem` (`webhook` | `polling` | `manual`)
   - `tipo_evento` (`receita.liquidada`, `receita.atualizada`, etc.)
   - `id_receita_vhsys`
   - `orcamento_id`, `pedido_id` (preenchidos se aplicável)
   - `status` (`sucesso`, `pendente`, `ignorado`, `erro`)
   - `mensagem`, `payload jsonb`, `resposta_vhsys jsonb`
   - timestamps
4. RLS: só `authenticated` lê; service_role escreve (webhook/cron usam service role).

## Edge functions

### `vhsys-webhook` (`verify_jwt = false`)
Endpoint: `https://<project>.functions.supabase.co/vhsys-webhook`
- Valida header `x-vhsys-secret` contra um novo secret `VHSYS_WEBHOOK_SECRET` (gerado automaticamente).
- Aceita payload do VHSys, extrai `id_receita_vhsys` do corpo (campo `data.id_receita` ou similar).
- Registra entrada no log e chama a função core. Sempre responde 200 rápido (boas práticas de webhook).

### `vhsys-processar-receita` (interna, `verify_jwt = false` mas exige `VHSYS_WEBHOOK_SECRET` no header)
**Função central reaproveitável.** Recebe `{ id_receita_vhsys }` e:
1. Consulta `GET /v2/receitas/{id}` no VHSys.
2. Valida pagamento: `liquidado_rec === 'Sim'` E `valor_pago_rec > 0` E `data_pagamento_rec` presente.
3. Se não pago → log `pendente` e retorna.
4. Localiza orçamento (CNPJ/CPF + nº orçamento na obs). Se não achar → log `ignorado`.
5. Trava de duplicidade: se `orcamento.pedido_id_gerado` já preenchido → log `ignorado` (idempotente).
6. Em transação:
   - `orcamentos.status = 'pago'`, salva `data_pagamento`, `id_receita_vhsys`, `valor_pago`, `forma_pagamento`.
   - Cria pedido copiando: cliente, itens_producao, servicos_marca, frete, condicoes_pagamento, observações, valor total (mesma lógica do `GerarPedidoDialog` atual, extraída para uma função compartilhada).
   - Salva `orcamentos.pedido_id_gerado` apontando para o novo pedido.
7. Log `sucesso`.

### `vhsys-cron-pagamentos` (chamada por cron horário, `verify_jwt = false` + header secret)
- Lista orçamentos com `status = 'enviado'` enviados nos últimos 90 dias.
- Para cada um sem `id_receita_vhsys`: consulta `GET /v2/receitas?cnpj_cli=...&data_emissao_de=...` filtrado pelo CNPJ do cliente, procura receita cuja obs contenha o número do orçamento; se encontrar, chama a função core.
- Para os que já têm `id_receita_vhsys` salvo: apenas chama a função core direto (rebusca status).

Agendamento via `pg_cron` + `pg_net` (1h em 1h), seguindo o padrão da plataforma.

## Frontend

Nova página `/admin/vhsys-logs` (protegida pelo `AdminPasswordGate` já existente), adicionada ao `Navigation` apenas para admins:

- Tabela com últimos 200 eventos: data, origem (badge), tipo, id_receita, orçamento (link), status (badge colorido), mensagem.
- Linha expansível mostrando `payload` e `resposta_vhsys` em JSON.
- Botão **Reprocessar** nas linhas com `status = 'erro'` ou `pendente` → chama `vhsys-processar-receita` com origem `manual`.
- Card de instruções no topo: "Para que a conversão automática funcione, inclua o número do orçamento (ex.: `ORC-2026-0123`) na descrição da conta a receber no VHSys."
- Botão "Verificar agora" que dispara a rotina cron manualmente.

Nenhuma mudança em fluxos existentes de orçamento, pedido, cliente ou produtos — só leituras e o caminho automático novo.

## Segurança

- Webhook protegido por `VHSYS_WEBHOOK_SECRET` (gerado via `generate_secret`, configurado no VHSys ao cadastrar a URL).
- `VHSYS_ACCESS_TOKEN` e `VHSYS_SECRET_SERVICE` continuam só no backend.
- Cron usa service role internamente; URL com secret no header.
- Validações de schema (zod) em todas as entradas; nunca confiar no payload do webhook isoladamente — sempre reconsultar a API antes de converter.
- Logs nunca expõem tokens (sanitização do payload).

## Etapas de entrega

1. **Migration:** colunas em `orcamentos` + tabela `vhsys_eventos_log` + grants/RLS.
2. **Refator:** extrair lógica de "criar pedido a partir de orçamento" do `GerarPedidoDialog` para `src/lib/converterOrcamentoEmPedido.ts` (sem mudar comportamento atual).
3. **Edge functions:** `vhsys-processar-receita`, `vhsys-webhook`, `vhsys-cron-pagamentos`.
4. **Secret:** gerar `VHSYS_WEBHOOK_SECRET`.
5. **Cron:** SQL via `supabase--insert` agendando `vhsys-cron-pagamentos` a cada hora.
6. **UI admin:** página `VhsysLogs.tsx` + rota + item de nav.
7. **Instrução final ao usuário:** cadastrar o webhook no VHSys (`POST /v2/webhook` com `entidade=receitas`, `url=<edge function>`, `secret=<gerado>`) e treinar o financeiro a colocar o nº do orçamento na descrição da receita.

## Detalhes técnicos relevantes

- Webhook do VHSys é por **entidade**; usaremos `entidade=receitas` (mesma usada para contas a receber).
- Como o payload do webhook só carrega o ID, sempre haverá uma chamada `GET` à API antes de processar — alinhado ao requisito de "não confiar só no webhook".
- A trava de duplicidade tem duas camadas: `UNIQUE (id_receita_vhsys)` em `orcamentos` + checagem `pedido_id_gerado IS NULL` antes de criar. Reentrância segura.
- Cron horário consulta no máximo ~200 orçamentos abertos por execução, dentro do rate limit típico do VHSys.
- Polling de 1h significa pior caso ~60min de atraso até criar pedido se o webhook falhar — aceitável conforme escolhido.
