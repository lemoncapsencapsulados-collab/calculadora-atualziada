import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento } from '@/types/orcamento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ========== LAYOUT ULTRA-COMPACTO - SEMPRE 1 PÁGINA A4 ==========
const LAYOUT = {
  margin: 12,
  marginBottom: 10,
  headerHeight: 25,  // Reduzido
  sectionGap: 2,     // Reduzido
  lineHeight: 4,
  fontSize: {
    title: 12,       // Reduzido
    sectionTitle: 8, // Reduzido
    body: 7,         // Reduzido
    small: 6,        // Reduzido
    footer: 6,
  },
  // Limites rígidos para garantir 1 página
  maxProdutos: 6,
  maxServicos: 3,
  maxInsumos: 2,
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

const PAGE_HEIGHT = 297;

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

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '';
  let truncated = text.replace(/\n/g, ' ').trim();
  if (doc.getTextWidth(truncated) <= maxWidth) return truncated;
  
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

// ========== FUNÇÕES DE RENDERIZAÇÃO ULTRA-COMPACTAS ==========

function renderHeader(doc: jsPDF, orcamento: Orcamento): number {
  const pageWidth = getPageWidth(doc);
  
  // Background do header compacto
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageWidth, LAYOUT.headerHeight, 'F');

  // Logo como texto
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LEMON CAPS', LAYOUT.margin, 10);

  // Título e info à direita
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(LAYOUT.fontSize.title);
  doc.text('ORÇAMENTO COMERCIAL', pageWidth - LAYOUT.margin, 9, { align: 'right' });

  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  
  const infoLine = [
    orcamento.consultor_responsavel ? `Consultor: ${orcamento.consultor_responsavel}` : null,
    orcamento.numero_orcamento,
    format(new Date(orcamento.created_at), "dd/MM/yyyy", { locale: ptBR })
  ].filter(Boolean).join(' | ');
  
  doc.text(infoLine, pageWidth - LAYOUT.margin, 16, { align: 'right' });

  // Linha amarela de destaque
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.4);
  doc.line(0, LAYOUT.headerHeight, pageWidth, LAYOUT.headerHeight);

  return LAYOUT.headerHeight + LAYOUT.sectionGap + 1;
}

function renderDadosCliente(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const dadosCliente = orcamento.dados_cliente;

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 5, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', LAYOUT.margin + 2, yPos + 3.5);
  yPos += 6;

  doc.setTextColor(...COLORS.textDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(orcamento.nome_cliente, LAYOUT.margin, yPos + 1);
  yPos += 4;

  if (dadosCliente) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(LAYOUT.fontSize.body);

    // Linha 1: Contato inline
    const contato = [
      dadosCliente.email,
      dadosCliente.telefone ? `Tel: ${dadosCliente.telefone}` : null,
      dadosCliente.cnpj ? `CNPJ: ${dadosCliente.cnpj}` : null,
      dadosCliente.cpf ? `CPF: ${dadosCliente.cpf}` : null,
    ].filter(Boolean).join(' | ');
    
    if (contato) {
      doc.text(truncateText(doc, contato, pageWidth - 2 * LAYOUT.margin), LAYOUT.margin, yPos + 1);
      yPos += LAYOUT.lineHeight;
    }

    // Linha 2: Endereço
    const endereco = [
      dadosCliente.razao_social,
      dadosCliente.endereco_cnpj,
      dadosCliente.cidade && dadosCliente.estado ? `${dadosCliente.cidade}/${dadosCliente.estado}` : null,
    ].filter(Boolean).join(' - ');
    
    if (endereco) {
      doc.text(truncateText(doc, endereco, pageWidth - 2 * LAYOUT.margin), LAYOUT.margin, yPos + 1);
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
  const itensExibir = orcamento.itens_producao.slice(0, LAYOUT.maxProdutos);
  const itensOcultos = orcamento.itens_producao.length - LAYOUT.maxProdutos;

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 5, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS', LAYOUT.margin + 2, yPos + 3.5);
  yPos += 6;

  // Tabela ultra-compacta de produtos
  const produtosData = itensExibir.map((item, index) => {
    // Composição inline muito curta
    let composicao = '';
    if (item.insumos_formula && item.insumos_formula.length > 0) {
      const insumos = item.insumos_formula.slice(0, LAYOUT.maxInsumos).map(i => i.nome).join(', ');
      composicao = item.insumos_formula.length > LAYOUT.maxInsumos ? `${insumos}...` : insumos;
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

  // Adicionar linha de resumo se houver itens ocultos
  if (itensOcultos > 0) {
    produtosData.push(['', `... e mais ${itensOcultos} produto(s)`, '', '', '']);
  }

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
      cellPadding: 1,
    },
    bodyStyles: {
      textColor: COLORS.textDark,
      fontSize: LAYOUT.fontSize.body,
      cellPadding: 1,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 1;

  // Subtotal de produção - mais compacto
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 4, 'F');
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL PRODUÇÃO:', pageWidth - LAYOUT.margin - 38, yPos + 2.8);
  doc.text(formatCurrency(orcamento.subtotal_producao), pageWidth - LAYOUT.margin - 2, yPos + 2.8, { align: 'right' });

  return yPos + 5 + LAYOUT.sectionGap;
}

function renderServicos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.servicos_marca || orcamento.servicos_marca.length === 0) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  const servicosExibir = orcamento.servicos_marca.slice(0, LAYOUT.maxServicos);
  const servicosOcultos = orcamento.servicos_marca.length - LAYOUT.maxServicos;

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 5, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVIÇOS DE MARCA', LAYOUT.margin + 2, yPos + 3.5);
  yPos += 6;

  // Tabela ultra-compacta de serviços
  const servicosData = servicosExibir.map((servico) => [
    servico.nome_plano,
    servico.descricao ? truncateText(doc, servico.descricao, 80) : '-',
    formatCurrency(servico.valor),
  ]);

  // Adicionar linha de resumo se houver serviços ocultos
  if (servicosOcultos > 0) {
    servicosData.push([`... e mais ${servicosOcultos} serviço(s)`, '', '']);
  }

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
      cellPadding: 1,
    },
    bodyStyles: {
      textColor: COLORS.textDark,
      fontSize: LAYOUT.fontSize.body,
      cellPadding: 1,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 1;

  // Subtotal de serviços - mais compacto
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 4, 'F');
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL SERVIÇOS:', pageWidth - LAYOUT.margin - 38, yPos + 2.8);
  doc.text(formatCurrency(orcamento.subtotal_servicos), pageWidth - LAYOUT.margin - 2, yPos + 2.8, { align: 'right' });

  return yPos + 5 + LAYOUT.sectionGap;
}

function renderFrete(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const frete = orcamento.detalhamento_frete;
  if (!frete || (frete.frete_lemon_caps === undefined && !frete.detalhamento_envio)) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  // Título inline mais compacto
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 5, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('FRETE', LAYOUT.margin + 2, yPos + 3.5);
  yPos += 6;

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');

  // Info de frete em uma linha única
  const freteInfo = [];
  
  if (frete.detalhamento_envio) {
    const tipoLabels: Record<string, string> = {
      'total_produtor': 'Envio p/ Produtor',
      'total_lemoncaps': 'Logística LC',
      'parcial': 'Envio Parcial',
    };
    freteInfo.push(`Logística: ${tipoLabels[frete.detalhamento_envio.tipo] || frete.detalhamento_envio.tipo}`);
  }
  
  freteInfo.push(`Frete LC: ${frete.frete_lemon_caps ? 'SIM' : 'NÃO'}`);
  
  if (frete.usa_tabela_tradicional) {
    freteInfo.push('Tabela: Tradicional');
  }

  // Planos customizados inline
  if (frete.planos_customizados && frete.planos_customizados.length > 0) {
    const planosText = frete.planos_customizados.slice(0, 2)
      .map(p => `${p.tipo_produto}: ${formatCurrency(p.valor)}`)
      .join(', ');
    freteInfo.push(planosText);
  }

  doc.text(truncateText(doc, freteInfo.join(' | '), pageWidth - 2 * LAYOUT.margin), LAYOUT.margin, yPos + 1);

  return yPos + LAYOUT.lineHeight + LAYOUT.sectionGap;
}

function renderTotal(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const totalBoxHeight = 12; // Mais compacto
  
  yPos += 1;
  
  // Box do total
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'F');
  
  // Borda amarela
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.6);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'S');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL:', LAYOUT.margin + 6, yPos + 7.5);

  doc.setTextColor(...COLORS.brightYellow);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - LAYOUT.margin - 6, yPos + 8, { align: 'right' });

  return yPos + totalBoxHeight + LAYOUT.sectionGap + 1;
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
  const maxWidth = pageWidth - 2 * LAYOUT.margin - 35;
  doc.text(truncateText(doc, orcamento.forma_pagamento, maxWidth), LAYOUT.margin + 35, yPos);
  
  return yPos + LAYOUT.lineHeight;
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
  const maxWidth = pageWidth - 2 * LAYOUT.margin - 10;
  doc.text(truncateText(doc, orcamento.observacoes, maxWidth), LAYOUT.margin + 10, yPos);
  
  return yPos + LAYOUT.lineHeight;
}

function renderFooter(doc: jsPDF, orcamento: Orcamento): void {
  const pageWidth = getPageWidth(doc);
  const footerY = PAGE_HEIGHT - LAYOUT.marginBottom;

  // Linha separadora
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.3);
  doc.line(LAYOUT.margin, footerY - 5, pageWidth - LAYOUT.margin, footerY - 5);

  // Validade e info
  doc.setTextColor(...COLORS.textGray);
  doc.setFontSize(LAYOUT.fontSize.footer);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Validade: ${orcamento.validade_dias} dias | LEMON CAPS - www.lemoncaps.com.br`,
    pageWidth / 2,
    footerY - 1,
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

  console.log(`[PDF] Gerando orçamento: ${orcamento.numero_orcamento} - Modo: página única forçada`);

  try {
    // Renderizar seções em ordem com limites forçados
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
    
    console.log(`[PDF] Altura final usada: ${yPos}mm de 297mm`);
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
