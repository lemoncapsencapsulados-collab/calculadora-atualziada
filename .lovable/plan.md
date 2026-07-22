## Objetivo

Ao clicar em "Baixar imagem (PNG)" na página **Logística** (tanto na listagem por produtor quanto no drill-down "Ver produtos"), abrir um **PopUp de prévia** com a cotação renderizada e dois botões: **Copiar imagem** e **Baixar imagem**.

## Mudanças

### 1. `src/components/frete/CotacaoPreviewDialog.tsx` — novo componente
- Dialog (`max-w-3xl`) que recebe `cotacao`, `produtor`, `numeroOrc` e `onClose`.
- Renderiza `<CotacaoExportCard>` visível (dentro de um container scrollável, escala reduzida para caber no dialog) usando `ref` para captura.
- Ao montar, gera o PNG via `html2canvas` (mesma config do `freteImageExport`) e guarda o `canvas`/`dataUrl` + `Blob` em state, mostrando spinner enquanto processa.
- Botões no footer:
  - **Copiar imagem**: usa `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`. Fallback com toast de erro caso a Clipboard API não suporte `image/png`.
  - **Baixar imagem**: dispara download do mesmo blob (nome `frete_<numeroOrc>_<produto>.png`, mesma regra atual).
  - **Fechar**.
- Toasts de sucesso/erro via `sonner`.

### 2. `src/lib/freteImageExport.ts` — pequena extensão
- Adicionar `renderElementToPngBlob(el)` que retorna `{ blob, dataUrl }` a partir do `html2canvas` (reutilizado pelo novo dialog). Manter `exportElementAsPng` como está para retrocompatibilidade.

### 3. `src/pages/Logistica.tsx` — trocar download direto por prévia
- Substituir a chamada atual de `baixarImagem(cotacao)` (que renderiza off-screen e dispara download) por abrir o novo `CotacaoPreviewDialog`.
- Aplicar nos dois pontos onde o botão "Baixar imagem (PNG)" aparece hoje:
  - Card do produtor (lista principal).
  - Drill-down "Ver produtos" por cotação.
- Remover o container off-screen usado só para exportação; o dialog agora hospeda o `CotacaoExportCard`.

### 4. `src/components/frete/FreteOrcamentoDialog.tsx` — mesma prévia em Orçamentos
- Trocar o atual "Baixar PNG" (download direto) por abrir `CotacaoPreviewDialog`, mantendo o mesmo componente compartilhado.

## Fora do escopo
- Nenhuma mudança em PDFs, schema, ou no `CotacaoExportCard` (layout do PNG continua idêntico).
- Sem alteração no fluxo de criação/edição de cotações.
