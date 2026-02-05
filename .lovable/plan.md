
## Plano: Garantir PDF em Página Única A4 - Sem Exceções

### Problemas Identificados

1. **Preview do PDF**: O iframe mostra tela preta porque alguns navegadores não exibem PDFs inline corretamente. Precisa de fallback com link direto.

2. **Quebra de Páginas**: Mesmo com `singlePageMode`, o PDF ainda pode ultrapassar 1 página se houver muito conteúdo porque o cálculo de altura não está preciso o suficiente.

3. **Falta de Limite Forçado**: O sistema tenta estimar altura mas não FORÇA o conteúdo a caber em uma página.

---

### Solução Proposta: Layout Ultra-Compacto Forçado

Criar um sistema que SEMPRE gera uma única página A4, independente da quantidade de conteúdo:

| Seção | Altura Fixa | Estratégia |
|-------|-------------|------------|
| Header | 25mm | Compactar logo + info inline |
| Cliente | 18mm | Máximo 3 linhas |
| Produtos | 70mm máx | Limitar a 6 itens |
| Serviços | 30mm máx | Limitar a 3 itens |
| Frete | 12mm | Uma linha inline |
| Total | 14mm | Box compacto |
| Pagamento + Obs | 10mm | Truncar texto |
| Footer | 10mm | Linha única |
| **Total** | **~189mm** | Sobra ~80mm margem |

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/lib/orcamentoGenerator.ts` | Forçar layout de página única com limites rígidos |
| `src/lib/propostaGenerator.ts` | Sincronizar mesma abordagem |
| `src/components/PreviewPdfDialog.tsx` | Adicionar fallback para navegadores que não exibem PDF inline |

---

### Detalhes Técnicos

#### 1. Novo LAYOUT Forçado em orcamentoGenerator.ts

```typescript
const LAYOUT = {
  margin: 12,
  marginBottom: 10,
  headerHeight: 25,  // Reduzido de 28
  sectionGap: 2,     // Reduzido de 3
  lineHeight: 4,
  fontSize: {
    title: 12,       // Reduzido de 14
    sectionTitle: 8, // Reduzido de 9
    body: 7,         // Reduzido de 8
    small: 6,        // Reduzido de 7
    footer: 6,
  },
  // Limites rígidos
  maxProdutos: 6,
  maxServicos: 3,
  maxInsumos: 2,
};
```

#### 2. Limites Forçados nas Tabelas

```typescript
function renderProdutos(doc, orcamento, yPos) {
  const MAX_PRODUTOS = 6;
  const itens = orcamento.itens_producao || [];
  const itensExibir = itens.slice(0, MAX_PRODUTOS);
  const restantes = itens.length - MAX_PRODUTOS;
  
  // Tabela com altura máxima fixa
  // Se restantes > 0, adicionar linha "... e mais X produto(s)"
}
```

#### 3. Truncamento Forçado de Textos

```typescript
function truncateText(doc, text, maxWidth) {
  let truncated = text.replace(/\n/g, ' ');
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length < text.length ? truncated + '...' : text;
}
```

#### 4. Box Total Mais Compacto

```typescript
function renderTotal(doc, orcamento, yPos) {
  const totalBoxHeight = 12; // Reduzido de 16
  
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'F');
  
  // Fonte menor
  doc.setFontSize(9);
  doc.text('VALOR TOTAL:', LAYOUT.margin + 5, yPos + 8);
  
  doc.setFontSize(13); // Reduzido de 16
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - LAYOUT.margin - 5, yPos + 8, { align: 'right' });
}
```

#### 5. Fix no PreviewPdfDialog

```typescript
// Adicionar type ao blob para garantir exibição correta
const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

// Adicionar fallback com botão "Abrir em Nova Aba"
{pdfUrl && (
  <div className="flex flex-col items-center gap-3">
    <iframe src={pdfUrl} className="w-full h-full" />
    <Button variant="link" onClick={() => window.open(pdfUrl, '_blank')}>
      Não consegue ver? Abrir em nova aba
    </Button>
  </div>
)}
```

---

### Sincronização com propostaGenerator.ts

Aplicar mesmas constantes e estratégias:

```typescript
const LAYOUT = {
  margin: 12,
  headerHeight: 25,
  sectionGap: 2,
  lineHeight: 4,
  fontSize: { title: 12, sectionTitle: 8, body: 7, small: 6 },
  maxIngredientes: 8,
};
```

---

### Visualização do Layout Final A4

```text
┌─────────────────────────────────────────────────────┐ ← 0mm
│ LEMON CAPS          ORÇAMENTO | Consultor | Data   │ ← Header 25mm
├─────────────────────────────────────────────────────┤ ← 25mm
│ CLIENTE                                             │
│ Nome Cliente | Email | Tel                          │ ← Cliente 18mm
│ CNPJ | Razão Social                                 │
├─────────────────────────────────────────────────────┤ ← 43mm
│ PRODUTOS                                            │
│ # | Produto (composição)      | Qtd | Unit | Total │
│ 1 | Produto A (Ins1, Ins2...) |  10 | R$X  | R$Y  │
│ 2 | Produto B (Ins3...)       |   5 | R$X  | R$Y  │ ← Produtos ~60mm
│ ... e mais X produto(s)                            │
│                          SUBTOTAL PRODUÇÃO: R$XXX  │
├─────────────────────────────────────────────────────┤ ← 103mm
│ SERVIÇOS                                            │
│ Plano | Descrição | Valor                          │ ← Serviços ~25mm
│                          SUBTOTAL SERVIÇOS: R$XXX  │
├─────────────────────────────────────────────────────┤ ← 128mm
│ FRETE: Logística X | Frete LC: SIM | Tabela: Trad  │ ← Frete 10mm
├─────────────────────────────────────────────────────┤ ← 138mm
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ VALOR TOTAL:                        R$ 12.345  │ │ ← Total 14mm
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤ ← 152mm
│ Forma de Pagamento: 30% entrada + 70% na entrega...│ ← Pag 8mm
│ Obs: Texto truncado se necessário...               │ ← Obs 6mm
├─────────────────────────────────────────────────────┤ ← 166mm
│ ─────────────────────────────────────────────────  │
│ Validade: 30 dias | LEMON CAPS - www.lemoncaps...  │ ← Footer 10mm
└─────────────────────────────────────────────────────┘ ← ~176mm (A4 = 297mm)
```

**Altura total estimada: ~176mm** - Muito abaixo do limite de 297mm da A4!

---

### Resultado Esperado

1. **SEMPRE 1 página A4** - Sem exceções
2. **Preview funcionando** - Com fallback para nova aba se necessário
3. **Fontes legíveis** - 7pt mínimo (ainda legível)
4. **Layout elegante** - Bem organizado e separado por seções
5. **Sem cortes** - Tudo visível em uma única folha
6. **Consistência** - Orçamento e Proposta seguem mesmo padrão
