import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Formula } from '@/types/formula';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

interface PropostaData {
  formula: Formula;
  precoUnitario: number;
  quantidadeFrascos: number;
  valorServicosExtras: number;
}

// ========== LAYOUT PREMIUM - ALTO PADRÃO ==========
const LAYOUT = {
  margin: 20,           // Margem generosa
  marginBottom: 25,     // Margem inferior para footer
  headerHeight: 40,     // Header grande e elegante
  sectionGap: 10,       // Espaçamento entre seções
  lineHeight: 6,        // Altura de linha confortável
  fontSize: {
    title: 18,          // Títulos grandes
    sectionTitle: 11,   // Subtítulos legíveis
    body: 10,           // Corpo de texto legível
    small: 9,           // Notas e detalhes
    footer: 9,          // Rodapé
  },
};

// Paleta de cores minimalista e elegante
const COLORS = {
  // Tons escuros elegantes
  darkGreen: [24, 26, 0] as [number, number, number],
  mediumGreen: [46, 48, 3] as [number, number, number],
  
  // Acentos sofisticados
  lemonYellow: [202, 212, 0] as [number, number, number],
  brightYellow: [242, 255, 0] as [number, number, number],
  
  // Neutros minimalistas
  white: [255, 255, 255] as [number, number, number],
  lightGray: [248, 248, 248] as [number, number, number],
  borderGray: [220, 220, 220] as [number, number, number],
  
  // Texto
  textDark: [40, 40, 40] as [number, number, number],
  textMedium: [80, 80, 80] as [number, number, number],
  textLight: [120, 120, 120] as [number, number, number],
};

const PAGE_HEIGHT = 297;
const PAGE_WIDTH = 210;

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

function getPageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

function checkPageBreak(doc: jsPDF, currentY: number, requiredHeight: number): number {
  const availableSpace = PAGE_HEIGHT - LAYOUT.marginBottom;
  
  if (currentY + requiredHeight > availableSpace) {
    doc.addPage();
    return LAYOUT.margin + 10;
  }
  return currentY;
}

function renderSectionTitle(doc: jsPDF, title: string, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  
  yPos = checkPageBreak(doc, yPos, 15);
  
  // Título da seção
  doc.setTextColor(...COLORS.darkGreen);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), LAYOUT.margin, yPos);
  
  // Linha abaixo do título
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.8);
  doc.line(LAYOUT.margin, yPos + 3, pageWidth - LAYOUT.margin, yPos + 3);
  
  return yPos + 10;
}

export async function gerarPropostaPDF(data: PropostaData) {
  const { formula, precoUnitario, quantidadeFrascos, valorServicosExtras } = data;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  console.log(`[Proposta] Gerando proposta: ${formula.nome_formula} - Modo: Premium expandido`);
  
  try {
    let yPos = 0;

    // ========== HEADER ==========
    doc.setFillColor(...COLORS.darkGreen);
    doc.rect(0, 0, pageWidth, LAYOUT.headerHeight, 'F');
    
    // Logo
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('LEMON CAPS', LAYOUT.margin, 18);
    
    // Subtítulo
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Suplementos & Nutracêuticos', LAYOUT.margin, 26);
    
    // Título do documento
    doc.setFontSize(LAYOUT.fontSize.title);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPOSTA COMERCIAL', pageWidth - LAYOUT.margin, 16, { align: 'right' });
    
    // Data
    doc.setFontSize(LAYOUT.fontSize.body);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth - LAYOUT.margin, 26, { align: 'right' });

    // Linha de destaque
    doc.setDrawColor(...COLORS.lemonYellow);
    doc.setLineWidth(1);
    doc.line(0, LAYOUT.headerHeight, pageWidth, LAYOUT.headerHeight);

    yPos = LAYOUT.headerHeight + LAYOUT.sectionGap;

    // ========== INFORMAÇÕES DO PRODUTO ==========
    yPos = renderSectionTitle(doc, 'Informações do Produto', yPos);
    
    const labelWidth = 40;
    
    // Nome do produto em destaque
    doc.setTextColor(...COLORS.textDark);
    doc.setFontSize(LAYOUT.fontSize.body + 2);
    doc.setFont('helvetica', 'bold');
    doc.text(formula.nome_formula, LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight + 2;
    
    // Detalhes em duas colunas
    doc.setFontSize(LAYOUT.fontSize.body);
    
    const campos = [
      { label: 'Cliente', valor: formula.cliente },
      { label: 'Tipo de Produto', valor: formula.tipo_produto },
      { label: 'Unidades/Frasco', valor: `${formula.qtd_capsulas}` },
    ];
    
    if (formula.unidades_por_dose) {
      const unidadeTexto = formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                           formula.tipo_produto === 'Gummy' ? 'gummies' :
                           formula.tipo_produto === 'Líquido' ? 'mL' : 'g';
      campos.push({ label: 'Dose Sugerida', valor: `${formula.unidades_por_dose} ${unidadeTexto}` });
      campos.push({ label: 'Doses por Frasco', valor: `${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)}` });
    }
    
    for (const campo of campos) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textMedium);
      doc.text(`${campo.label}:`, LAYOUT.margin, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      doc.text(campo.valor, LAYOUT.margin + labelWidth, yPos);
      
      yPos += LAYOUT.lineHeight;
    }

    yPos += LAYOUT.sectionGap;

    // ========== COMPOSIÇÃO DA FÓRMULA ==========
    yPos = renderSectionTitle(doc, 'Composição da Fórmula', yPos);

    // Tabela com todos os ingredientes
    const formulaData = formula.itens.map((item: any) => {
      const concentracao = item.concentracao_percentual 
        ? `${item.concentracao_percentual.toFixed(2)}%`
        : '-';
      return [
        item.nome_insumo_snapshot,
        `${item.qtd_informada} ${item.unidade_informada}`,
        concentracao,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Ingrediente', 'Quantidade por Dose', 'Concentração']],
      body: formulaData,
      margin: { left: LAYOUT.margin, right: LAYOUT.margin },
      headStyles: { 
        fillColor: COLORS.darkGreen,
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: LAYOUT.fontSize.small,
        cellPadding: 4,
        halign: 'center'
      },
      bodyStyles: { 
        fontSize: LAYOUT.fontSize.body, 
        cellPadding: 4, 
        textColor: COLORS.textDark 
      },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 45, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' },
      },
      didDrawPage: () => {
        // Re-render header in new pages if needed
      }
    });

    yPos = doc.lastAutoTable.finalY + LAYOUT.sectionGap + 5;

    // ========== VALORES DA PROPOSTA ==========
    yPos = checkPageBreak(doc, yPos, 80);
    yPos = renderSectionTitle(doc, 'Valores da Proposta', yPos);

    const valorFrascos = precoUnitario * quantidadeFrascos;
    const valorTotal = valorFrascos + valorServicosExtras;

    // Box de valores
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 50, 2, 2, 'F');
    
    const valoresYStart = yPos + 8;
    const col1 = LAYOUT.margin + 10;
    const col2 = pageWidth - LAYOUT.margin - 10;
    
    // Preço unitário
    doc.setFontSize(LAYOUT.fontSize.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Preço Unitário (frasco):', col1, valoresYStart);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(`R$ ${formatarMoeda(precoUnitario)}`, col2, valoresYStart, { align: 'right' });
    
    // Quantidade
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Quantidade:', col1, valoresYStart + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(`${quantidadeFrascos} unidades`, col2, valoresYStart + 8, { align: 'right' });
    
    // Subtotal
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Subtotal Produto:', col1, valoresYStart + 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(`R$ ${formatarMoeda(valorFrascos)}`, col2, valoresYStart + 16, { align: 'right' });
    
    // Serviços extras (se houver)
    let servicosOffset = 0;
    if (valorServicosExtras > 0) {
      servicosOffset = 8;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textMedium);
      doc.text('Serviços Extras:', col1, valoresYStart + 24);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      doc.text(`R$ ${formatarMoeda(valorServicosExtras)}`, col2, valoresYStart + 24, { align: 'right' });
    }
    
    // Linha divisória
    doc.setDrawColor(...COLORS.borderGray);
    doc.setLineWidth(0.5);
    doc.line(col1, valoresYStart + 28 + servicosOffset, col2, valoresYStart + 28 + servicosOffset);
    
    // Total dentro do box
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.setFontSize(LAYOUT.fontSize.body + 2);
    doc.text('TOTAL:', col1, valoresYStart + 36 + servicosOffset);
    doc.setFontSize(LAYOUT.fontSize.body + 4);
    doc.text(`R$ ${formatarMoeda(valorTotal)}`, col2, valoresYStart + 36 + servicosOffset, { align: 'right' });

    yPos += 55 + servicosOffset + LAYOUT.sectionGap;

    // ========== VALOR TOTAL (DESTAQUE) ==========
    yPos = checkPageBreak(doc, yPos, 35);
    yPos += 5;
    
    const boxHeight = 28;
    doc.setFillColor(...COLORS.darkGreen);
    doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, boxHeight, 3, 3, 'F');
    
    // Borda amarela
    doc.setDrawColor(...COLORS.lemonYellow);
    doc.setLineWidth(1.5);
    doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, boxHeight, 3, 3, 'S');
    
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL', LAYOUT.margin + 12, yPos + 17);

    doc.setTextColor(...COLORS.brightYellow);
    doc.setFontSize(22);
    doc.text(`R$ ${formatarMoeda(valorTotal)}`, pageWidth - LAYOUT.margin - 12, yPos + 18, { align: 'right' });

    yPos += boxHeight + LAYOUT.sectionGap + 10;

    // ========== INFORMAÇÕES DE DOSAGEM ==========
    if (formula.unidades_por_dose) {
      yPos = checkPageBreak(doc, yPos, 40);
      yPos = renderSectionTitle(doc, 'Informações de Dosagem', yPos);
      
      const unidadeTexto = formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                           formula.tipo_produto === 'Gummy' ? 'gummies' :
                           formula.tipo_produto === 'Líquido' ? 'mL' : 'g';
      
      const dosesInfo = [
        { label: 'Dose Recomendada', valor: `${formula.unidades_por_dose} ${unidadeTexto}` },
        { label: 'Doses por Frasco', valor: `${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)}` },
        { label: 'Total de Doses (pedido)', valor: `${Math.floor((formula.qtd_capsulas / formula.unidades_por_dose) * quantidadeFrascos)}` },
      ];
      
      doc.setFontSize(LAYOUT.fontSize.body);
      
      for (const info of dosesInfo) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textMedium);
        doc.text(`${info.label}:`, LAYOUT.margin, yPos);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        doc.text(info.valor, LAYOUT.margin + 50, yPos);
        
        yPos += LAYOUT.lineHeight;
      }
    }

    // ========== FOOTER ==========
    const totalPages = doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const footerY = PAGE_HEIGHT - LAYOUT.marginBottom + 5;

      // Linha separadora
      doc.setDrawColor(...COLORS.lemonYellow);
      doc.setLineWidth(0.5);
      doc.line(LAYOUT.margin, footerY - 12, pageWidth - LAYOUT.margin, footerY - 12);

      // Validade
      doc.setTextColor(...COLORS.textMedium);
      doc.setFontSize(LAYOUT.fontSize.footer);
      doc.setFont('helvetica', 'italic');
      doc.text(
        'Esta proposta tem validade de 30 dias. Valores sujeitos a alteração sem aviso prévio.',
        LAYOUT.margin,
        footerY - 5
      );

      // Info da empresa
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.darkGreen);
      doc.text('LEMON CAPS', pageWidth - LAYOUT.margin, footerY - 5, { align: 'right' });
      
      doc.setTextColor(...COLORS.textLight);
      doc.setFontSize(8);
      doc.text('www.lemoncaps.com.br', pageWidth - LAYOUT.margin, footerY + 1, { align: 'right' });
      
      doc.text(
        `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        LAYOUT.margin,
        footerY + 1
      );

      // Número da página
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        footerY + 1,
        { align: 'center' }
      );
    }

    console.log(`[Proposta] Proposta gerada com ${doc.getNumberOfPages()} página(s)`);

  } catch (error) {
    console.error('Erro ao gerar proposta:', error);
    // Fallback mínimo
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('LEMON CAPS - Proposta Comercial', 20, 30);
    doc.setFontSize(12);
    doc.text(`Produto: ${formula.nome_formula}`, 20, 45);
    doc.text(`Cliente: ${formula.cliente}`, 20, 55);
    doc.text(`Total: R$ ${formatarMoeda(precoUnitario * quantidadeFrascos + valorServicosExtras)}`, 20, 65);
  }

  // Salvar PDF
  const nomeArquivo = `proposta_${formula.nome_formula.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(nomeArquivo);
}
