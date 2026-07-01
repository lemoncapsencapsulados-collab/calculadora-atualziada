## Objetivo

No fluxo de "Projeto para Contrato", substituir o envio direto/ZapSign do preview por um fluxo de envio do PDF por e-mail ao Financeiro (`financeiro@lemoncaps.com.br`), com etapa de resumo e confirmação.

## Alterações de UI (`src/components/PropostaCompletaDialog.tsx`)

1. **Renomear** o botão principal do rodapé do dialog de geração:
  - De: `Gerar Projeto para Contrato`
  - Para: `Enviar contrato para Financeiro`
  - (Mantém a ação atual: gerar o PDF e abrir a tela de preview.)
2. **Tela de Preview (resumo antes do envio)** — substituir o rodapé atual (`Voltar`, `Cadastrar Cliente no VhSys`, `Baixar PDF`, `Enviar para ZapSign`) por exatamente 3 botões:
  - **Baixar Documento** — chama `handleDownload()` existente.
  - **Voltar e editar documento** — fecha o preview (`setShowPreview(false)`) e retorna ao formulário "Projeto para Contrato" com todos os dados preservados (comportamento de "voltar" simples, sem resetar estado).
  - **Enviar Documento** — dispara envio do PDF por e-mail. Enquanto envia mostra spinner + "Enviando..."; após sucesso, o botão vira verde (`bg-green-600`) com texto "Enviado" e fica desabilitado. Em caso de erro, `toast` de erro e o botão volta ao estado inicial.
  - Manter o iframe do PDF acima dos botões.
3. **Mover Cadastrar no VhSys e Enviar para ZapSign** para outro local (ou remover deste preview, já que o usuário pediu exatamente 3 opções). Proposta: **remover** desse preview, pois o envio ao ZapSign já é acionado por outro botão no fluxo do orçamento (`OrcamentoKanbanView`/`Orcamentos`). Confirmar se pode remover — se não, mantemos apenas os 3 solicitados e escondemos os outros dois.

## Envio de e-mail

O domínio `notify.calculadora.lemoncaps.com.br` está com verificação DNS **falha**. O envio de e-mails só funcionará depois que o domínio for verificado com sucesso em Project Settings → Email. O usuário precisa reverificar / contatar suporte. Enquanto isso, o botão vai retornar erro no envio.

Nova Edge Function `enviar-projeto-financeiro`:

- Input: `{ pdfBase64, filename, consultorNome, razaoSocial, cnpj, orcamentoId }`.
- Enfileira via `send-transactional-email` com novo template `projeto-contrato-financeiro` e um `attachment` inline? **Restrição:** o sistema de e-mail Lovable não suporta anexos. Alternativa: fazer upload do PDF no bucket `contratos` (privado), gerar signed URL de 7 dias e enviar o link no corpo do e-mail.
- Destinatário fixo: `financeiro@lemoncaps.com.br`.
- Assunto: `Resumo Para Contrato Produtor Lemon Caps`.
- Corpo (subtítulo/título): `Consultor: {consultorNome} — {razaoSocial || cnpj}`, seguido de link para baixar o PDF e resumo básico (cliente, valor total, condições).

Novo template React Email em `supabase/functions/_shared/transactional-email-templates/projeto-contrato-financeiro.tsx` seguindo o padrão do registry.

## Passos técnicos

1. Verificar/rodar `email_domain--setup_email_infra` (idempotente) e `scaffold_transactional_email` se ainda não houver.
2. Criar template `projeto-contrato-financeiro` e registrar em `registry.ts`.
3. Criar edge function `enviar-projeto-financeiro` que:
  - Faz upload do PDF (base64) em `contratos/projetos/{orcamentoId}-{timestamp}.pdf`.
  - Gera signed URL (7 dias).
  - Invoca `send-transactional-email` com `templateData: { consultorNome, razaoSocial, cnpj, pdfUrl, valorTotal, cliente }` e `idempotencyKey: projeto-financeiro-{orcamentoId}-{timestamp}`.
4. `deploy_edge_functions` para as funções alteradas.
5. Ajustar `PropostaCompletaDialog.tsx` conforme UI acima; adicionar estado `enviadoFinanceiro` para trocar o botão para verde "Enviado".

## Aviso ao usuário

- Domínio de e-mail está com verificação DNS falha — precisa ser corrigido antes que o envio funcione.
- Nessa etapa de resumo para contrato não está na fase de cadastro do pedido no Zapsign pois será feito manual mesmo sem vinculo no momento com o Zapsign