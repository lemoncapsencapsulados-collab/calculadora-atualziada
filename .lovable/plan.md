## Objetivo

Permitir múltiplos contratos por pedido (igual aos comprovantes) e criar uma central de "Documentos do Pedido" onde seja possível visualizar em popup e baixar tanto contratos quanto comprovantes.

## Mudanças

### 1. Hook `usePedidoAnexos.ts`
- Remover a regra que bloqueia upload de mais de 1 contrato por pedido (atualmente em `uploadAnexo`).
- Manter `tipo: 'contrato' | 'comprovante'`.

### 2. Novo componente `DocumentosPedidoDialog.tsx`
Dialog único que substitui os botões separados de contrato/comprovante por uma visão centralizada:
- Duas seções: **Contratos** e **Comprovantes de Pagamento**.
- Cada item lista: nome do arquivo, data de upload e três ações:
  - **Visualizar** (popup): abre PDF/imagem em `<iframe>`/`<img>` dentro de um sub-dialog (sem sair da aba).
  - **Baixar**: força download (`<a download>` com `fetch` + `blob`).
  - **Remover**: chama `deleteAnexo`.
- Botões **"Adicionar Contrato"** e **"Adicionar Comprovante"** abaixo de cada seção, disparando o input de arquivo.

### 3. `src/pages/Pedidos.tsx`
- Substituir o bloco atual de botões (`Anexar/Ver Contrato` + `Anexar/Ver Comprovante`) por **um único botão "Documentos"** em cada card, com badges de contagem (ex.: `📎 Documentos (2 contratos · 3 comprovantes)`).
- Esse botão abre o novo `DocumentosPedidoDialog`.
- Remover o `comprovantesDialogPedidoId` antigo e seu Dialog inline (substituídos pelo novo).
- Manter `contratoInputRef` / `comprovanteInputRef` e `handleFileUpload` (reutilizados pelo novo dialog via callbacks).

### 4. Visualização em popup
- PDFs: `<iframe src={url} className="w-full h-[80vh]" />`.
- Imagens (jpg/png): `<img src={url} className="max-h-[80vh] mx-auto" />`.
- Outros formatos (doc/docx): mostrar mensagem "Visualização indisponível — clique em Baixar".
- Detecção por extensão do `arquivo_nome`.

### 5. Download
- Função utilitária `downloadAnexo(anexo)` que faz `fetch(url) → blob → URL.createObjectURL → <a download>`.
- Garante nome original do arquivo no download (em vez do path do storage).

## Não muda
- Bucket `pedidos-anexos` (já público) e tabela `pedido_anexos` (estrutura atual já suporta múltiplos registros).
- RLS já permite `SELECT/INSERT/DELETE` para autenticados.
- Comportamento da regra de senha, snapshots de pedido, exportação Excel.

## Arquivos
- `src/hooks/usePedidoAnexos.ts` — remover trava de 1 contrato; adicionar helper `downloadAnexo`.
- `src/components/pedidos/DocumentosPedidoDialog.tsx` — **novo**.
- `src/pages/Pedidos.tsx` — trocar bloco de botões por botão único "Documentos" e abrir o novo dialog; remover dialog antigo de comprovantes.