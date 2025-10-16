import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pedido, Formula } from '@/types/formula';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export function gerarPDFOrdemProducao(pedido: Pedido) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const formula = pedido.formula_snapshot;
  let yPosition = 20;

  // CABEÇALHO
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('ORDEM DE PRODUÇÃO', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Nº ${pedido.numero_pedido}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 6;
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // DADOS DO PEDIDO
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO PEDIDO', 17, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const dadosPedido = [
    ['Cliente:', formula.cliente],
    ['Produto:', formula.nome_formula],
    ['Tipo:', formula.tipo_produto],
    ['Data do Pedido:', format(pedido.data_pedido, "dd/MM/yyyy", { locale: ptBR })],
    ['Prazo de Entrega:', format(pedido.data_entrega, "dd/MM/yyyy", { locale: ptBR })],
    ['Quantidade:', `${pedido.quantidade_produto} ${pedido.unidade_produto}`],
  ];

  dadosPedido.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 17, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 65, yPosition);
    yPosition += 6;
  });

  // OBSERVAÇÕES (DESTAQUE)
  if (pedido.observacoes && pedido.observacoes.trim()) {
    yPosition += 3;
    doc.setFillColor(255, 250, 205);
    const obsLines = doc.splitTextToSize(pedido.observacoes, pageWidth - 40);
    const obsHeight = (obsLines.length * 5) + 10;
    
    doc.rect(15, yPosition - 5, pageWidth - 30, obsHeight, 'F');
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(1);
    doc.rect(15, yPosition - 5, pageWidth - 30, obsHeight);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('⚠️ OBSERVAÇÕES PARA PRODUÇÃO:', 17, yPosition);
    yPosition += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    obsLines.forEach((line: string) => {
      doc.text(line, 17, yPosition);
      yPosition += 5;
    });
    
    yPosition += 5;
  }

  yPosition += 5;

  // MATÉRIA-PRIMA
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('MATÉRIA-PRIMA', 17, yPosition);
  yPosition += 5;

  const mpData = formula.itens.map((item: any) => [
    item.nome_insumo_snapshot,
    `${item.qtd_informada} ${item.unidade_informada}`,
    `R$ ${item.custo_calculado.toFixed(2)}`,
  ]);

  doc.autoTable({
    startY: yPosition,
    head: [['Insumo', 'Quantidade', 'Custo']],
    body: mpData,
    foot: [['TOTAL MATÉRIA-PRIMA', '', `R$ ${formula.total_mp.toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // EMBALAGENS
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('EMBALAGENS', 17, yPosition);
  yPosition += 5;

  const embData = formula.embalagens.map((item: any) => [
    item.descricao_snapshot,
    `R$ ${item.custo_calculado.toFixed(2)}`,
  ]);

  doc.autoTable({
    startY: yPosition,
    head: [['Item', 'Custo']],
    body: embData,
    foot: [['TOTAL EMBALAGEM', `R$ ${formula.total_embalagem.toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // CUSTO TOTAL
  doc.setFillColor(41, 128, 185);
  doc.rect(15, yPosition, pageWidth - 30, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTO TOTAL:', 20, yPosition + 8);
  doc.text(`R$ ${formula.custo_total.toFixed(2)}`, pageWidth - 20, yPosition + 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  yPosition += 18;

  // INFORMAÇÕES DE DOSAGEM
  if (formula.unidades_por_dose) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 INFORMAÇÕES DE DOSAGEM', 17, yPosition);
    yPosition += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const unidadeTexto = formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                         formula.tipo_produto === 'Gummy' ? 'gummies' :
                         formula.tipo_produto === 'Líquido' ? 'mL' : 'g';
    doc.text(`• Unidades por dose: ${formula.unidades_por_dose} ${unidadeTexto}`, 17, yPosition);
    yPosition += 5;
    doc.text(`• Número total de doses: ${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses`, 17, yPosition);
  }

  // RODAPÉ
  const finalPageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(15, finalPageHeight - 20, pageWidth - 15, finalPageHeight - 20);
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    finalPageHeight - 12,
    { align: 'center' }
  );

  doc.save(`ordem_producao_${pedido.numero_pedido}.pdf`);
}
