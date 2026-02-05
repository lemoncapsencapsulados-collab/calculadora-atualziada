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

// ========== LAYOUT COMPACTO PARA PÁGINA ÚNICA A4 ==========
const LAYOUT = {
  margin: 12,
  marginBottom: 12,
  headerHeight: 28,
  sectionGap: 4,
  lineHeight: 4.5,
  fontSize: {
    title: 14,
    sectionTitle: 9,
    body: 8,
    small: 7,
    footer: 6,
  }
};

const COLORS = {
  darkGreen: [21, 87, 36] as [number, number, number],
  lightGreenBg: [240, 247, 242] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  textDark: [60, 60, 60] as [number, number, number],
  textGray: [100, 100, 100] as [number, number, number],
};

const PAGE_HEIGHT = 297;
const MAX_SINGLE_PAGE_HEIGHT = 265;

// Estimar altura para modo de página única
function estimatePropostaHeight(formula: Formula): number {
  const headerHeight = LAYOUT.headerHeight + LAYOUT.sectionGap;
  const infoHeight = 18;
  const composicaoHeight = 15 + Math.min(formula.itens.length * 5, 50);
  const valoresHeight = 35;
  const dosagemHeight = formula.unidades_por_dose ? 12 : 0;
  const footerHeight = 15;
  
  return headerHeight + infoHeight + composicaoHeight + valoresHeight + dosagemHeight + footerHeight;
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

export async function gerarPropostaPDF(data: PropostaData) {
  const { formula, precoUnitario, quantidadeFrascos, valorServicosExtras } = data;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Calcular modo de página
  const estimatedHeight = estimatePropostaHeight(formula);
  const singlePageMode = estimatedHeight <= MAX_SINGLE_PAGE_HEIGHT;
  const maxIngredientes = singlePageMode ? 10 : 30;
  
  console.log(`[Proposta] Altura estimada: ${estimatedHeight}mm, Modo: ${singlePageMode ? 'página única' : 'múltiplas'}`);
  
  try {
    let yPos = 0;

    // ========== HEADER COMPACTO ==========
    doc.setFillColor(...COLORS.darkGreen);
    doc.rect(0, 0, pageWidth, LAYOUT.headerHeight, 'F');
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text('LEMON CAPS', LAYOUT.margin, 14);
    
    doc.setFontSize(LAYOUT.fontSize.title);
    doc.text('PROPOSTA COMERCIAL', pageWidth - LAYOUT.margin, 12, { align: 'right' });
    
    doc.setFontSize(LAYOUT.fontSize.body);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), "dd/MM/yyyy", { locale: ptBR }), pageWidth - LAYOUT.margin, 20, { align: 'right' });

    yPos = LAYOUT.headerHeight + LAYOUT.sectionGap + 2;

    // ========== INFORMAÇÕES DO PRODUTO ==========
    doc.setFillColor(...COLORS.lightGreenBg);
    doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
    doc.setFontSize(LAYOUT.fontSize.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('INFORMAÇÕES DO PRODUTO', LAYOUT.margin + 3, yPos + 4);
    yPos += 9;

    doc.setFontSize(LAYOUT.fontSize.body);
    doc.setTextColor(...COLORS.textDark);

    // Info em formato mais compacto (2 colunas)
    const col1X = LAYOUT.margin;
    const col2X = pageWidth / 2;
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('Produto:', col1X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(formula.nome_formula, col1X + 18, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('Cliente:', col2X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(formula.cliente, col2X + 16, yPos);
    yPos += LAYOUT.lineHeight;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('Tipo:', col1X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(formula.tipo_produto, col1X + 18, yPos);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('Unid/Frasco:', col2X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(`${formula.qtd_capsulas}`, col2X + 24, yPos);
    yPos += LAYOUT.lineHeight + LAYOUT.sectionGap;

    // ========== COMPOSIÇÃO DA FÓRMULA ==========
    doc.setFillColor(...COLORS.lightGreenBg);
    doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
    doc.setFontSize(LAYOUT.fontSize.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('COMPOSIÇÃO DA FÓRMULA', LAYOUT.margin + 3, yPos + 4);
    yPos += 8;

    const ingredientesExibir = formula.itens.slice(0, maxIngredientes);
    const ingredientesOcultos = formula.itens.length - maxIngredientes;

    const formulaData = ingredientesExibir.map((item: any) => {
      const concentracao = item.concentracao_percentual 
        ? `${item.concentracao_percentual.toFixed(1)}%`
        : '-';
      return [
        item.nome_insumo_snapshot,
        `${item.qtd_informada} ${item.unidade_informada}`,
        concentracao,
      ];
    });

    // Adicionar linha de resumo se houver ingredientes ocultos
    if (ingredientesOcultos > 0) {
      formulaData.push([`... e mais ${ingredientesOcultos} ingrediente(s)`, '', '']);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Ingrediente', 'Qtd/Unidade', 'Conc.']],
      body: formulaData,
      theme: 'plain',
      headStyles: { 
        fillColor: COLORS.darkGreen,
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: LAYOUT.fontSize.small,
        cellPadding: 1.5,
        halign: 'center'
      },
      styles: { 
        fontSize: LAYOUT.fontSize.body, 
        cellPadding: 1.5, 
        textColor: COLORS.textDark 
      },
      alternateRowStyles: { fillColor: [250, 252, 250] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: LAYOUT.margin, right: LAYOUT.margin },
    });

    yPos = doc.lastAutoTable.finalY + LAYOUT.sectionGap + 2;

    // ========== VALORES DA PROPOSTA ==========
    doc.setFillColor(...COLORS.lightGreenBg);
    doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
    doc.setFontSize(LAYOUT.fontSize.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('VALORES DA PROPOSTA', LAYOUT.margin + 3, yPos + 4);
    yPos += 9;

    const valorFrascos = precoUnitario * quantidadeFrascos;
    const valorTotal = valorFrascos + valorServicosExtras;

    const valoresData: [string, string][] = [
      ['Preço Unitário (frasco)', `R$ ${formatarMoeda(precoUnitario)}`],
      ['Quantidade', `${quantidadeFrascos} unidades`],
      ['Subtotal Produto', `R$ ${formatarMoeda(valorFrascos)}`],
    ];

    if (valorServicosExtras > 0) {
      valoresData.push(['Serviços Extras', `R$ ${formatarMoeda(valorServicosExtras)}`]);
    }

    autoTable(doc, {
      startY: yPos,
      body: valoresData,
      theme: 'plain',
      styles: { 
        fontSize: LAYOUT.fontSize.body, 
        cellPadding: 1.5,
        textColor: COLORS.textDark
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80, textColor: COLORS.darkGreen },
        1: { halign: 'right', cellWidth: 'auto' },
      },
      margin: { left: LAYOUT.margin, right: LAYOUT.margin },
    });

    yPos = doc.lastAutoTable.finalY + 3;

    // ========== VALOR TOTAL (DESTAQUE) ==========
    doc.setFillColor(...COLORS.darkGreen);
    doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 12, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL:', LAYOUT.margin + 6, yPos + 8);
    doc.setFontSize(14);
    doc.text(`R$ ${formatarMoeda(valorTotal)}`, pageWidth - LAYOUT.margin - 6, yPos + 8, { align: 'right' });

    yPos += 15 + LAYOUT.sectionGap;

    // ========== INFORMAÇÕES DE DOSAGEM ==========
    if (formula.unidades_por_dose) {
      doc.setFontSize(LAYOUT.fontSize.sectionTitle);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.darkGreen);
      doc.text('INFORMAÇÕES DE DOSAGEM', LAYOUT.margin, yPos);
      yPos += 5;
      
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      
      const unidadeTexto = formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                           formula.tipo_produto === 'Gummy' ? 'gummies' :
                           formula.tipo_produto === 'Líquido' ? 'mL' : 'g';
      
      const dosesInfo = [
        `Dose: ${formula.unidades_por_dose} ${unidadeTexto}`,
        `Doses/frasco: ${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)}`,
        `Total doses: ${Math.floor((formula.qtd_capsulas / formula.unidades_por_dose) * quantidadeFrascos)}`
      ].join(' | ');
      
      doc.text(dosesInfo, LAYOUT.margin, yPos);
      yPos += LAYOUT.lineHeight + LAYOUT.sectionGap;
    }

    // ========== FOOTER ==========
    const footerY = PAGE_HEIGHT - LAYOUT.marginBottom;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(LAYOUT.margin, footerY - 10, pageWidth - LAYOUT.margin, footerY - 10);

    doc.setFontSize(LAYOUT.fontSize.footer);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.textGray);
    doc.text('Proposta válida por 30 dias. Valores sujeitos a alteração.', pageWidth / 2, footerY - 6, { align: 'center' });

    doc.setDrawColor(...COLORS.darkGreen);
    doc.setLineWidth(0.3);
    doc.line(LAYOUT.margin, footerY - 2, pageWidth - LAYOUT.margin, footerY - 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text(
      `Lemon Caps - Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      footerY + 2,
      { align: 'center' }
    );

  } catch (error) {
    console.error('Erro ao gerar proposta:', error);
    // Fallback mínimo
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('LEMON CAPS - Proposta Comercial', 20, 30);
    doc.setFontSize(10);
    doc.text(`Produto: ${formula.nome_formula}`, 20, 40);
    doc.text(`Cliente: ${formula.cliente}`, 20, 48);
    doc.text(`Total: R$ ${formatarMoeda(precoUnitario * quantidadeFrascos + valorServicosExtras)}`, 20, 56);
  }

  // Salvar PDF
  const nomeArquivo = `proposta_${formula.nome_formula.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(nomeArquivo);
}
