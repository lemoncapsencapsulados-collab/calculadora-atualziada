
## Plano: PDF Profissional de Alto Padrão com Layout Expandido

### Objetivo

Criar um PDF elegante e minimalista de alto padrão que:
1. Utilize toda a folha A4 com espaçamento generoso
2. Mostre TODAS as informações sem cortes ou resumos
3. Use múltiplas páginas quando necessário com layout consistente
4. Tenha estética premium e profissional

---

### Comparação: Layout Atual vs Novo Layout

| Aspecto | Layout Atual (Ultra-compacto) | Novo Layout (Premium) |
|---------|------------------------------|----------------------|
| Margem | 12mm | 20mm |
| Fonte título | 12pt | 18pt |
| Fonte corpo | 7pt | 10pt |
| Fonte pequena | 6pt | 9pt |
| Max produtos | 6 (truncado) | Ilimitado |
| Max serviços | 3 (truncado) | Ilimitado |
| Max insumos | 2 (truncado) | Todos |
| Espaçamento | 2mm entre seções | 8mm entre seções |
| Páginas | Forçado 1 página | Quantas necessárias |

---

### Novo Layout Premium - Estrutura

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │ ← Margem 20mm
│   ╭─────────────────────────────────────────────────╮   │
│   │                  LEMON CAPS                     │   │ ← Header 40mm
│   │                                                 │   │
│   │  ORÇAMENTO COMERCIAL           Nº ORÇ-2024-XXX │   │
│   │  Consultor: Nome               Data: XX/XX/XX  │   │
│   ╰─────────────────────────────────────────────────╯   │
│                                                         │ ← 12mm espaço
│   ─────────────────────────────────────────────────     │
│   DADOS DO CLIENTE                                      │ ← Seção 50mm
│   ─────────────────────────────────────────────────     │
│                                                         │
│   Nome: Cliente Exemplo Ltda                            │
│   Email: cliente@email.com                              │
│   Telefone: (11) 99999-9999                            │
│   CNPJ: 00.000.000/0000-00                             │
│   Razão Social: Empresa Exemplo                        │
│   Endereço: Rua X, 123 - São Paulo/SP                  │
│   Canal de Venda: Digital e Físico                     │
│                                                         │ ← 12mm espaço
│   ─────────────────────────────────────────────────     │
│   PRODUTOS                                              │ ← Tabela expandida
│   ─────────────────────────────────────────────────     │
│                                                         │
│   # │ Produto              │ Segmento   │ Qtd │ Unit   │
│   ─────────────────────────────────────────────────     │
│   1 │ Whey Protein         │ Esportivo  │ 100 │ R$ XX  │
│     │ Composição:                                      │
│     │ • Whey Isolado - 30g                             │
│     │ • Creatina - 5g                                  │
│     │ • Vitamina D - 1000 UI                           │
│   ─────────────────────────────────────────────────     │
│   2 │ Colágeno Premium     │ Beleza     │ 50  │ R$ XX  │
│     │ Composição:                                      │
│     │ • Colágeno Hidrolisado - 10g                     │
│     │ • Ácido Hialurônico - 100mg                      │
│   ─────────────────────────────────────────────────     │
│                                                         │
│                     SUBTOTAL PRODUÇÃO: R$ XX.XXX,XX    │
│                                                         │
└─────────────────────────────────────────────────────────┘
                    ─── Página 1 de 2 ───

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ─────────────────────────────────────────────────     │
│   SERVIÇOS DE MARCA                                     │
│   ─────────────────────────────────────────────────     │
│                                                         │
│   Serviço           │ Descrição              │ Valor   │
│   Plano Premium     │ Consultoria completa   │ R$ XXX  │
│   Design Label      │ Arte da embalagem      │ R$ XXX  │
│                                                         │
│                     SUBTOTAL SERVIÇOS: R$ XX.XXX,XX    │
│                                                         │ ← 12mm espaço
│   ─────────────────────────────────────────────────     │
│   DETALHAMENTO DE FRETE                                 │
│   ─────────────────────────────────────────────────     │
│                                                         │
│   Tipo de Logística: Logística Lemon Caps              │
│   Frete Lemon Caps: SIM                                │
│   Tabela: Tradicional                                   │
│                                                         │
│   Planos Customizados:                                 │
│   • Encapsulados: Até 5 POTES - R$ 34,80              │
│   • Solúvel: 3 a 5 POTES - R$ 54,40                   │
│                                                         │ ← 16mm espaço
│   ╔═════════════════════════════════════════════════╗   │
│   ║                                                 ║   │ ← Box Total 28mm
│   ║   VALOR TOTAL                    R$ 12.345,67  ║   │
│   ║                                                 ║   │
│   ╚═════════════════════════════════════════════════╝   │
│                                                         │ ← 12mm espaço
│   ─────────────────────────────────────────────────     │
│   FORMA DE PAGAMENTO                                    │
│   ─────────────────────────────────────────────────     │
│                                                         │
│   30% de entrada via PIX, 70% restante em até 3x      │
│   no cartão de crédito, após aprovação da arte        │
│                                                         │ ← 8mm espaço
│   ─────────────────────────────────────────────────     │
│   OBSERVAÇÕES                                           │
│   ─────────────────────────────────────────────────     │
│                                                         │
│   Produto será entregue em até 15 dias úteis após     │
│   confirmação do pagamento. Frete grátis para SP.     │
│                                                         │
│   ─────────────────────────────────────────────────     │
│                                                         │
│   Este orçamento tem validade de 30 dias.              │
│                                                         │
│   LEMON CAPS - www.lemoncaps.com.br                    │
│                                                         │ ← Margem 20mm
└─────────────────────────────────────────────────────────┘
                    ─── Página 2 de 2 ───
```

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/lib/orcamentoGenerator.ts` | Refatorar completamente para layout premium expandido |
| `src/lib/propostaGenerator.ts` | Aplicar mesmo padrão visual premium |

---

### Detalhes Técnicos

#### 1. Novo LAYOUT Premium

```typescript
const LAYOUT = {
  margin: 20,           // Margem generosa
  headerHeight: 40,     // Header grande e elegante
  sectionGap: 8,        // Espaçamento entre seções
  lineHeight: 6,        // Altura de linha confortável
  fontSize: {
    title: 18,          // Títulos grandes
    sectionTitle: 11,   // Subtítulos legíveis
    body: 10,           // Corpo de texto legível
    small: 9,           // Notas e detalhes
    footer: 9,          // Rodapé
  },
};
```

#### 2. Paleta de Cores Minimalista

```typescript
const COLORS = {
  // Tons escuros elegantes
  darkGreen: [24, 26, 0],      // Quase preto esverdeado
  mediumGreen: [46, 48, 3],    // Verde escuro
  
  // Acentos sofisticados
  lemonYellow: [202, 212, 0],  // Amarelo limão
  
  // Neutros minimalistas
  white: [255, 255, 255],
  lightGray: [248, 248, 248],  // Fundo alternado
  borderGray: [220, 220, 220], // Linhas sutis
  
  // Texto
  textDark: [40, 40, 40],      // Texto principal
  textMedium: [80, 80, 80],    // Texto secundário
  textLight: [120, 120, 120],  // Texto terciário
};
```

#### 3. Sistema de Múltiplas Páginas

```typescript
function checkPageBreak(doc: jsPDF, currentY: number, requiredHeight: number): number {
  const pageHeight = 297;
  const bottomMargin = 25;
  const availableSpace = pageHeight - bottomMargin;
  
  if (currentY + requiredHeight > availableSpace) {
    doc.addPage();
    addPageHeader(doc);  // Header em páginas subsequentes
    return LAYOUT.margin + 10;  // Nova posição Y
  }
  return currentY;
}

function addPageFooter(doc: jsPDF, pageNumber: number, totalPages: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = 297;
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Página ${pageNumber} de ${totalPages}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}
```

#### 4. Composição Expandida dos Produtos

Em vez de mostrar composição inline truncada, mostrar lista completa:

```typescript
function renderProdutoExpandido(doc: jsPDF, item: ItemProducao, yPos: number): number {
  // Nome do produto em destaque
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.text(item.nome_produto, LAYOUT.margin + 10, yPos);
  yPos += 5;
  
  // Detalhes do produto
  if (item.quantidade_por_pote && item.unidade_por_pote) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(LAYOUT.fontSize.small);
    doc.text(`${item.quantidade_por_pote} ${item.unidade_por_pote} por frasco`, LAYOUT.margin + 10, yPos);
    yPos += 4;
  }
  
  // Composição completa (todos os insumos)
  if (item.insumos_formula && item.insumos_formula.length > 0) {
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Composição:', LAYOUT.margin + 10, yPos);
    yPos += 4;
    
    for (const insumo of item.insumos_formula) {
      yPos = checkPageBreak(doc, yPos, 5);
      doc.text(`• ${insumo.nome} - ${insumo.quantidade} ${insumo.unidade}`, LAYOUT.margin + 15, yPos);
      yPos += 4;
    }
  }
  
  return yPos + 3;
}
```

#### 5. Dados do Cliente Expandidos

Mostrar cada campo em sua própria linha:

```typescript
function renderDadosClienteExpandido(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const dados = orcamento.dados_cliente;
  
  // Cada campo em linha separada com label
  const campos = [
    { label: 'Nome', valor: orcamento.nome_cliente },
    { label: 'Email', valor: dados?.email },
    { label: 'Telefone', valor: dados?.telefone },
    { label: 'CPF', valor: dados?.cpf },
    { label: 'CNPJ', valor: dados?.cnpj },
    { label: 'Razão Social', valor: dados?.razao_social },
    { label: 'Endereço', valor: formatEndereco(dados) },
    { label: 'Canal de Venda', valor: formatCanalVenda(dados?.forma_venda) },
  ];
  
  for (const campo of campos) {
    if (campo.valor) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${campo.label}:`, LAYOUT.margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(campo.valor, LAYOUT.margin + 25, yPos);
      yPos += LAYOUT.lineHeight;
    }
  }
  
  return yPos;
}
```

#### 6. Frete Detalhado

Mostrar informações de frete em formato estruturado:

```typescript
function renderFreteDetalhado(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const frete = orcamento.detalhamento_frete;
  
  // Tipo de logística
  if (frete.detalhamento_envio) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo de Logística:', LAYOUT.margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(getTipoLogisticaLabel(frete.detalhamento_envio.tipo), LAYOUT.margin + 35, yPos);
    yPos += LAYOUT.lineHeight;
    
    if (frete.detalhamento_envio.descricao_parcial) {
      doc.text(`Detalhes: ${frete.detalhamento_envio.descricao_parcial}`, LAYOUT.margin, yPos);
      yPos += LAYOUT.lineHeight;
    }
  }
  
  // Frete LC
  doc.setFont('helvetica', 'bold');
  doc.text('Frete Lemon Caps:', LAYOUT.margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(frete.frete_lemon_caps ? 'SIM' : 'NÃO', LAYOUT.margin + 35, yPos);
  yPos += LAYOUT.lineHeight;
  
  // Tabela
  if (frete.usa_tabela_tradicional) {
    doc.text('Tabela de Preços: Tradicional', LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight;
  }
  
  // Planos customizados
  if (frete.planos_customizados?.length > 0) {
    yPos += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Planos de Frete:', LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight;
    
    for (const plano of frete.planos_customizados) {
      doc.setFont('helvetica', 'normal');
      doc.text(`• ${plano.tipo_produto}: ${plano.plano} - ${formatCurrency(plano.valor)}`, LAYOUT.margin + 5, yPos);
      yPos += 5;
    }
  }
  
  return yPos;
}
```

#### 7. Box de Total Premium

```typescript
function renderTotalPremium(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxHeight = 24;
  
  yPos = checkPageBreak(doc, yPos, boxHeight + 10);
  yPos += 8;  // Espaço antes do box
  
  // Box com gradiente simulado
  doc.setFillColor(...COLORS.darkGreen);
  doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, boxHeight, 2, 2, 'F');
  
  // Borda sutil
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(1);
  doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, boxHeight, 2, 2, 'S');
  
  // Texto
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL', LAYOUT.margin + 10, yPos + 15);
  
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(18);
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - LAYOUT.margin - 10, yPos + 16, { align: 'right' });
  
  return yPos + boxHeight + 10;
}
```

---

### Resultado Esperado

1. **Layout Premium**: Margens generosas, espaçamento confortável
2. **Informações Completas**: Nada truncado ou omitido
3. **Múltiplas Páginas**: Quebras automáticas quando necessário
4. **Estética Minimalista**: Cores sutis, tipografia elegante
5. **Alto Padrão**: Aparência profissional e sofisticada
6. **Consistência**: Orçamento e Proposta com mesmo visual

