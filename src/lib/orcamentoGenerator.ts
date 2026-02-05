import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento } from '@/types/orcamento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ========== LAYOUT COMPACTO PARA PÁGINA ÚNICA A4 ==========
const LAYOUT = {
  margin: 12,
  marginBottom: 12,
  headerHeight: 28,
  sectionGap: 3,
  lineHeight: 4,
  fontSize: {
    title: 14,
    sectionTitle: 9,
    body: 8,
    small: 7,
    footer: 6,
  }
};

// Cores da identidade visual Lemon Caps
const COLORS = {
  darkGreen: [24, 26, 0] as [number, number, number],
  mediumGreen: [46, 48, 3] as [number, number, number],
  lemonYellow: [202, 212, 0] as [number, number, number],
  brightYellow: [242, 255, 0] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [248, 248, 248] as [number, number, number],
  textDark: [30, 30, 30] as [number, number, number],
  textGray: [100, 100, 100] as [number, number, number],
};

// A4: 210mm x 297mm - Altura útil ~270mm
const PAGE_HEIGHT = 297;
const USABLE_HEIGHT = PAGE_HEIGHT - LAYOUT.margin - LAYOUT.marginBottom;

// ========== FUNÇÕES UTILITÁRIAS ==========

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function getPageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

// ========== FUNÇÕES DE RENDERIZAÇÃO COMPACTAS ==========

function renderHeader(doc: jsPDF, orcamento: Orcamento): number {
  const pageWidth = getPageWidth(doc);
  
  // Background do header compacto
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageWidth, LAYOUT.headerHeight, 'F');

  // Logo como texto (evita problemas de carregamento de imagem)
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LEMON CAPS', LAYOUT.margin, 12);

  // Título e info à direita
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(LAYOUT.fontSize.title);
  doc.text('ORÇAMENTO COMERCIAL', pageWidth - LAYOUT.margin, 10, { align: 'right' });

  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  
  const infoLine = [
    orcamento.consultor_responsavel ? `Consultor: ${orcamento.consultor_responsavel}` : null,
    orcamento.numero_orcamento,
    format(new Date(orcamento.created_at), "dd/MM/yyyy", { locale: ptBR })
  ].filter(Boolean).join(' | ');
  
  doc.text(infoLine, pageWidth - LAYOUT.margin, 18, { align: 'right' });

  // Linha amarela de destaque
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.5);
  doc.line(0, LAYOUT.headerHeight, pageWidth, LAYOUT.headerHeight);

  return LAYOUT.headerHeight + LAYOUT.sectionGap + 2;
}

function renderDadosCliente(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const dadosCliente = orcamento.dados_cliente;

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', LAYOUT.margin + 3, yPos + 4);
  yPos += 8;

  doc.setTextColor(...COLORS.textDark);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(LAYOUT.fontSize.body);

  // Linha 1: Nome (em destaque)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(orcamento.nome_cliente, LAYOUT.margin, yPos + 1);
  yPos += 5;

  if (dadosCliente) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(LAYOUT.fontSize.body);

    // Linha 2: Contato
    const contato = [
      dadosCliente.email,
      dadosCliente.telefone ? `Tel: ${dadosCliente.telefone}` : null
    ].filter(Boolean).join(' | ');
    if (contato) {
      doc.text(contato, LAYOUT.margin, yPos + 1);
      yPos += LAYOUT.lineHeight;
    }

    // Linha 3: CNPJ/CPF + Razão Social
    const doc1 = [
      dadosCliente.cnpj ? `CNPJ: ${dadosCliente.cnpj}` : null,
      dadosCliente.cpf ? `CPF: ${dadosCliente.cpf}` : null,
      dadosCliente.razao_social
    ].filter(Boolean).join(' | ');
    if (doc1) {
      doc.text(doc1, LAYOUT.margin, yPos + 1);
      yPos += LAYOUT.lineHeight;
    }

    // Linha 4: Endereço
    if (dadosCliente.endereco_cnpj || dadosCliente.cidade) {
      const endereco = [
        dadosCliente.endereco_cnpj,
        dadosCliente.cidade && dadosCliente.estado ? `${dadosCliente.cidade}/${dadosCliente.estado}` : null,
        dadosCliente.cep_cnpj ? `CEP: ${dadosCliente.cep_cnpj}` : null
      ].filter(Boolean).join(' - ');
      doc.text(endereco, LAYOUT.margin, yPos + 1);
      yPos += LAYOUT.lineHeight;
    }
  }

  return yPos + LAYOUT.sectionGap;
}

function renderProdutos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.itens_producao || orcamento.itens_producao.length === 0) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS', LAYOUT.margin + 3, yPos + 4);
  yPos += 8;

  // Tabela compacta de produtos
  const produtosData = orcamento.itens_producao.map((item, index) => {
    // Composição inline resumida
    let composicao = '';
    if (item.insumos_formula && item.insumos_formula.length > 0) {
      const insumos = item.insumos_formula.slice(0, 3).map(i => i.nome).join(', ');
      composicao = item.insumos_formula.length > 3 ? `${insumos}...` : insumos;
    }
    
    const nomeCompleto = composicao ? `${item.nome_produto} (${composicao})` : item.nome_produto;
    
    return [
      (index + 1).toString(),
      nomeCompleto,
      item.quantidade.toString(),
      formatCurrency(item.preco_unitario),
      formatCurrency(item.subtotal),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Produto / Composição', 'Qtd', 'Unit.', 'Subtotal']],
    body: produtosData,
    margin: { left: LAYOUT.margin, right: LAYOUT.margin },
    headStyles: {
      fillColor: COLORS.darkGreen,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: LAYOUT.fontSize.small,
      cellPadding: 1.5,
    },
    bodyStyles: {
      textColor: COLORS.textDark,
      fontSize: LAYOUT.fontSize.body,
      cellPadding: 1.5,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 2;

  // Subtotal de produção
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 5, 'F');
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL PRODUÇÃO:', pageWidth - LAYOUT.margin - 40, yPos + 3.5);
  doc.text(formatCurrency(orcamento.subtotal_producao), pageWidth - LAYOUT.margin - 3, yPos + 3.5, { align: 'right' });

  return yPos + 7 + LAYOUT.sectionGap;
}

function renderServicos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.servicos_marca || orcamento.servicos_marca.length === 0) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVIÇOS DE MARCA', LAYOUT.margin + 3, yPos + 4);
  yPos += 8;

  // Tabela compacta de serviços
  const servicosData = orcamento.servicos_marca.map((servico) => [
    servico.nome_plano,
    servico.descricao || '-',
    formatCurrency(servico.valor),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Serviço', 'Descrição', 'Valor']],
    body: servicosData,
    margin: { left: LAYOUT.margin, right: LAYOUT.margin },
    headStyles: {
      fillColor: COLORS.darkGreen,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: LAYOUT.fontSize.small,
      cellPadding: 1.5,
    },
    bodyStyles: {
      textColor: COLORS.textDark,
      fontSize: LAYOUT.fontSize.body,
      cellPadding: 1.5,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 28, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 2;

  // Subtotal de serviços
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 5, 'F');
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL SERVIÇOS:', pageWidth - LAYOUT.margin - 40, yPos + 3.5);
  doc.text(formatCurrency(orcamento.subtotal_servicos), pageWidth - LAYOUT.margin - 3, yPos + 3.5, { align: 'right' });

  return yPos + 7 + LAYOUT.sectionGap;
}

function renderFrete(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const frete = orcamento.detalhamento_frete;
  if (!frete || (frete.frete_lemon_caps === undefined && !frete.detalhamento_envio)) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  // Título inline
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 6, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('FRETE', LAYOUT.margin + 3, yPos + 4);
  yPos += 8;

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');

  // Info de frete em uma linha
  const freteInfo = [];
  
  if (frete.detalhamento_envio) {
    const tipoLabels: Record<string, string> = {
      'total_produtor': 'Envio p/ Produtor',
      'total_lemoncaps': 'Logística Lemon Caps',
      'parcial': 'Envio Parcial',
    };
    freteInfo.push(`Logística: ${tipoLabels[frete.detalhamento_envio.tipo] || frete.detalhamento_envio.tipo}`);
  }
  
  freteInfo.push(`Frete Lemon Caps: ${frete.frete_lemon_caps ? 'SIM' : 'NÃO'}`);
  
  if (frete.usa_tabela_tradicional) {
    freteInfo.push('Tabela: Tradicional');
  }

  doc.text(freteInfo.join(' | '), LAYOUT.margin, yPos + 1);
  yPos += LAYOUT.lineHeight;

  // Planos customizados em linha única se houver
  if (frete.planos_customizados && frete.planos_customizados.length > 0) {
    const planosText = frete.planos_customizados
      .map(p => `${p.tipo_produto}: ${formatCurrency(p.valor)}`)
      .join(' | ');
    doc.setFontSize(LAYOUT.fontSize.small);
    doc.text(planosText, LAYOUT.margin, yPos + 1);
    yPos += LAYOUT.lineHeight;
  }

  return yPos + LAYOUT.sectionGap;
}

function renderTotal(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const totalBoxHeight = 16;
  
  yPos += 2;
  
  // Box do total
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'F');
  
  // Borda amarela
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.8);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'S');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL:', LAYOUT.margin + 8, yPos + 10);

  doc.setTextColor(...COLORS.brightYellow);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - LAYOUT.margin - 8, yPos + 11, { align: 'right' });

  return yPos + totalBoxHeight + LAYOUT.sectionGap + 2;
}

function renderFormaPagamento(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.forma_pagamento) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('Forma de Pagamento:', LAYOUT.margin, yPos);
  
  doc.setFont('helvetica', 'normal');
  // Truncar se muito longo
  const maxWidth = pageWidth - 2 * LAYOUT.margin - 40;
  let pagText = orcamento.forma_pagamento;
  if (doc.getTextWidth(pagText) > maxWidth) {
    while (doc.getTextWidth(pagText + '...') > maxWidth && pagText.length > 0) {
      pagText = pagText.slice(0, -1);
    }
    pagText += '...';
  }
  doc.text(pagText, LAYOUT.margin + 38, yPos);
  
  return yPos + LAYOUT.lineHeight + 1;
}

function renderObservacoes(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.observacoes) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('Obs:', LAYOUT.margin, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(LAYOUT.fontSize.small);
  // Truncar observações para caber em uma linha
  const maxWidth = pageWidth - 2 * LAYOUT.margin - 12;
  let obsText = orcamento.observacoes.replace(/\n/g, ' ');
  if (doc.getTextWidth(obsText) > maxWidth) {
    while (doc.getTextWidth(obsText + '...') > maxWidth && obsText.length > 0) {
      obsText = obsText.slice(0, -1);
    }
    obsText += '...';
  }
  doc.text(obsText, LAYOUT.margin + 10, yPos);
  
  return yPos + LAYOUT.lineHeight + 1;
}

function renderFooter(doc: jsPDF, orcamento: Orcamento): void {
  const pageWidth = getPageWidth(doc);
  const pageHeight = PAGE_HEIGHT;
  const footerY = pageHeight - LAYOUT.marginBottom;

  // Linha separadora
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.3);
  doc.line(LAYOUT.margin, footerY - 6, pageWidth - LAYOUT.margin, footerY - 6);

  // Validade e info
  doc.setTextColor(...COLORS.textGray);
  doc.setFontSize(LAYOUT.fontSize.footer);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Validade: ${orcamento.validade_dias} dias | LEMON CAPS - www.lemoncaps.com.br`,
    pageWidth / 2,
    footerY - 2,
    { align: 'center' }
  );
}

function renderStatusWatermark(doc: jsPDF, orcamento: Orcamento): void {
  if (orcamento.status === 'rascunho') {
    return;
  }

  const pageHeight = PAGE_HEIGHT;
  const pageWidth = getPageWidth(doc);

  const statusLabels: Record<string, string> = {
    enviado: 'ENVIADO',
    aprovado: 'APROVADO',
    recusado: 'RECUSADO',
  };
  
  const statusColors: Record<string, [number, number, number]> = {
    enviado: [59, 130, 246],
    aprovado: [34, 197, 94],
    recusado: [239, 68, 68],
  };

  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.setTextColor(...(statusColors[orcamento.status] || COLORS.textGray));
  doc.setFontSize(50);
  doc.setFont('helvetica', 'bold');
  
  doc.text(
    statusLabels[orcamento.status] || orcamento.status.toUpperCase(),
    pageWidth / 2,
    pageHeight / 2,
    { align: 'center', angle: 45 }
  );
  doc.restoreGraphicsState();
}

// ========== FUNÇÃO PRINCIPAL ==========

async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  try {
    // Renderizar seções em ordem
    let yPos = renderHeader(doc, orcamento);
    yPos = renderDadosCliente(doc, orcamento, yPos);
    yPos = renderProdutos(doc, orcamento, yPos);
    yPos = renderServicos(doc, orcamento, yPos);
    yPos = renderFrete(doc, orcamento, yPos);
    yPos = renderTotal(doc, orcamento, yPos);
    yPos = renderFormaPagamento(doc, orcamento, yPos);
    yPos = renderObservacoes(doc, orcamento, yPos);

    // Footer e marca d'água
    renderFooter(doc, orcamento);
    renderStatusWatermark(doc, orcamento);
  } catch (error) {
    console.error('Erro ao criar PDF:', error);
    // Fallback mínimo
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('LEMON CAPS - Orçamento', 20, 30);
    doc.setFontSize(10);
    doc.text(`Nº: ${orcamento.numero_orcamento}`, 20, 40);
    doc.text(`Cliente: ${orcamento.nome_cliente}`, 20, 48);
    doc.text(`Total: ${formatCurrency(orcamento.valor_total)}`, 20, 56);
  }

  return doc;
}

// ========== EXPORTS ==========

export async function generateOrcamentoPDFBlob(orcamento: Orcamento): Promise<Blob> {
  const doc = await createOrcamentoPDF(orcamento);
  return doc.output('blob');
}

export async function generateOrcamentoPDF(orcamento: Orcamento): Promise<void> {
  const doc = await createOrcamentoPDF(orcamento);
  
  const nomeArquivo = orcamento.consultor_responsavel 
    ? `${orcamento.consultor_responsavel.replace(/\s+/g, '-')}-${orcamento.nome_cliente.replace(/\s+/g, '-')}`
    : `${orcamento.numero_orcamento}-${orcamento.nome_cliente.replace(/\s+/g, '-')}`;
  
  doc.save(`${nomeArquivo}.pdf`);
}
