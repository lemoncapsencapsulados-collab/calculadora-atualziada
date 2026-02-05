import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento } from '@/types/orcamento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ========== CONSTANTES DE LAYOUT ==========
const LAYOUT = {
  margin: 15,           // Margem lateral padrão
  marginTop: 15,        // Margem superior
  marginBottom: 25,     // Margem inferior (espaço para footer)
  headerHeight: 45,     // Altura do cabeçalho principal
  sectionGap: 10,       // Espaço entre seções
  lineHeight: 6,        // Altura de linha padrão
  fontSize: {
    title: 18,          // Títulos principais
    sectionTitle: 11,   // Títulos de seção
    body: 10,           // Texto principal
    small: 9,           // Texto secundário
    footer: 8,          // Rodapé
  }
};

// Cores da identidade visual Lemon Caps
const COLORS = {
  darkGreen: [24, 26, 0] as [number, number, number],
  mediumGreen: [46, 48, 3] as [number, number, number],
  lemonYellow: [202, 212, 0] as [number, number, number],
  brightYellow: [242, 255, 0] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  textDark: [30, 30, 30] as [number, number, number],
  textGray: [100, 100, 100] as [number, number, number],
};

// ========== FUNÇÕES UTILITÁRIAS ==========

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function getPageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight();
}

function getPageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth();
}

function getSafeBottom(doc: jsPDF): number {
  return getPageHeight(doc) - LAYOUT.marginBottom;
}

// Verifica se precisa de nova página e adiciona se necessário
function checkPageBreak(doc: jsPDF, yPos: number, requiredHeight: number): number {
  if (yPos + requiredHeight > getSafeBottom(doc)) {
    doc.addPage();
    addPageHeader(doc);
    return LAYOUT.marginTop + 20; // Posição após header compacto
  }
  return yPos;
}

// Cabeçalho compacto para páginas adicionais
function addPageHeader(doc: jsPDF): void {
  const pageWidth = getPageWidth(doc);
  
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageWidth, 15, 'F');
  
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('LEMON CAPS - Orçamento Comercial', LAYOUT.margin, 10);
}

// Adiciona footer em todas as páginas
function addFooterToAllPages(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = getPageHeight(doc);
  const pageWidth = getPageWidth(doc);
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Linha separadora
    doc.setDrawColor(...COLORS.lemonYellow);
    doc.setLineWidth(0.3);
    doc.line(LAYOUT.margin, pageHeight - 18, pageWidth - LAYOUT.margin, pageHeight - 18);
    
    // Texto do footer
    doc.setTextColor(...COLORS.textGray);
    doc.setFontSize(LAYOUT.fontSize.footer);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.text('LEMON CAPS - www.lemoncaps.com.br', pageWidth / 2, pageHeight - 7, { align: 'center' });
  }
}

// ========== FUNÇÕES DE RENDERIZAÇÃO ==========

async function renderHeader(doc: jsPDF, orcamento: Orcamento): Promise<number> {
  const pageWidth = getPageWidth(doc);
  
  // Background do header
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageWidth, LAYOUT.headerHeight, 'F');

  // Tentar carregar logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => reject(new Error('Failed to load logo'));
      logoImg.src = '/images/logo-lemoncaps.jpg';
    });

    const logoWidth = 45;
    const logoHeight = 20;
    doc.addImage(logoImg, 'JPEG', LAYOUT.margin, 10, logoWidth, logoHeight);
  } catch {
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('LEMON CAPS', LAYOUT.margin, 25);
  }

  // Título do documento
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(LAYOUT.fontSize.title);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO COMERCIAL', pageWidth - LAYOUT.margin, 16, { align: 'right' });

  // Consultor e Data
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  if (orcamento.consultor_responsavel) {
    doc.text(`Consultor: ${orcamento.consultor_responsavel}`, pageWidth - LAYOUT.margin, 26, { align: 'right' });
  }
  doc.text(orcamento.numero_orcamento, pageWidth - LAYOUT.margin, 34, { align: 'right' });
  doc.text(
    format(new Date(orcamento.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    pageWidth - LAYOUT.margin, 
    42, 
    { align: 'right' }
  );

  return LAYOUT.headerHeight + LAYOUT.sectionGap;
}

function renderDadosCliente(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const dadosCliente = orcamento.dados_cliente;
  const hasClienteData = dadosCliente && (
    dadosCliente.nome_completo || dadosCliente.email || dadosCliente.telefone || 
    dadosCliente.cpf || dadosCliente.cnpj || dadosCliente.razao_social
  );

  if (hasClienteData) {
    const clienteInfo: string[] = [];
    if (dadosCliente.nome_completo) clienteInfo.push(`Nome: ${dadosCliente.nome_completo}`);
    if (dadosCliente.email || dadosCliente.telefone) {
      const contato = [dadosCliente.email, dadosCliente.telefone].filter(Boolean).join(' | Tel: ');
      clienteInfo.push(`Email: ${contato}`);
    }
    if (dadosCliente.cpf) clienteInfo.push(`CPF: ${dadosCliente.cpf}`);
    if (dadosCliente.cnpj) clienteInfo.push(`CNPJ: ${dadosCliente.cnpj}`);
    if (dadosCliente.razao_social) clienteInfo.push(`Razão Social: ${dadosCliente.razao_social}`);
    if (dadosCliente.endereco_cnpj) {
      const endereco = [
        dadosCliente.endereco_cnpj,
        dadosCliente.cidade && dadosCliente.estado ? `${dadosCliente.cidade}/${dadosCliente.estado}` : null
      ].filter(Boolean).join(' - ');
      clienteInfo.push(`Endereço: ${endereco}`);
    }
    if (dadosCliente.cep_cnpj) clienteInfo.push(`CEP: ${dadosCliente.cep_cnpj}`);
    
    if (dadosCliente.forma_venda && dadosCliente.forma_venda !== 'sem_informacao') {
      const formaVendaLabels: Record<string, string> = {
        'locais_fisicos': 'Locais físicos',
        'venda_digital': 'Venda digital',
        'ambas': 'Ambas (física e digital)',
      };
      clienteInfo.push(`Forma de Venda: ${formaVendaLabels[dadosCliente.forma_venda] || dadosCliente.forma_venda}`);
    }

    // Estimar altura necessária
    const estimatedHeight = 12 + (clienteInfo.length * LAYOUT.lineHeight);
    yPos = checkPageBreak(doc, yPos, estimatedHeight);

    // Título da seção
    doc.setFillColor(...COLORS.mediumGreen);
    doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 8, 'F');
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(LAYOUT.fontSize.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', LAYOUT.margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setTextColor(...COLORS.textDark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(LAYOUT.fontSize.body);

    clienteInfo.forEach(info => {
      doc.text(info, LAYOUT.margin + 5, yPos);
      yPos += LAYOUT.lineHeight;
    });

    yPos += LAYOUT.sectionGap;
  } else {
    // Apenas nome do cliente
    yPos = checkPageBreak(doc, yPos, 25);

    doc.setFillColor(...COLORS.lightGray);
    doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 18, 'F');

    doc.setTextColor(...COLORS.textDark);
    doc.setFontSize(LAYOUT.fontSize.body);
    doc.setFont('helvetica', 'normal');
    doc.text('CLIENTE:', LAYOUT.margin + 5, yPos + 7);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(orcamento.nome_cliente, LAYOUT.margin + 5, yPos + 14);

    yPos += 25;
  }

  return yPos;
}

function renderProdutos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.itens_producao || orcamento.itens_producao.length === 0) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  
  // Verificar espaço para título da seção
  yPos = checkPageBreak(doc, yPos, 30);

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 10, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOS DE PRODUÇÃO', LAYOUT.margin + 5, yPos + 7);
  yPos += 14;

  // Renderizar cada item
  orcamento.itens_producao.forEach((item, index) => {
    // Estimar altura do item
    const insumoCount = item.insumos_formula?.length || 0;
    const estimatedHeight = 25 + (insumoCount * 5) + 20;
    yPos = checkPageBreak(doc, yPos, estimatedHeight);

    // Tabela do produto
    autoTable(doc, {
      startY: yPos,
      head: index === 0 ? [['#', 'Produto', 'Segmento', 'Qtd', 'Preço Unit.', 'Subtotal']] : undefined,
      body: [[
        (index + 1).toString(),
        item.nome_produto,
        item.segmento,
        item.quantidade.toString(),
        formatCurrency(item.preco_unitario),
        formatCurrency(item.subtotal),
      ]],
      margin: { left: LAYOUT.margin, right: LAYOUT.margin },
      headStyles: {
        fillColor: COLORS.darkGreen,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: LAYOUT.fontSize.small,
      },
      bodyStyles: {
        textColor: COLORS.textDark,
        fontSize: LAYOUT.fontSize.body,
      },
      alternateRowStyles: {
        fillColor: COLORS.lightGray,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;

    // Informações do produto
    if ((item.quantidade_por_pote && item.unidade_por_pote) || item.dose_diaria_sugerida) {
      doc.setFontSize(LAYOUT.fontSize.small);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);

      if (item.quantidade_por_pote && item.unidade_por_pote) {
        const unidadeLabel = {
          'capsulas': 'cápsulas',
          'gummies': 'gummies',
          'ml': 'ml',
          'g': 'g'
        }[item.unidade_por_pote] || item.unidade_por_pote;
        doc.text(`Apresentação: ${item.quantidade_por_pote} ${unidadeLabel}/pote`, LAYOUT.margin + 5, yPos + 3);
        yPos += 5;
      }

      if (item.dose_diaria_sugerida) {
        doc.text(`Dose diária sugerida: ${item.dose_diaria_sugerida}`, LAYOUT.margin + 5, yPos + 3);
        yPos += 5;
      }
      yPos += 2;
    }

    // Composição
    if (item.tipo === 'precificacao' && item.insumos_formula && item.insumos_formula.length > 0) {
      // Verificar se precisa de nova página para composição
      const composicaoHeight = 10 + (item.insumos_formula.length * 5);
      yPos = checkPageBreak(doc, yPos, composicaoHeight);

      doc.setFontSize(LAYOUT.fontSize.small);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textDark);
      doc.text('Composição:', LAYOUT.margin + 5, yPos + 3);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(LAYOUT.fontSize.small);
      doc.setTextColor(...COLORS.textGray);

      item.insumos_formula.forEach(insumo => {
        yPos = checkPageBreak(doc, yPos, 5);
        doc.text(`• ${insumo.nome} - ${insumo.quantidade} ${insumo.unidade}`, LAYOUT.margin + 8, yPos);
        yPos += 4;
      });

      yPos += 5;
    }
  });

  // Subtotal de produção
  yPos = checkPageBreak(doc, yPos, 15);
  yPos += 3;
  doc.setFillColor(...COLORS.lightGray);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 8, 'F');
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL:', pageWidth - LAYOUT.margin - 45, yPos + 5.5);
  doc.text(formatCurrency(orcamento.subtotal_producao), pageWidth - LAYOUT.margin - 5, yPos + 5.5, { align: 'right' });

  return yPos + 15;
}

function renderServicos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.servicos_marca || orcamento.servicos_marca.length === 0) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  
  // Estimar altura da seção
  const estimatedHeight = 20 + (orcamento.servicos_marca.length * 12) + 15;
  yPos = checkPageBreak(doc, yPos, estimatedHeight);

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 10, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVIÇO DE CRIAÇÃO DE MARCA PRÓPRIA', LAYOUT.margin + 5, yPos + 7);
  yPos += 14;

  // Tabela de serviços
  const servicosData = orcamento.servicos_marca.map((servico) => [
    servico.nome_plano,
    servico.descricao || '-',
    formatCurrency(servico.valor),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Plano/Serviço', 'Descrição', 'Valor']],
    body: servicosData,
    margin: { left: LAYOUT.margin, right: LAYOUT.margin },
    headStyles: {
      fillColor: COLORS.darkGreen,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: LAYOUT.fontSize.small,
    },
    bodyStyles: {
      textColor: COLORS.textDark,
      fontSize: LAYOUT.fontSize.body,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'right' },
    },
    foot: [[
      '', 
      { content: 'SUBTOTAL:', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(orcamento.subtotal_servicos), styles: { fontStyle: 'bold', halign: 'right' } }
    ]],
    footStyles: {
      fillColor: COLORS.lightGray,
      textColor: COLORS.textDark,
    },
  });

  return (doc as any).lastAutoTable.finalY + LAYOUT.sectionGap;
}

function renderFrete(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const frete = orcamento.detalhamento_frete;
  if (!frete || (frete.frete_lemon_caps === undefined && (!frete.planos_customizados || frete.planos_customizados.length === 0) && !frete.detalhamento_envio)) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  
  // Estimar altura
  let estimatedHeight = 20;
  if (frete.detalhamento_envio) estimatedHeight += 15;
  if (frete.planos_customizados) estimatedHeight += frete.planos_customizados.length * 6;
  
  yPos = checkPageBreak(doc, yPos, estimatedHeight);

  // Título da seção
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, 8, 'F');
  doc.setTextColor(...COLORS.lemonYellow);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHAMENTO DE FRETE', LAYOUT.margin + 5, yPos + 5.5);
  yPos += 12;

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');

  // Detalhamento de Envio
  if (frete.detalhamento_envio) {
    const tipoLabels: Record<string, string> = {
      'total_produtor': 'Todo envio para o Produtor',
      'total_lemoncaps': 'Toda logística via Lemon Caps',
      'parcial': 'Envio Parcial',
    };
    doc.setFont('helvetica', 'bold');
    doc.text('Logística:', LAYOUT.margin + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(tipoLabels[frete.detalhamento_envio.tipo] || frete.detalhamento_envio.tipo, LAYOUT.margin + 35, yPos);
    yPos += LAYOUT.lineHeight;
    
    if (frete.detalhamento_envio.tipo === 'parcial' && frete.detalhamento_envio.descricao_parcial) {
      doc.setFontSize(LAYOUT.fontSize.small);
      doc.setTextColor(...COLORS.textGray);
      const descLines = doc.splitTextToSize(frete.detalhamento_envio.descricao_parcial, pageWidth - 2 * LAYOUT.margin - 15);
      doc.text(descLines, LAYOUT.margin + 10, yPos);
      yPos += descLines.length * 4 + 3;
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setTextColor(...COLORS.textDark);
    }
  }

  doc.text(`Frete via Lemon Caps: ${frete.frete_lemon_caps ? 'SIM' : 'NÃO'}`, LAYOUT.margin + 5, yPos);
  yPos += LAYOUT.lineHeight;

  if (frete.frete_lemon_caps && frete.usa_tabela_tradicional) {
    doc.text('Tabela Aplicada: Tradicional (valores padrão)', LAYOUT.margin + 5, yPos);
    yPos += LAYOUT.lineHeight + 3;
  } else if (frete.planos_customizados && frete.planos_customizados.length > 0) {
    doc.text('Planos Personalizados:', LAYOUT.margin + 5, yPos);
    yPos += LAYOUT.lineHeight;

    frete.planos_customizados.forEach(plano => {
      yPos = checkPageBreak(doc, yPos, 6);
      doc.text(`• ${plano.tipo_produto} - ${plano.plano}: ${formatCurrency(plano.valor)}`, LAYOUT.margin + 10, yPos);
      yPos += 5;
    });
    yPos += 5;
  }

  return yPos + LAYOUT.sectionGap;
}

function renderTotal(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const totalBoxHeight = 28;
  
  yPos = checkPageBreak(doc, yPos, totalBoxHeight + 10);
  yPos += 5;
  
  // Box do total
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'F');
  
  // Borda amarela
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(1);
  doc.rect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, totalBoxHeight, 'S');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('VALOR TOTAL DO ORÇAMENTO:', LAYOUT.margin + 10, yPos + 12);

  doc.setTextColor(...COLORS.brightYellow);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - LAYOUT.margin - 10, yPos + 18, { align: 'right' });

  return yPos + totalBoxHeight + LAYOUT.sectionGap + 5;
}

function renderFormaPagamento(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.forma_pagamento) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  const pagLines = doc.splitTextToSize(orcamento.forma_pagamento, pageWidth - 2 * LAYOUT.margin);
  const estimatedHeight = 15 + (pagLines.length * 5);
  
  yPos = checkPageBreak(doc, yPos, estimatedHeight);

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO:', LAYOUT.margin, yPos);
  yPos += LAYOUT.lineHeight;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.text(pagLines, LAYOUT.margin, yPos);
  
  return yPos + (pagLines.length * 5) + LAYOUT.sectionGap;
}

function renderObservacoes(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.observacoes) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  const obsLines = doc.splitTextToSize(orcamento.observacoes, pageWidth - 2 * LAYOUT.margin);
  const estimatedHeight = 15 + (obsLines.length * 5);
  
  yPos = checkPageBreak(doc, yPos, estimatedHeight);

  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('OBSERVAÇÕES:', LAYOUT.margin, yPos);
  yPos += LAYOUT.lineHeight;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.text(obsLines, LAYOUT.margin, yPos);
  
  return yPos + (obsLines.length * 5) + LAYOUT.sectionGap;
}

function renderValidade(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  yPos = checkPageBreak(doc, yPos, 15);

  doc.setTextColor(...COLORS.textGray);
  doc.setFontSize(LAYOUT.fontSize.small);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Este orçamento tem validade de ${orcamento.validade_dias} dias a partir da data de emissão.`,
    LAYOUT.margin,
    yPos
  );

  return yPos + 10;
}

function renderStatusWatermark(doc: jsPDF, orcamento: Orcamento): void {
  if (orcamento.status === 'rascunho') {
    return;
  }

  const pageHeight = getPageHeight(doc);
  const pageWidth = getPageWidth(doc);
  const totalPages = doc.getNumberOfPages();

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

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.setTextColor(...(statusColors[orcamento.status] || COLORS.textGray));
    doc.setFontSize(55);
    doc.setFont('helvetica', 'bold');
    
    doc.text(
      statusLabels[orcamento.status] || orcamento.status.toUpperCase(),
      pageWidth / 2,
      pageHeight / 2,
      { align: 'center', angle: 45 }
    );
    doc.restoreGraphicsState();
  }
}

// ========== FUNÇÃO PRINCIPAL ==========

async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Renderizar seções sequencialmente
  let yPos = await renderHeader(doc, orcamento);
  yPos = renderDadosCliente(doc, orcamento, yPos);
  yPos = renderProdutos(doc, orcamento, yPos);
  yPos = renderServicos(doc, orcamento, yPos);
  yPos = renderFrete(doc, orcamento, yPos);
  yPos = renderTotal(doc, orcamento, yPos);
  yPos = renderFormaPagamento(doc, orcamento, yPos);
  yPos = renderObservacoes(doc, orcamento, yPos);
  renderValidade(doc, orcamento, yPos);

  // Adicionar footer e marca d'água em todas as páginas
  addFooterToAllPages(doc);
  renderStatusWatermark(doc, orcamento);

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
