## Plano: Persistência e Visualização do Resumo para Contrato

Toda vez que o usuário gerar um "Resumo para Contrato", o PDF + os dados preenchidos serão salvos. No card do orçamento (lista e kanban) aparecerá um botão "Ver Resumo do Contrato" que abre o popup já pré-preenchido, com opção de baixar. Ao salvar uma nova versão, a anterior é substituída automaticamente.

### 1. Backend (Migration)

**Novo bucket privado de Storage**
- `contratos` (private). Caminho: `contratos/{orcamento_id}/{timestamp}.pdf`.
- RLS: apenas usuários autenticados podem `SELECT/INSERT/UPDATE/DELETE` em `storage.objects WHERE bucket_id='contratos'`.

**Nova tabela `resumos_contrato`**
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `orcamento_id` | uuid | índice único — 1 resumo ativo por orçamento |
| `cliente_id` | uuid | nullable |
| `numero_orcamento` | text | snapshot |
| `nome_cliente` | text | snapshot |
| `dados_cliente` | jsonb | snapshot completo do form |
| `detalhamento_frete` | jsonb | |
| `condicoes_pagamento` | jsonb | |
| `detalhes_producao` | jsonb | por item |
| `pdf_path` | text | path no bucket `contratos` |
| `pdf_size_bytes` | int | |
| `created_at` / `updated_at` | timestamptz | default now() |

- RLS: 4 políticas para `authenticated` (`auth.uid() IS NOT NULL`), seguindo o padrão das demais tabelas.
- Constraint `UNIQUE(orcamento_id)` — garante substituição via upsert.
- Sem foreign keys (consistência com o resto do schema).

### 2. Hook `useResumoContrato` (novo)

`src/hooks/useResumoContrato.ts`
- `useResumoContrato(orcamentoId)` → query que retorna o resumo + signed URL do PDF (válida ~1h via `storage.from('contratos').createSignedUrl(path, 3600)`).
- `salvarResumo({ orcamento, dadosCliente, detalhamentoFrete, condicoesPagamento, detalhesProducao, pdfBlob })`:
  1. Busca resumo existente por `orcamento_id`.
  2. Se existir, deleta o arquivo antigo do bucket (`storage.remove([oldPath])`).
  3. Faz upload do novo PDF: `storage.upload(newPath, blob, { contentType: 'application/pdf', upsert: true })`.
  4. Faz `upsert` na tabela `resumos_contrato` com `onConflict: 'orcamento_id'`.
- `baixarPdf(path)` → cria signed URL e dispara download.
- `excluirResumo(id, path)` (utilitário, opcional para já cobrir limpezas).

### 3. `PropostaCompletaDialog` (atualizar)

- Aceitar nova prop opcional `modo: 'editar' | 'visualizar'` (default `'editar'`).
- Ao montar, se já existe `resumo_contrato` para o orçamento, **pré-preencher todos os campos** (dados_cliente, frete, condições de pagamento, detalhes de produção) a partir do snapshot salvo, sobrescrevendo o pré-preenchimento atual baseado em `orcamento.dados_cliente`. O usuário pode editar tudo livremente.
- Ao clicar em "Gerar/Salvar Resumo": além das atualizações já feitas no orçamento e em `clientes`, chamar `salvarResumo(...)` passando o `pdfBlob` já gerado. Toast: "Resumo de contrato salvo. Versão anterior substituída.".
- Botão "Baixar PDF" continua funcionando (faz download do blob recém-gerado).
- Em `modo: 'visualizar'` (acionado pelo novo botão no card), abre direto na tela de preview com o PDF do storage (via signed URL no `<iframe>`), com botões "Editar" (volta para o formulário pré-preenchido) e "Baixar".

### 4. Card do orçamento (Lista e Kanban)

Adicionar botão **"Ver Resumo do Contrato"** (ícone `FileSignature` ou `FileCheck2`, cor `outline`) que aparece **apenas se o orçamento já possui resumo salvo** (consulta agregada — ver passo 5). Ao clicar, abre `PropostaCompletaDialog` em `modo: 'visualizar'`.

Layout:
```text
[Editar] [Gerar PDF] [Resumo para Contrato] [Ver Resumo do Contrato*] [Excluir]
                                              └─ * só aparece se já existe
```

- `src/pages/Orcamentos.tsx`: novo state `verResumoOrcamento`, botão condicional, render do dialog em modo visualizar.
- `src/components/OrcamentoKanbanView.tsx`: mesmo botão (icon-only) no rodapé do card.

### 5. Hook auxiliar `useResumosContratoIds`

Para evitar N+1, criar `useResumosContratoExistentes()` que retorna um `Set<string>` com `orcamento_id` que possuem resumo salvo. Usado pelos componentes de lista/kanban para decidir se mostram o botão. Invalidação ao salvar/excluir resumo.

### 6. Detalhes técnicos

- Naming PDF: `contratos/{orcamento_id}/{Date.now()}.pdf` (timestamp evita cache de signed URL).
- Substituição: como `UNIQUE(orcamento_id)` está na tabela, usamos `upsert({...}, { onConflict: 'orcamento_id' })`. O arquivo antigo é deletado **antes** do upload do novo via `storage.remove`.
- Signed URL: `createSignedUrl(path, 3600)` — recriada toda vez que o dialog abre.
- Snapshot: o jsonb salva exatamente o que foi preenchido no momento do clique (independente de futuras edições do orçamento).
- Sem alteração nos status do kanban — o botão é sempre visível quando há resumo, em qualquer coluna.

### Arquivos afetados

- **Migration nova:** criar tabela `resumos_contrato` + bucket `contratos` + RLS.
- **Criado:** `src/hooks/useResumoContrato.ts`.
- **Editado:** `src/components/PropostaCompletaDialog.tsx` (modo visualizar, pré-preenchimento por resumo salvo, salvar PDF/dados).
- **Editado:** `src/pages/Orcamentos.tsx` (botão "Ver Resumo do Contrato" + state).
- **Editado:** `src/components/OrcamentoKanbanView.tsx` (mesmo botão no card).

### Fora de escopo

- Histórico de versões anteriores (apaga a versão antiga conforme solicitado).
- Notificação/log de quem alterou.
