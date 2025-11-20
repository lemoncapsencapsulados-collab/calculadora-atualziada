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

export function gerarPropostaPDF(data: PropostaData) {
  const { formula, precoUnitario, quantidadeFrascos, valorServicosExtras } = data;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // CABEÇALHO
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('PROPOSTA COMERCIAL', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 8;
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 12;

  // INFORMAÇÕES DO PRODUTO
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PRODUTO', 17, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const infoProduto = [
    ['Nome:', formula.nome_formula],
    ['Cliente:', formula.cliente],
    ['Tipo:', formula.tipo_produto],
    ['Unidades por frasco:', `${formula.qtd_capsulas}`],
  ];

  infoProduto.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 17, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 70, yPosition);
    yPosition += 6;
  });

  yPosition += 8;

  // FÓRMULA (COMPOSIÇÃO)
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
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
    theme: 'striped',
    headStyles: { 
      fillColor: [41, 128, 185], 
      textColor: 255, 
      fontStyle: 'bold', 
      fontSize: 10,
      halign: 'center'
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = doc.lastAutoTable.finalY + 15;

  // VALORES
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VALORES', 17, yPosition);
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
      fontSize: 11, 
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 70 },
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = doc.lastAutoTable.finalY + 5;

  // VALOR TOTAL (DESTAQUE)
  doc.setFillColor(41, 128, 185);
  doc.rect(15, yPosition, pageWidth - 30, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DA PROPOSTA:', 20, yPosition + 10);
  doc.text(`R$ ${valorTotal.toFixed(2)}`, pageWidth - 20, yPosition + 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPosition += 20;

  // INFORMAÇÕES ADICIONAIS
  if (formula.unidades_por_dose) {
    yPosition += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMAÇÕES DE DOSAGEM', 17, yPosition);
    yPosition += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const unidadeTexto = formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                         formula.tipo_produto === 'Gummy' ? 'gummies' :
                         formula.tipo_produto === 'Líquido' ? 'mL' : 'g';
    
    doc.text(`• Dose recomendada: ${formula.unidades_por_dose} ${unidadeTexto}`, 17, yPosition);
    yPosition += 5;
    doc.text(`• Doses por frasco: ${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses`, 17, yPosition);
    yPosition += 5;
    doc.text(`• Total de doses na proposta: ${Math.floor((formula.qtd_capsulas / formula.unidades_por_dose) * quantidadeFrascos)} doses`, 17, yPosition);
  }

  // OBSERVAÇÕES
  const finalPageHeight = doc.internal.pageSize.getHeight();
  yPosition = finalPageHeight - 40;

  doc.setDrawColor(220, 220, 220);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Esta proposta tem validade de 30 dias a partir da data de emissão.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text('Valores sujeitos a alteração mediante aprovação e início da produção.', pageWidth / 2, yPosition, { align: 'center' });

  // RODAPÉ
  yPosition = finalPageHeight - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Proposta gerada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    yPosition + 6,
    { align: 'center' }
  );

  // Salvar PDF
  const nomeArquivo = `proposta_${formula.nome_formula.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(nomeArquivo);
}
