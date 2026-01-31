import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento, TABELA_FRETE, TipoProdutoFrete } from '@/types/orcamento';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Cores da identidade visual Lemon Caps
const COLORS = {
  darkGreen: [24, 26, 0] as [number, number, number],      // #181A00
  mediumGreen: [46, 48, 3] as [number, number, number],    // #2E3003
  lemonYellow: [202, 212, 0] as [number, number, number],  // #CAD400
  brightYellow: [242, 255, 0] as [number, number, number], // #F2FF00
  white: [255, 255, 255] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  textDark: [30, 30, 30] as [number, number, number],
  textGray: [100, 100, 100] as [number, number, number],
};

// Formatar valor em reais
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Função interna que cria o documento PDF
async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 0;

  // ========== HEADER COM LOGO ==========
  // Background do header
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Tentar carregar logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => reject(new Error('Failed to load logo'));
      logoImg.src = '/images/logo-lemoncaps.jpg';
    });

    // Adicionar logo
    const logoWidth = 45;
    const logoHeight = 20;
    doc.addImage(logoImg, 'JPEG', margin, 12, logoWidth, logoHeight);
  } catch (error) {
    // Se falhar ao carregar logo, mostrar texto
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('LEMON CAPS', margin, 28);
  }

  // Título do documento
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO COMERCIAL', pageWidth - margin, 18, { align: 'right' });

  // Consultor e Data
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (orcamento.consultor_responsavel) {
    doc.text(`Consultor: ${orcamento.consultor_responsavel}`, pageWidth - margin, 28, { align: 'right' });
  }
  doc.text(orcamento.numero_orcamento, pageWidth - margin, 36, { align: 'right' });
  doc.text(
    format(new Date(orcamento.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    pageWidth - margin, 
    44, 
    { align: 'right' }
  );

  yPos = 58;

  // ========== DADOS DO CLIENTE ==========
  const dadosCliente = orcamento.dados_cliente;
  const hasClienteData = dadosCliente && (
    dadosCliente.nome_completo || dadosCliente.email || dadosCliente.telefone || 
    dadosCliente.cpf || dadosCliente.cnpj || dadosCliente.razao_social
  );

  if (hasClienteData) {
    // Título da seção
    doc.setFillColor(...COLORS.mediumGreen);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setTextColor(...COLORS.textDark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

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

    clienteInfo.forEach(info => {
      doc.text(info, margin + 5, yPos);
      yPos += 5;
    });

    yPos += 5;
  } else {
    // Apenas nome do cliente
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 18, 'F');

    doc.setTextColor(...COLORS.textDark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('CLIENTE:', margin + 5, yPos + 8);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(orcamento.nome_cliente, margin + 5, yPos + 15);

    yPos += 25;
  }

  // ========== SEÇÃO: CUSTOS DE PRODUÇÃO ==========
  if (orcamento.itens_producao && orcamento.itens_producao.length > 0) {
    // Título da seção
    doc.setFillColor(...COLORS.mediumGreen);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOS DE PRODUÇÃO', margin + 5, yPos + 7);
    yPos += 14;

    // Renderizar cada item com sua composição
    orcamento.itens_producao.forEach((item, index) => {
      // Verificar se precisa de nova página
      const estimatedHeight = 30 + (item.insumos_formula?.length || 0) * 4;
      if (yPos + estimatedHeight > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }

      // Tabela do produto individual
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
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: COLORS.darkGreen,
          textColor: COLORS.white,
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          textColor: COLORS.textDark,
          fontSize: 9,
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

      yPos = (doc as any).lastAutoTable.finalY + 2;

      // Adicionar composição se for precificação com insumos
      if (item.tipo === 'precificacao' && item.insumos_formula && item.insumos_formula.length > 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textDark);
        doc.text('Composição:', margin + 5, yPos + 3);
        yPos += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textGray);

        item.insumos_formula.forEach(insumo => {
          doc.text(`• ${insumo.nome} - ${insumo.quantidade} ${insumo.unidade}`, margin + 8, yPos);
          yPos += 3.5;
        });

        yPos += 4;
      }
    });

    // Subtotal de produção
    yPos += 2;
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(...COLORS.textDark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', pageWidth - margin - 45, yPos + 5.5);
    doc.text(formatCurrency(orcamento.subtotal_producao), pageWidth - margin - 5, yPos + 5.5, { align: 'right' });

    yPos += 14;
  }

  // ========== SEÇÃO: SERVIÇOS DE MARCA ==========
  if (orcamento.servicos_marca && orcamento.servicos_marca.length > 0) {
    // Título da seção
    doc.setFillColor(...COLORS.mediumGreen);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVIÇO DE CRIAÇÃO DE MARCA PRÓPRIA', margin + 5, yPos + 7);
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
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: COLORS.darkGreen,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: COLORS.textDark,
        fontSize: 9,
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ========== SEÇÃO: DETALHAMENTO DE FRETE ==========
  const frete = orcamento.detalhamento_frete;
  if (frete && (frete.frete_lemon_caps !== undefined || (frete.planos_customizados && frete.planos_customizados.length > 0))) {
    // Título da seção
    doc.setFillColor(...COLORS.mediumGreen);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(...COLORS.lemonYellow);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO DE FRETE', margin + 5, yPos + 5.5);
    yPos += 12;

    doc.setTextColor(...COLORS.textDark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    doc.text(`Frete via Lemon Caps: ${frete.frete_lemon_caps ? 'SIM' : 'NÃO'}`, margin + 5, yPos);
    yPos += 5;

    if (frete.frete_lemon_caps && frete.usa_tabela_tradicional) {
      doc.text('Tabela Aplicada: Tradicional (valores padrão)', margin + 5, yPos);
      yPos += 8;
    } else if (frete.planos_customizados && frete.planos_customizados.length > 0) {
      doc.text('Planos Personalizados:', margin + 5, yPos);
      yPos += 5;

      frete.planos_customizados.forEach(plano => {
        doc.text(`• ${plano.tipo_produto} - ${plano.plano}: ${formatCurrency(plano.valor)}`, margin + 10, yPos);
        yPos += 4;
      });
      yPos += 4;
    }
  }

  // ========== VALOR TOTAL ==========
  yPos += 5;
  
  // Box do total
  const totalBoxHeight = 25;
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(margin, yPos, pageWidth - 2 * margin, totalBoxHeight, 'F');
  
  // Borda amarela
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(1);
  doc.rect(margin, yPos, pageWidth - 2 * margin, totalBoxHeight, 'S');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('VALOR TOTAL DO ORÇAMENTO:', margin + 10, yPos + 10);

  doc.setTextColor(...COLORS.brightYellow);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - margin - 10, yPos + 17, { align: 'right' });

  yPos += totalBoxHeight + 15;

  // ========== OBSERVAÇÕES ==========
  if (orcamento.observacoes) {
    doc.setTextColor(...COLORS.textDark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', margin, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(orcamento.observacoes, pageWidth - 2 * margin);
    doc.text(obsLines, margin, yPos);
    yPos += obsLines.length * 4 + 10;
  }

  // ========== VALIDADE ==========
  doc.setTextColor(...COLORS.textGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Este orçamento tem validade de ${orcamento.validade_dias} dias a partir da data de emissão.`,
    margin,
    yPos
  );

  // ========== FOOTER ==========
  const footerY = pageHeight - 20;
  
  // Linha separadora
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  // Texto do footer
  doc.setTextColor(...COLORS.textGray);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('LEMON CAPS - Suplementos e Produtos Naturais', pageWidth / 2, footerY, { align: 'center' });
  doc.text('www.lemoncaps.com.br', pageWidth / 2, footerY + 5, { align: 'center' });

  // ========== STATUS (Marca d'água se não for rascunho) ==========
  if (orcamento.status !== 'rascunho') {
    const statusLabels: Record<string, string> = {
      enviado: 'ENVIADO',
      aprovado: 'APROVADO',
      recusado: 'RECUSADO',
    };
    
    const statusColors: Record<string, [number, number, number]> = {
      enviado: [59, 130, 246],   // blue
      aprovado: [34, 197, 94],   // green
      recusado: [239, 68, 68],   // red
    };

    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    doc.setTextColor(...(statusColors[orcamento.status] || COLORS.textGray));
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    
    // Rotacionar texto
    doc.text(
      statusLabels[orcamento.status] || orcamento.status.toUpperCase(),
      pageWidth / 2,
      pageHeight / 2,
      { align: 'center', angle: 45 }
    );
    doc.restoreGraphicsState();
  }

  return doc;
}

// Para preview (retorna blob)
export async function generateOrcamentoPDFBlob(orcamento: Orcamento): Promise<Blob> {
  const doc = await createOrcamentoPDF(orcamento);
  return doc.output('blob');
}

// Para download (salva arquivo)
export async function generateOrcamentoPDF(orcamento: Orcamento): Promise<void> {
  const doc = await createOrcamentoPDF(orcamento);
  
  const nomeArquivo = orcamento.consultor_responsavel 
    ? `${orcamento.consultor_responsavel.replace(/\s+/g, '-')}-${orcamento.nome_cliente.replace(/\s+/g, '-')}`
    : `${orcamento.numero_orcamento}-${orcamento.nome_cliente.replace(/\s+/g, '-')}`;
  
  doc.save(`${nomeArquivo}.pdf`);
}
