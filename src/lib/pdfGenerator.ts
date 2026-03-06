import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pedido, Formula } from '@/types/formula';
import { arredondarReais } from '@/lib/utils';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

export function gerarFichaTecnicaPDFBlob(pedido: any): Blob {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const snap = pedido.orcamento_snapshot || {};
  const dadosCliente = snap.dados_cliente || {};
  const itens = snap.itens_producao || [];
  let yPosition = 20;

  const checkPageBreak = (needed: number) => {
    if (yPosition + needed > pageHeight - 25) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // CABEÇALHO
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 87, 50);
  doc.text('FICHA TÉCNICA', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Pedido ${pedido.numero_pedido}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 4;

  doc.setDrawColor(34, 87, 50);
  doc.setLineWidth(0.6);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // INFORMAÇÕES DO CLIENTE
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(240, 245, 240);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES DO CLIENTE', 17, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  const clienteFields: [string, string][] = [
    ['Nome:', dadosCliente.nome_completo || snap.nome_cliente || '-'],
    ['Email:', dadosCliente.email || '-'],
    ['Telefone:', dadosCliente.telefone || '-'],
    ['CNPJ:', dadosCliente.cnpj || '-'],
    ['CPF:', dadosCliente.cpf || '-'],
    ['Inscrição Estadual:', dadosCliente.inscricao_estadual || '-'],
    ['Razão Social:', dadosCliente.razao_social || '-'],
  ];
  if (dadosCliente.cidade) {
    clienteFields.push(['Cidade/Estado:', `${dadosCliente.cidade}/${dadosCliente.estado || ''}`]);
  }
  if (dadosCliente.forma_venda && dadosCliente.forma_venda !== 'sem_informacao') {
    const fvMap: Record<string, string> = { locais_fisicos: 'Locais Físicos', venda_digital: 'Digital', ambas: 'Ambas' };
    clienteFields.push(['Forma de Venda:', fvMap[dadosCliente.forma_venda] || dadosCliente.forma_venda]);
  }

  clienteFields.forEach(([label, value]) => {
    if (value && value !== '-') {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 17, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 65, yPosition);
      yPosition += 6;
    }
  });
  yPosition += 4;

  // CONSULTOR RESPONSÁVEL
  if (snap.consultor_responsavel) {
    checkPageBreak(16);
    doc.setFillColor(240, 245, 240);
    doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSULTOR RESPONSÁVEL', 17, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(snap.consultor_responsavel, 17, yPosition);
    yPosition += 10;
  }

  // PRODUTOS
  checkPageBreak(16);
  doc.setFillColor(240, 245, 240);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS', 17, yPosition);
  yPosition += 8;

  itens.forEach((item: any, idx: number) => {
    checkPageBreak(30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 87, 50);
    doc.text(`${idx + 1}. ${item.nome_produto}`, 17, yPosition);
    yPosition += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const detalhes: string[] = [];
    if (item.segmento) detalhes.push(`Segmento: ${item.segmento}`);
    if (item.quantidade) detalhes.push(`Quantidade: ${item.quantidade} un`);
    if (item.quantidade_por_pote) detalhes.push(`Qtd por pote: ${item.quantidade_por_pote} ${item.unidade_por_pote || ''}`);
    if (item.dose_diaria_sugerida) detalhes.push(`Dose diária: ${item.dose_diaria_sugerida}`);

    detalhes.forEach(d => {
      doc.text(`• ${d}`, 20, yPosition);
      yPosition += 5;
    });

    // Detalhes de produção
    const dp = item.detalhes_producao;
    if (dp) {
      const prodDetalhes: string[] = [];
      if (dp.cor_tampa) prodDetalhes.push(`Cor tampa: ${dp.cor_tampa}`);
      if (dp.cor_pote) prodDetalhes.push(`Cor pote: ${dp.cor_pote}`);
      if (dp.sabor_gummy) prodDetalhes.push(`Sabor: ${dp.sabor_gummy}`);
      if (dp.cor_gummy) prodDetalhes.push(`Cor: ${dp.cor_gummy}`);
      if (dp.sabor_soluvel) prodDetalhes.push(`Sabor: ${dp.sabor_soluvel}`);
      if (dp.cor_soluvel) prodDetalhes.push(`Cor: ${dp.cor_soluvel}`);
      prodDetalhes.forEach(d => {
        doc.text(`• ${d}`, 20, yPosition);
        yPosition += 5;
      });
    }

    // Insumos da fórmula
    if (item.insumos_formula && item.insumos_formula.length > 0) {
      checkPageBreak(15 + item.insumos_formula.length * 7);
      yPosition += 2;
      const insumosData = item.insumos_formula.map((ins: any) => [
        ins.nome, String(ins.quantidade), ins.unidade
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Insumo', 'Quantidade', 'Unidade']],
        body: insumosData,
        theme: 'grid',
        headStyles: { fillColor: [34, 87, 50], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 20, right: 20 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 6;
    } else {
      yPosition += 4;
    }
  });

  // Observações
  if (pedido.observacoes?.trim()) {
    checkPageBreak(20);
    doc.setFillColor(255, 250, 205);
    const obsLines = doc.splitTextToSize(pedido.observacoes, pageWidth - 40);
    const obsH = obsLines.length * 5 + 10;
    doc.rect(15, yPosition - 5, pageWidth - 30, obsH, 'F');
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(0.8);
    doc.rect(15, yPosition - 5, pageWidth - 30, obsH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('OBSERVAÇÕES:', 17, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    obsLines.forEach((line: string) => { doc.text(line, 17, yPosition); yPosition += 5; });
  }

  // Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, pageHeight - 18, pageWidth - 15, pageHeight - 18);
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(`Ficha Técnica - ${pedido.numero_pedido} | Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
  }

  return doc.output('blob') as unknown as Blob;
}

export function gerarFichaTecnicaDownload(pedido: any) {
  const doc = gerarFichaTecnicaPDFBlob(pedido);
  // Re-generate for download with save
  const link = document.createElement('a');
  link.href = URL.createObjectURL(doc);
  link.download = `ficha_tecnica_${pedido.numero_pedido}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
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
    `R$ ${arredondarReais(item.custo_calculado).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Insumo', 'Quantidade', 'Custo']],
    body: mpData,
    foot: [['TOTAL MATÉRIA-PRIMA', '', `R$ ${arredondarReais(formula.total_mp).toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // EMBALAGENS
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('EMBALAGENS', 17, yPosition);
  yPosition += 5;

  const embData = formula.embalagens.map((item: any) => [
    item.descricao_snapshot,
    `R$ ${arredondarReais(item.custo_calculado).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Item', 'Custo']],
    body: embData,
    foot: [['TOTAL EMBALAGEM', `R$ ${arredondarReais(formula.total_embalagem).toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // CUSTO TOTAL
  doc.setFillColor(41, 128, 185);
  doc.rect(15, yPosition, pageWidth - 30, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTO TOTAL:', 20, yPosition + 8);
  doc.text(`R$ ${arredondarReais(formula.custo_total).toFixed(2)}`, pageWidth - 20, yPosition + 8, { align: 'right' });
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
