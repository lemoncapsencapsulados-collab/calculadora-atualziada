
## Plano: Otimização dos PDFs para A4 com Layout Responsivo e Legível

### Objetivo
Reformular completamente a geração de PDFs em `orcamentoGenerator.ts` para garantir:
- Layout perfeitamente enquadrado em folhas A4
- Fonte em tamanho legível sem necessidade de zoom
- Quebras de página automáticas inteligentes (sem cortar conteúdo)
- Margens adequadas e espaçamento elegante
- Visualização correta em mobile e desktop

---

### Problemas Identificados

| Problema | Causa |
|----------|-------|
| Conteúdo cortado entre páginas | Verificação de altura insuficiente antes de adicionar seções |
| Fontes pequenas demais | Tamanhos de 8-9pt para texto principal |
| Layout desorganizado | Espaçamento inconsistente entre seções |
| Margens inadequadas | Margem de 20mm pode ser ajustada |
| Quebras de página manuais | Falta de verificação automática de espaço restante |

---

### Solução Proposta

#### 1. Constantes de Layout Padronizadas

```typescript
const LAYOUT = {
  margin: 15,           // Margem lateral padrão
  marginTop: 15,        // Margem superior
  marginBottom: 25,     // Margem inferior (espaço para footer)
  headerHeight: 45,     // Altura do cabeçalho
  sectionGap: 8,        // Espaço entre seções
  lineHeight: 5,        // Altura de linha padrão
  fontSize: {
    title: 18,          // Títulos principais
    sectionTitle: 11,   // Títulos de seção
    body: 10,           // Texto principal
    small: 9,           // Texto secundário
    footer: 8,          // Rodapé
  }
};
```

#### 2. Função de Verificação de Página

```typescript
function checkPageBreak(doc: jsPDF, yPos: number, requiredHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const safeBottom = pageHeight - LAYOUT.marginBottom;
  
  if (yPos + requiredHeight > safeBottom) {
    doc.addPage();
    addPageHeader(doc); // Adiciona cabeçalho reduzido em páginas seguintes
    return LAYOUT.marginTop + 15;
  }
  return yPos;
}
```

#### 3. Cabeçalho Compacto para Páginas Adicionais

```typescript
function addPageHeader(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageWidth, 15, 'F');
  
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('LEMON CAPS - Orçamento Comercial', LAYOUT.margin, 10);
}
```

#### 4. Footer em Todas as Páginas

```typescript
function addPageFooter(doc: jsPDF, pageNumber: number, totalPages: number): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.3);
  doc.line(LAYOUT.margin, pageHeight - 18, pageWidth - LAYOUT.margin, pageHeight - 18);
  
  doc.setTextColor(...COLORS.textGray);
  doc.setFontSize(8);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
  doc.text('LEMON CAPS - www.lemoncaps.com.br', pageWidth / 2, pageHeight - 7, { align: 'center' });
}
```

---

### Alterações por Seção

#### Header Principal (Página 1)
- Altura reduzida de 50mm para 45mm
- Logo e título melhor posicionados
- Fontes maiores para legibilidade

#### Dados do Cliente
- Fonte aumentada de 9pt para 10pt
- Espaçamento entre linhas de 5mm para 6mm
- Verificação de quebra de página antes de iniciar

#### Tabela de Produtos
- Verificação de altura estimada antes de cada produto
- Se não couber, inicia nova página
- Cabeçalho da tabela repetido em cada página

#### Composição da Fórmula
- Fonte aumentada de 8pt para 9pt
- Verificação de espaço antes de listar insumos
- Se lista for longa, pode continuar em próxima página

#### Serviços de Marca
- Verificação de espaço antes da seção
- Tabela com autoTable já gerencia quebras

#### Detalhamento de Frete
- Verificação de espaço antes da seção
- Texto com quebra automática (splitTextToSize)

#### Valor Total
- Box sempre em posição adequada
- Verificação para não ficar cortado

#### Forma de Pagamento e Observações
- Verificação de espaço antes de cada
- Quebra de linha automática para textos longos

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/lib/orcamentoGenerator.ts` | Refatoração completa com layout padronizado, quebras de página automáticas, fontes legíveis e footer em todas as páginas |

---

### Detalhes Técnicos

#### Estrutura do Código Refatorado

```typescript
// 1. Constantes de layout e cores
const LAYOUT = { ... };
const COLORS = { ... };

// 2. Funções utilitárias
function formatCurrency(value: number): string { ... }
function checkPageBreak(doc: jsPDF, yPos: number, requiredHeight: number): number { ... }
function addPageHeader(doc: jsPDF): void { ... }
function addFooterToAllPages(doc: jsPDF): void { ... }

// 3. Funções de seção (cada uma verifica espaço antes de renderizar)
function renderHeader(doc: jsPDF, orcamento: Orcamento): number { ... }
function renderDadosCliente(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderProdutos(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderServicos(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderFrete(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderTotal(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderFormaPagamento(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderObservacoes(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }
function renderValidade(doc: jsPDF, orcamento: Orcamento, yPos: number): number { ... }

// 4. Função principal
async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  let yPos = renderHeader(doc, orcamento);
  yPos = renderDadosCliente(doc, orcamento, yPos);
  yPos = renderProdutos(doc, orcamento, yPos);
  yPos = renderServicos(doc, orcamento, yPos);
  yPos = renderFrete(doc, orcamento, yPos);
  yPos = renderTotal(doc, orcamento, yPos);
  yPos = renderFormaPagamento(doc, orcamento, yPos);
  yPos = renderObservacoes(doc, orcamento, yPos);
  yPos = renderValidade(doc, orcamento, yPos);
  
  addFooterToAllPages(doc);
  
  return doc;
}
```

#### Tamanhos de Fonte Atualizados

| Elemento | Antes | Depois |
|----------|-------|--------|
| Título principal | 20pt | 18pt |
| Título seção | 10-11pt | 11pt |
| Texto principal | 9pt | 10pt |
| Composição | 8pt | 9pt |
| Footer | 8pt | 8pt |

#### Verificação de Quebra de Página

Antes de cada seção, verificar se há espaço suficiente:

```typescript
// Exemplo: antes de renderizar Valor Total
const totalBoxHeight = 30; // altura estimada
yPos = checkPageBreak(doc, yPos, totalBoxHeight);
```

---

### Resultado Esperado

1. PDF sempre enquadrado em A4 (210mm x 297mm)
2. Margens uniformes de 15mm nas laterais
3. Fontes legíveis sem necessidade de zoom (10pt para texto principal)
4. Quebras de página automáticas antes de cada seção
5. Nenhum conteúdo cortado entre páginas
6. Footer com numeração em todas as páginas
7. Visualização adequada em mobile e desktop
8. Espaçamento elegante e padronizado
