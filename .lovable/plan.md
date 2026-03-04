

# Botão "Ficha Técnica" com Preview PDF nos Pedidos Gerados

## Resumo
Adicionar um botão com ícone de impressora em cada card de pedido que abre um popup de preview do PDF da Ficha Técnica. O popup permite visualizar, baixar ou imprimir.

## Alterações

### 1. Nova função `gerarFichaTecnicaPDFBlob` — `src/lib/pdfGenerator.ts`
Criar função que gera um PDF A4 com jsPDF contendo:
- **Cabeçalho**: "FICHA TÉCNICA" + número do pedido + data de geração
- **Informações do Cliente**: nome, email, telefone, CNPJ, inscrição estadual, razão social, cidade/estado, forma de venda
- **Consultor Responsável**
- **Produtos**: para cada item — nome, segmento, quantidade, dose diária, detalhes de produção (cor tampa/pote, sabor, cor), e tabela de insumos da fórmula (nome, quantidade, unidade)
- Retorna `Blob` (para preview) e uma variante que faz `doc.save()` (para download)

### 2. Novo componente `FichaTecnicaDialog.tsx`
Dialog com preview do PDF (padrão similar ao `PreviewPdfDialog`):
- Gera o blob via `gerarFichaTecnicaPDFBlob`
- Exibe em `<iframe>` 
- Botões: "Fechar", "Baixar PDF", "Imprimir" (via `window.print()` ou `iframe.contentWindow.print()`)
- Fallback "Abrir em nova aba" caso iframe não renderize

### 3. `src/pages/Pedidos.tsx` — Botão no card
- Adicionar ícone `Printer` (lucide) ao lado dos botões existentes (Ver Detalhes, Editar Obs, Excluir)
- Ao clicar, abre `FichaTecnicaDialog` passando o pedido
- Visível apenas para pedidos com `orcamento_snapshot` (que têm dados completos)

## Arquivos
- `src/lib/pdfGenerator.ts` — nova função de geração de Ficha Técnica
- `src/components/FichaTecnicaDialog.tsx` — novo componente de preview
- `src/pages/Pedidos.tsx` — botão com ícone Printer

