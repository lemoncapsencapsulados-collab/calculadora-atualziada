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

export async function gerarPropostaPDF(data: PropostaData) {
  const { formula, precoUnitario, quantidadeFrascos, valorServicosExtras } = data;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 15;

  // CABEÇALHO COM LOGO/MARCA
  doc.setFillColor(21, 87, 36); // Verde escuro
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('LEMON CAPS', pageWidth / 2, 20, { align: 'center' });
  
  yPosition = 30;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPOSTA COMERCIAL', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition = 38;
  doc.setFontSize(9);
  doc.text(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth / 2, yPosition, { align: 'center' });

  yPosition = 55;

  // INFORMAÇÕES DO PRODUTO
  doc.setFillColor(240, 247, 242); // Verde muito claro
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 87, 36); // Verde escuro
  doc.text('INFORMAÇÕES DO PRODUTO', 17, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  
  const infoProduto = [
    ['Nome:', formula.nome_formula],
    ['Cliente:', formula.cliente],
    ['Tipo:', formula.tipo_produto],
    ['Unidades por frasco:', `${formula.qtd_capsulas}`],
  ];

  infoProduto.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 87, 36);
    doc.text(label, 17, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(String(value), 65, yPosition);
    yPosition += 6;
  });

  yPosition += 6;

  // FÓRMULA (COMPOSIÇÃO)
  doc.setFillColor(240, 247, 242);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 87, 36);
  doc.text('COMPOSIÇÃO DA FÓRMULA', 17, yPosition);
  yPosition += 8;

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
    startY: yPosition,
    head: [['Ingrediente', 'Quantidade por Unidade', 'Concentração']],
    body: formulaData,
    theme: 'plain',
    headStyles: { 
      fillColor: [21, 87, 36], // Verde escuro
      textColor: 255, 
      fontStyle: 'bold', 
      fontSize: 9,
      halign: 'center'
    },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [60, 60, 60] },
    alternateRowStyles: { fillColor: [250, 252, 250] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = doc.lastAutoTable.finalY + 12;

  // VALORES
  doc.setFillColor(240, 247, 242);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 87, 36);
  doc.text('VALORES DA PROPOSTA', 17, yPosition);
  yPosition += 10;

  const valorFrascos = precoUnitario * quantidadeFrascos;
  const valorTotal = valorFrascos + valorServicosExtras;

  const valoresData: [string, string][] = [
    ['Preço Unitário (por frasco)', `R$ ${precoUnitario.toFixed(2)}`],
    ['Quantidade de Frascos', `${quantidadeFrascos} unidades`],
    ['Subtotal Produto', `R$ ${valorFrascos.toFixed(2)}`],
  ];

  if (valorServicosExtras > 0) {
    valoresData.push(['Serviços Extras', `R$ ${valorServicosExtras.toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: yPosition,
    body: valoresData,
    theme: 'plain',
    styles: { 
      fontSize: 10, 
      cellPadding: 3,
      textColor: [60, 60, 60]
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100, textColor: [21, 87, 36] },
      1: { halign: 'right', cellWidth: 70 },
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = doc.lastAutoTable.finalY + 5;

  // VALOR TOTAL (DESTAQUE)
  doc.setFillColor(21, 87, 36); // Verde escuro
  doc.rect(15, yPosition, pageWidth - 30, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DA PROPOSTA:', 20, yPosition + 9);
  doc.setFontSize(16);
  doc.text(`R$ ${valorTotal.toFixed(2)}`, pageWidth - 20, yPosition + 9, { align: 'right' });
  doc.setTextColor(60, 60, 60);

  yPosition += 18;

  // INFORMAÇÕES ADICIONAIS
  if (formula.unidades_por_dose) {
    yPosition += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 87, 36);
    doc.text('INFORMAÇÕES DE DOSAGEM', 17, yPosition);
    yPosition += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const unidadeTexto = formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                         formula.tipo_produto === 'Gummy' ? 'gummies' :
                         formula.tipo_produto === 'Líquido' ? 'mL' : 'g';
    
    doc.text(`• Dose recomendada: ${formula.unidades_por_dose} ${unidadeTexto}`, 17, yPosition);
    yPosition += 4.5;
    doc.text(`• Doses por frasco: ${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses`, 17, yPosition);
    yPosition += 4.5;
    doc.text(`• Total de doses na proposta: ${Math.floor((formula.qtd_capsulas / formula.unidades_por_dose) * quantidadeFrascos)} doses`, 17, yPosition);
  }

  // OBSERVAÇÕES E RODAPÉ
  const finalPageHeight = doc.internal.pageSize.getHeight();
  yPosition = finalPageHeight - 35;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Esta proposta tem validade de 30 dias a partir da data de emissão.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text('Valores sujeitos a alteração mediante aprovação e início da produção.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // RODAPÉ
  doc.setDrawColor(21, 87, 36);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 5;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(21, 87, 36);
  doc.text(
    `Lemon Caps - Proposta gerada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  // Salvar PDF
  const nomeArquivo = `proposta_${formula.nome_formula.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(nomeArquivo);
}
