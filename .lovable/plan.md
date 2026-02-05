
## Plano: Corrigir Preview e Criar Layout Compacto de Pagina Unica A4

### Problemas Identificados

1. **Preview nao abre**: A funcao `generateOrcamentoPDFBlob` pode estar falhando silenciosamente no carregamento do logo ou na renderizacao
2. **Conteudo cortado**: O `checkPageBreak` nao previne cortes em todos os casos
3. **Nao cabe em uma pagina**: O layout atual gera multiplas paginas quando o orcamento tem muitos itens

---

### Solucao Proposta: Modo de Pagina Unica Compacto

Criar um layout otimizado que prioriza caber tudo em uma unica pagina A4:

#### Estrategia de Layout Compacto

| Secao | Altura Maxima | Otimizacao |
|-------|---------------|------------|
| Header | 35mm | Logo menor, fonte reduzida |
| Dados Cliente | 25mm | Formato inline, fonte 8pt |
| Tabela Produtos | Dinamica | Linhas condensadas, sem composicao detalhada |
| Servicos | 20mm | Tabela simples |
| Frete | 15mm | Texto inline |
| Total | 20mm | Box compacto |
| Forma Pagamento | 15mm | Texto condensado |
| Observacoes | 15mm | Truncar se necessario |
| Validade/Footer | 15mm | Rodape compacto |

**Altura util A4**: 297mm - 30mm margens = ~267mm disponivel

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/lib/orcamentoGenerator.ts` | Refatorar para layout compacto de pagina unica |
| `src/components/PreviewPdfDialog.tsx` | Melhorar tratamento de erros e fallback |

---

### Detalhes Tecnicos

#### 1. Novo Layout Compacto em orcamentoGenerator.ts

```typescript
const LAYOUT_COMPACT = {
  margin: 12,
  marginBottom: 15,
  headerHeight: 30,
  sectionGap: 4,
  lineHeight: 4,
  fontSize: {
    title: 14,
    sectionTitle: 9,
    body: 8,
    small: 7,
    footer: 7,
  }
};
```

#### 2. Header Compacto

- Logo: 30x12mm (menor)
- Titulo e dados alinhados horizontalmente
- Altura total: 30mm

#### 3. Dados do Cliente Compacto

```text
Cliente: Nome do Cliente | Email: email@test.com | Tel: (00) 00000-0000
CNPJ: 00.000.000/0000-00 | Razao Social: Empresa LTDA
```

#### 4. Tabela de Produtos Condensada

- Remover coluna de segmento
- Mostrar composicao inline: "Produto X (Insumo A, Insumo B...)"
- Fonte 8pt
- Altura de linha: 5mm

#### 5. Box Total Menor

- Altura: 15mm em vez de 28mm
- Fonte do valor: 16pt em vez de 20pt

#### 6. Tratamento de Overflow

```typescript
function fitToSinglePage(doc: jsPDF, totalHeight: number): void {
  const availableHeight = 267; // A4 - margens
  if (totalHeight > availableHeight) {
    const scale = availableHeight / totalHeight;
    // Aplicar escala ao documento se necessario
    // Ou truncar observacoes/detalhes secundarios
  }
}
```

---

### Correcoes no PreviewPdfDialog.tsx

```typescript
useEffect(() => {
  let objectUrl: string | null = null;
  let isMounted = true;

  async function loadPreview() {
    try {
      setIsLoading(true);
      setError(null);
      
      const blob = await generateOrcamentoPDFBlob(orcamento);
      
      if (!isMounted) return;
      
      if (!blob || blob.size === 0) {
        throw new Error('Blob vazio');
      }
      
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } catch (err) {
      console.error('Erro ao gerar preview:', err);
      if (isMounted) {
        setError(`Erro ao gerar PDF: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }

  loadPreview();

  return () => {
    isMounted = false;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  };
}, [orcamento]);
```

---

### Funcao Principal Atualizada

```typescript
async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  try {
    let yPos = await renderHeaderCompact(doc, orcamento);
    yPos = renderDadosClienteCompact(doc, orcamento, yPos);
    yPos = renderProdutosCompact(doc, orcamento, yPos);
    yPos = renderServicosCompact(doc, orcamento, yPos);
    yPos = renderFreteCompact(doc, orcamento, yPos);
    yPos = renderTotalCompact(doc, orcamento, yPos);
    yPos = renderFormaPagamentoCompact(doc, orcamento, yPos);
    yPos = renderObservacoesCompact(doc, orcamento, yPos);
    renderValidadeCompact(doc, orcamento, yPos);
    
    addFooterCompact(doc);
    renderStatusWatermark(doc, orcamento);
  } catch (error) {
    console.error('Erro ao criar PDF:', error);
    // Fallback: pelo menos o header
    doc.setFontSize(16);
    doc.text('Erro ao gerar PDF completo', 20, 50);
    doc.setFontSize(10);
    doc.text(`Orcamento: ${orcamento.numero_orcamento}`, 20, 60);
    doc.text(`Cliente: ${orcamento.nome_cliente}`, 20, 70);
  }

  return doc;
}
```

---

### Sequencia de Implementacao

1. **Atualizar orcamentoGenerator.ts** - Criar versao compacta de todas as funcoes
2. **Corrigir PreviewPdfDialog.tsx** - Melhorar tratamento de erros e lifecycle
3. **Testar em diferentes cenarios** - Orcamentos com poucos e muitos itens

---

### Resultado Esperado

- PDF sempre em uma unica pagina A4
- Fonte legivel (8-9pt para texto principal)
- Preview funcionando corretamente
- Sem conteudo cortado
- Layout elegante e profissional
