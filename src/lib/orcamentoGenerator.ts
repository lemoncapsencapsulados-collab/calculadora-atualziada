import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Orcamento, DadosCliente, DetalhamentoFrete, CondicoesPagamento, FormaPagamentoTipo, PessoaFisicaResponsavel, FormaPagamentoAvista } from '@/types/orcamento';
import { formatCurrency } from '@/lib/unitConversion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchFreteCotacaoByOrcamento, fetchFreteCotacoesByOrcamento } from '@/hooks/useFreteCotacoes';
import { linhaPdfFrete, blocoPdfFrete } from '@/lib/freteHelpers';
import type { FreteCotacao } from '@/types/frete';
import { LINHA_PRODUTO_CURTO } from '@/lib/linhaProduto';
import { nomeArquivoDocumento } from '@/lib/nomeArquivo';

// ========== LAYOUT PREMIUM - ALTO PADRÃO ==========
const LAYOUT = {
  margin: 20,           // Margem generosa
  marginBottom: 40,     // Margem inferior reservada para footer (evita sobreposição)
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

// ========== FUNÇÕES UTILITÁRIAS ==========


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

function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text(
      `Página ${i} de ${totalPages}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 8,
      { align: 'center' }
    );
  }
}

function formatEndereco(dados?: DadosCliente): string {
  if (!dados) return '';
  const parts = [
    dados.endereco_cnpj,
    dados.cep_cnpj ? `CEP: ${dados.cep_cnpj}` : null,
    dados.cidade && dados.estado ? `${dados.cidade}/${dados.estado}` : null,
  ].filter(Boolean);
  return parts.join(' - ');
}

function formatCanalVenda(forma?: string): string {
  const labels: Record<string, string> = {
    'locais_fisicos': 'Locais Físicos',
    'venda_digital': 'Venda Digital',
    'ambas': 'Físico e Digital',
    'sem_informacao': 'Não Informado',
  };
  return forma ? labels[forma] || forma : '';
}

function getTipoLogisticaLabel(tipo?: string): string {
  const labels: Record<string, string> = {
    'total_produtor': 'Total para o Produtor',
    'total_lemoncaps': 'Logística Lemon Caps',
    'parcial': 'Envio Parcial',
  };
  return tipo ? labels[tipo] || tipo : '';
}

function getFormaPagamentoLabel(tipo?: FormaPagamentoTipo): string {
  const labels: Record<FormaPagamentoTipo, string> = {
    'pix': 'PIX',
    'cartao_credito': 'Cartão de Crédito',
    'cartao_debito': 'Cartão de Débito',
    'boleto': 'Boleto',
    'transferencia': 'Transferência Bancária',
    'outro': 'Outro',
  };
  return tipo ? labels[tipo] || tipo : '';
}

function getFormaAvistaLabel(forma?: FormaPagamentoAvista): string {
  const labels: Record<string, string> = {
    'pix': 'PIX',
    'transferencia': 'Transferência Bancária',
    'debito': 'Cartão de Débito',
    'boleto': 'Boleto',
  };
  return forma ? labels[forma] || forma : '';
}

function renderPessoaFisicaFields(doc: jsPDF, pf: PessoaFisicaResponsavel, titulo: string, yPos: number, labelWidth: number): number {
  const pageWidth = getPageWidth(doc);

  yPos = checkPageBreak(doc, yPos, 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkGreen);
  doc.setFontSize(LAYOUT.fontSize.small);
  doc.text(titulo, LAYOUT.margin + 3, yPos);
  yPos += LAYOUT.lineHeight;

  const campos = [
    { label: 'Nome', valor: pf.nome },
    { label: 'CPF', valor: pf.cpf },
    { label: 'RG', valor: pf.rg },
    { label: 'Estado Civil', valor: pf.estado_civil },
    { label: 'Email', valor: pf.email },
    { label: 'Telefone', valor: pf.telefone },
    { label: 'Endereço', valor: pf.endereco },
    { label: 'Número', valor: pf.numero },
    { label: 'Bairro', valor: pf.bairro },
    { label: 'CEP', valor: pf.cep },
    { label: 'Cidade/UF', valor: pf.cidade && pf.estado ? `${pf.cidade}/${pf.estado}` : (pf.cidade || pf.estado || '') },
  ];

  doc.setFontSize(LAYOUT.fontSize.body);
  for (const campo of campos) {
    if (campo.valor) {
      yPos = checkPageBreak(doc, yPos, LAYOUT.lineHeight);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textMedium);
      doc.text(`${campo.label}:`, LAYOUT.margin + 5, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      const maxWidth = pageWidth - LAYOUT.margin - labelWidth - LAYOUT.margin;
      const lines = doc.splitTextToSize(campo.valor, maxWidth);
      doc.text(lines, LAYOUT.margin + labelWidth, yPos);
      yPos += LAYOUT.lineHeight * Math.max(lines.length, 1);
    }
  }
  return yPos + 3;
}

// ========== FUNÇÕES DE RENDERIZAÇÃO PREMIUM ==========

function renderHeader(doc: jsPDF, orcamento: Orcamento): number {
  const pageWidth = getPageWidth(doc);
  
  // Background do header
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
  doc.text('ORÇAMENTO COMERCIAL', pageWidth - LAYOUT.margin, 16, { align: 'right' });

  // Número e data
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${orcamento.numero_orcamento}`, pageWidth - LAYOUT.margin, 24, { align: 'right' });
  doc.text(format(new Date(orcamento.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth - LAYOUT.margin, 32, { align: 'right' });

  // Linha de destaque
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(1);
  doc.line(0, LAYOUT.headerHeight, pageWidth, LAYOUT.headerHeight);

  return LAYOUT.headerHeight + LAYOUT.sectionGap;
}

function renderConsultor(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.consultor_responsavel) return yPos;
  
  const pageWidth = getPageWidth(doc);
  
  doc.setTextColor(...COLORS.textMedium);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  doc.text(`Consultor Responsável: ${orcamento.consultor_responsavel}`, LAYOUT.margin, yPos);
  
  // Linha sutil
  doc.setDrawColor(...COLORS.borderGray);
  doc.setLineWidth(0.3);
  doc.line(LAYOUT.margin, yPos + 4, pageWidth - LAYOUT.margin, yPos + 4);
  
  return yPos + LAYOUT.sectionGap + 4;
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

function renderDadosCliente(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const dados = orcamento.dados_cliente;
  const labelWidth = 45;

  yPos = renderSectionTitle(doc, 'Dados do Cliente', yPos);
  
  // Nome do cliente em destaque
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(LAYOUT.fontSize.body + 2);
  doc.setFont('helvetica', 'bold');
  doc.text(orcamento.nome_cliente, LAYOUT.margin, yPos);
  yPos += LAYOUT.lineHeight + 2;

  if (!dados) return yPos + LAYOUT.sectionGap;

  const tipoPessoa = dados.tipo_pessoa || (dados.cnpj ? 'pj' : 'pf');
  doc.setFontSize(LAYOUT.fontSize.body);

  if (tipoPessoa === 'pj') {
    // === PESSOA JURÍDICA ===
    const camposPJ = [
      { label: 'CNPJ', valor: dados.cnpj },
      { label: 'Razão Social', valor: dados.razao_social },
      { label: 'Insc. Estadual', valor: dados.inscricao_estadual },
      { label: 'Insc. Municipal', valor: dados.inscricao_municipal },
      { label: 'Endereço', valor: dados.endereco_cnpj },
      { label: 'Número', valor: dados.numero_cnpj },
      { label: 'Bairro', valor: dados.bairro_cnpj },
      { label: 'CEP', valor: dados.cep_cnpj },
      { label: 'Cidade/UF', valor: dados.cidade && dados.estado ? `${dados.cidade}/${dados.estado}` : '' },
      { label: 'Telefone', valor: dados.telefone },
      { label: 'Email', valor: dados.email },
    ];

    for (const campo of camposPJ) {
      if (campo.valor) {
        yPos = checkPageBreak(doc, yPos, LAYOUT.lineHeight);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textMedium);
        doc.text(`${campo.label}:`, LAYOUT.margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        const maxWidth = pageWidth - LAYOUT.margin - labelWidth - LAYOUT.margin;
        const lines = doc.splitTextToSize(campo.valor, maxWidth);
        doc.text(lines, LAYOUT.margin + labelWidth, yPos);
        yPos += LAYOUT.lineHeight * Math.max(lines.length, 1);
      }
    }

    // QSA - Responsável PJ
    if (dados.responsavel_pj && dados.responsavel_pj.nome) {
      yPos += 4;
      yPos = renderPessoaFisicaFields(doc, dados.responsavel_pj, 'Responsável Legal (QSA)', yPos, labelWidth);
    }
  } else {
    // === PESSOA FÍSICA ===
    if (dados.pessoas_fisicas && dados.pessoas_fisicas.length > 0) {
      for (let i = 0; i < dados.pessoas_fisicas.length; i++) {
        const pf = dados.pessoas_fisicas[i];
        const titulo = dados.pessoas_fisicas.length > 1 ? `Pessoa Física ${i + 1}` : 'Pessoa Física';
        yPos = renderPessoaFisicaFields(doc, pf, titulo, yPos, labelWidth);
      }
    } else {
      // Legado: campos antigos
      const camposLegado = [
        { label: 'Nome', valor: dados.nome_completo },
        { label: 'CPF', valor: dados.cpf },
        { label: 'Email', valor: dados.email },
        { label: 'Telefone', valor: dados.telefone },
      ];
      for (const campo of camposLegado) {
        if (campo.valor) {
          yPos = checkPageBreak(doc, yPos, LAYOUT.lineHeight);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.textMedium);
          doc.text(`${campo.label}:`, LAYOUT.margin, yPos);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.textDark);
          doc.text(campo.valor, LAYOUT.margin + labelWidth, yPos);
          yPos += LAYOUT.lineHeight;
        }
      }
    }
  }

  // Canal de venda
  const canalVenda = formatCanalVenda(dados.forma_venda);
  if (canalVenda) {
    yPos = checkPageBreak(doc, yPos, LAYOUT.lineHeight);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Canal de Venda:', LAYOUT.margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(canalVenda, LAYOUT.margin + labelWidth, yPos);
    yPos += LAYOUT.lineHeight;
  }

  return yPos + LAYOUT.sectionGap;
}

function renderProdutos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.itens_producao || orcamento.itens_producao.length === 0) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);

  // Renderizar cada produto detalhadamente
  orcamento.itens_producao.forEach((item, index) => {
    const isPOD = item.modelo_negocio === 'print_on_demand';
    
    // Verificar espaço - cada produto precisa de aprox. 30-50mm
    const estimatedHeight = isPOD ? 20 : 25 + (item.insumos_formula?.length || 0) * 5;
    // Para o primeiro item, garantir que título + item caibam juntos (evita título órfão)
    if (index === 0) {
      const pageHeight = doc.internal.pageSize.getHeight();
      const needed = 15 + estimatedHeight; // título + item
      if (yPos + needed > pageHeight - 20) {
        doc.addPage();
        yPos = LAYOUT.margin;
      }
      yPos = renderSectionTitle(doc, 'Produtos', yPos);
    } else {
      yPos = checkPageBreak(doc, yPos, estimatedHeight);
    }
    
    // Número e nome do produto
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(LAYOUT.margin, yPos - 4, pageWidth - 2 * LAYOUT.margin, 10, 'F');
    
    doc.setTextColor(...COLORS.darkGreen);
    doc.setFontSize(LAYOUT.fontSize.body + 1);
    doc.setFont('helvetica', 'bold');
    
    const nomeLabel = isPOD ? `${index + 1}. ${item.nome_produto}  —  PRINT ON DEMAND` : `${index + 1}. ${item.nome_produto}`;
    doc.text(nomeLabel, LAYOUT.margin + 3, yPos + 2);
    
    // Segmento
    doc.setTextColor(...COLORS.textMedium);
    doc.setFontSize(LAYOUT.fontSize.small);
    doc.setFont('helvetica', 'normal');
    // A linha do produto vai junto do segmento: o financeiro precisa saber se a
    // formula e' do catalogo ou personalizada para tratar estabilidade e prazo.
    const linha = item.linha_produto ? LINHA_PRODUTO_CURTO[item.linha_produto] : '';
    const direita = linha ? `${linha}  ·  Segmento: ${item.segmento}` : `Segmento: ${item.segmento}`;
    doc.text(direita, pageWidth - LAYOUT.margin - 3, yPos + 2, { align: 'right' });
    
    yPos += 12;
    
    if (isPOD) {
      // POD: composição completa + custo unitário (sem quantidade de frascos/subtotal de lote)
      
      // Detalhes do produto
      if (item.quantidade_por_pote && item.unidade_por_pote) {
        doc.setTextColor(...COLORS.textDark);
        doc.setFontSize(LAYOUT.fontSize.body);
        doc.setFont('helvetica', 'normal');
        doc.text(`Quantidade por frasco: ${item.quantidade_por_pote} ${item.unidade_por_pote}`, LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight;
      }
      
      if (item.dose_diaria_sugerida) {
        doc.setTextColor(...COLORS.textDark);
        doc.setFontSize(LAYOUT.fontSize.body);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dose diária sugerida: ${item.dose_diaria_sugerida}`, LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight;
      }
      
      // Composição completa
      if (item.insumos_formula && item.insumos_formula.length > 0) {
        yPos += 2;
        doc.setTextColor(...COLORS.textMedium);
        doc.setFontSize(LAYOUT.fontSize.small);
        doc.setFont('helvetica', 'bold');
        doc.text('Composição da Fórmula:', LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight - 1;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        
        const sanitizarNome = (nome: string) => {
          if (nome.toLowerCase().includes('amido') && nome.toLowerCase().includes('milho')) return 'Excipiente';
          return nome;
        };
        
        for (const insumo of item.insumos_formula) {
          yPos = checkPageBreak(doc, yPos, 5);
          doc.text(`• ${sanitizarNome(insumo.nome)} - ${insumo.quantidade} ${insumo.unidade}`, LAYOUT.margin + 10, yPos);
          yPos += 5;
        }
      }
      
      // Detalhes de produção (cores, sabor, etc.)
      if (item.detalhes_producao) {
        const dp = item.detalhes_producao;
        const detalhes = [
          dp.cor_pote ? `Cor do Pote: ${dp.cor_pote}` : null,
          dp.cor_tampa ? `Cor da Tampa: ${dp.cor_tampa}` : null,
          dp.cor_gummy ? `Cor Gummy: ${dp.cor_gummy}` : null,
          dp.sabor_gummy ? `Sabor Gummy: ${dp.sabor_gummy}` : null,
          dp.sabor_soluvel ? `Sabor Solúvel: ${dp.sabor_soluvel}` : null,
          dp.cor_soluvel ? `Cor Solúvel: ${dp.cor_soluvel}` : null,
          dp.sabor_liquido ? `Sabor Líquido: ${dp.sabor_liquido}` : null,
          dp.cor_liquido ? `Cor Líquido: ${dp.cor_liquido}` : null,
          dp.observacao_producao ? `Obs. Produção: ${dp.observacao_producao}` : null,
        ].filter(Boolean) as string[];

        if (detalhes.length > 0) {
          yPos += 2;
          doc.setTextColor(...COLORS.textMedium);
          doc.setFontSize(LAYOUT.fontSize.small);
          doc.setFont('helvetica', 'bold');
          doc.text('Detalhes de Produção:', LAYOUT.margin + 5, yPos);
          yPos += LAYOUT.lineHeight - 1;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.textDark);
          for (const detalhe of detalhes) {
            yPos = checkPageBreak(doc, yPos, 5);
            doc.text(`• ${detalhe}`, LAYOUT.margin + 10, yPos);
            yPos += 5;
          }
        }
      }

      yPos += 3;
      
      const col3 = pageWidth - LAYOUT.margin - 3;
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setTextColor(...COLORS.textMedium);
      doc.setFont('helvetica', 'normal');
      doc.text(`Custo Unitário: ${formatCurrency(item.preco_unitario)}`, LAYOUT.margin + 5, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.darkGreen);
      doc.text(`Subtotal: ${formatCurrency(item.subtotal)}`, col3, yPos, { align: 'right' });
      
      yPos += LAYOUT.lineHeight + 5;
    } else {
      // Estoque: renderização completa
      // Detalhes do produto
      if (item.quantidade_por_pote && item.unidade_por_pote) {
        doc.setTextColor(...COLORS.textDark);
        doc.setFontSize(LAYOUT.fontSize.body);
        doc.setFont('helvetica', 'normal');
        doc.text(`Quantidade por frasco: ${item.quantidade_por_pote} ${item.unidade_por_pote}`, LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight;
      }
      
      if (item.dose_diaria_sugerida) {
        doc.text(`Dose diária sugerida: ${item.dose_diaria_sugerida}`, LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight;
      }
      
      // Composição completa
      if (item.insumos_formula && item.insumos_formula.length > 0) {
        yPos += 2;
        doc.setTextColor(...COLORS.textMedium);
        doc.setFontSize(LAYOUT.fontSize.small);
        doc.setFont('helvetica', 'bold');
        doc.text('Composição da Fórmula:', LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight - 1;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        
        const sanitizarNome = (nome: string) => {
          if (nome.toLowerCase().includes('amido') && nome.toLowerCase().includes('milho')) return 'Excipiente';
          return nome;
        };
        
        for (const insumo of item.insumos_formula) {
          yPos = checkPageBreak(doc, yPos, 5);
          doc.text(`• ${sanitizarNome(insumo.nome)} - ${insumo.quantidade} ${insumo.unidade}`, LAYOUT.margin + 10, yPos);
          yPos += 5;
        }
      }
      
      // Detalhes de produção (cores, sabor, etc.)
      if (item.detalhes_producao) {
        const dp = item.detalhes_producao;
        const detalhes = [
          dp.cor_pote ? `Cor do Pote: ${dp.cor_pote}` : null,
          dp.cor_tampa ? `Cor da Tampa: ${dp.cor_tampa}` : null,
          dp.cor_gummy ? `Cor Gummy: ${dp.cor_gummy}` : null,
          dp.sabor_gummy ? `Sabor Gummy: ${dp.sabor_gummy}` : null,
          dp.sabor_soluvel ? `Sabor Solúvel: ${dp.sabor_soluvel}` : null,
          dp.cor_soluvel ? `Cor Solúvel: ${dp.cor_soluvel}` : null,
          dp.sabor_liquido ? `Sabor Líquido: ${dp.sabor_liquido}` : null,
          dp.cor_liquido ? `Cor Líquido: ${dp.cor_liquido}` : null,
          dp.observacao_producao ? `Obs. Produção: ${dp.observacao_producao}` : null,
        ].filter(Boolean) as string[];

        if (detalhes.length > 0) {
          yPos += 2;
          doc.setTextColor(...COLORS.textMedium);
          doc.setFontSize(LAYOUT.fontSize.small);
          doc.setFont('helvetica', 'bold');
          doc.text('Detalhes de Produção:', LAYOUT.margin + 5, yPos);
          yPos += LAYOUT.lineHeight - 1;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.textDark);
          for (const detalhe of detalhes) {
            yPos = checkPageBreak(doc, yPos, 5);
            doc.text(`• ${detalhe}`, LAYOUT.margin + 10, yPos);
            yPos += 5;
          }
        }
      }

      yPos += 3;
      
      // Valores do produto
      const col1 = LAYOUT.margin + 5;
      const col2 = pageWidth / 2;
      const col3 = pageWidth - LAYOUT.margin - 3;
      
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setTextColor(...COLORS.textMedium);
      doc.setFont('helvetica', 'normal');
      doc.text(`Quantidade: ${item.quantidade} un.`, col1, yPos);
      doc.text(`Preço Unit.: ${formatCurrency(item.preco_unitario)}`, col2, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.darkGreen);
      doc.text(`Subtotal: ${formatCurrency(item.subtotal)}`, col3, yPos, { align: 'right' });
      
      yPos += LAYOUT.lineHeight + 5;
    }
    
    // Linha divisória entre produtos
    if (index < orcamento.itens_producao.length - 1) {
      doc.setDrawColor(...COLORS.borderGray);
      doc.setLineWidth(0.3);
      doc.line(LAYOUT.margin + 5, yPos - 2, pageWidth - LAYOUT.margin - 5, yPos - 2);
      yPos += 5;
    }
  });

  // Subtotal de produção
  yPos = checkPageBreak(doc, yPos, 15);
  yPos += 3;
  
  doc.setFillColor(...COLORS.mediumGreen);
  doc.rect(pageWidth / 2, yPos - 4, pageWidth / 2 - LAYOUT.margin, 10, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL PRODUÇÃO:', pageWidth / 2 + 5, yPos + 2);
  doc.setFontSize(LAYOUT.fontSize.body + 2);
  doc.text(formatCurrency(orcamento.subtotal_producao), pageWidth - LAYOUT.margin - 5, yPos + 2, { align: 'right' });

  return yPos + 15 + LAYOUT.sectionGap;
}

function renderServicos(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const todosVisiveis = (orcamento.servicos_marca || []).filter(
    (s: any) => s?.setup_detalhes?.perfil !== 'revenda_lemon'
  );
  if (todosVisiveis.length === 0) {
    return yPos;
  }

  const producao = todosVisiveis.filter((s: any) => s?.setup_detalhes?.categoria === 'producao');
  const marca = todosVisiveis.filter((s: any) => s?.setup_detalhes?.categoria !== 'producao');

  const pageWidth = getPageWidth(doc);

  // Sanitiza descrição: NUNCA expor custo interno/margem ao cliente.
  const sanitizarDescricao = (desc: string | undefined | null): string => {
    if (!desc) return '-';
    let s = String(desc);
    s = s.replace(/Custo:\s*R?\$?\s*[\d.,]+\s*(\|\s*Margem:\s*[\d.,]+\s*%?)?/gi, '');
    s = s.replace(/Custo:\s*R?\$?\s*[\d.,]+\s*(\|\s*Valor\s*fixo)?/gi, '');
    s = s.replace(/Margem:\s*[\d.,]+\s*%?/gi, '');
    s = s.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').replace(/\s*\|\s*\|\s*/g, ' | ').trim();
    return s || '-';
  };

  const renderGrupo = (
    titulo: string,
    lista: any[],
    subtotalLabel: string,
    subtotalValor: number,
    yIn: number,
  ): number => {
    if (lista.length === 0) return yIn;
    let y = renderSectionTitle(doc, titulo, yIn);

    const tableData = lista.map((servico) => [
      servico.nome_plano,
      sanitizarDescricao(servico.descricao),
      formatCurrency(servico.valor),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Serviço', 'Descrição', 'Valor']],
      body: tableData,
      margin: { left: LAYOUT.margin, right: LAYOUT.margin },
      headStyles: {
        fillColor: COLORS.darkGreen,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: LAYOUT.fontSize.small,
        cellPadding: 4,
      },
      bodyStyles: {
        textColor: COLORS.textDark,
        fontSize: LAYOUT.fontSize.body,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: COLORS.lightGray,
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    for (const servico of lista) {
      const entregaveis = (servico as any).entregaveis as Array<{ nome: string; incluso: boolean; quantidade: number }> | undefined;
      if (!entregaveis || entregaveis.length === 0) continue;
      const inclusos = entregaveis.filter(e => e.incluso);
      if (inclusos.length === 0) continue;

      y = checkPageBreak(doc, y, 10 + inclusos.length * 5);

      doc.setFontSize(LAYOUT.fontSize.small);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.darkGreen);
      doc.text(`Entregáveis — ${servico.nome_plano}:`, LAYOUT.margin + 5, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      const pageWidthEnt = getPageWidth(doc);
      const indent = LAYOUT.margin + 10;
      const maxWidth = pageWidthEnt - indent - LAYOUT.margin;
      for (const ent of inclusos) {
        const qtdLabel = ent.quantidade > 1 ? ` (${ent.quantidade}x)` : '';
        const nomeNormalizado = String(ent.nome || '')
          .replace(/[\u00A0\u2007\u202F]/g, ' ')
          .replace(/[\t\r\n]+/g, ' ')
          .replace(/[\u2700-\u27BF\u2600-\u26FF\u2300-\u23FF\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '')
          .replace(/\s+/g, ' ')
          .trim();
        const linhas = doc.splitTextToSize(`• ${nomeNormalizado}${qtdLabel}`, maxWidth) as string[];
        for (let i = 0; i < linhas.length; i++) {
          y = checkPageBreak(doc, y, 5);
          const x = i === 0 ? indent : indent + 3;
          doc.text(linhas[i], x, y);
          y += 5;
        }
      }
      y += 3;
    }

    y = checkPageBreak(doc, y, 15);
    doc.setFillColor(...COLORS.mediumGreen);
    doc.rect(pageWidth / 2, y, pageWidth / 2 - LAYOUT.margin, 10, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(LAYOUT.fontSize.body);
    doc.setFont('helvetica', 'bold');
    doc.text(subtotalLabel, pageWidth / 2 + 5, y + 6);
    doc.setFontSize(LAYOUT.fontSize.body + 2);
    doc.text(formatCurrency(subtotalValor), pageWidth - LAYOUT.margin - 5, y + 6, { align: 'right' });

    return y + 15 + LAYOUT.sectionGap;
  };

  const subtotalProducao = producao.reduce((acc, s: any) => acc + (Number(s.valor) || 0), 0);
  const subtotalMarca = marca.reduce((acc, s: any) => acc + (Number(s.valor) || 0), 0);

  yPos = renderGrupo('Serviços de Produção', producao, 'SUBTOTAL SERV. PRODUÇÃO:', subtotalProducao, yPos);
  yPos = renderGrupo('Serviços de Marca', marca, 'SUBTOTAL SERV. MARCA:', subtotalMarca, yPos);

  return yPos;
}

function renderFrete(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const frete = orcamento.detalhamento_frete;
  const cotacoes = ((orcamento as any).__freteCotacoes as FreteCotacao[] | undefined) || [];
  if (cotacoes.length === 0 && (!frete || (frete.frete_lemon_caps === undefined && !frete.detalhamento_envio))) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  
  yPos = renderSectionTitle(doc, 'Detalhamento de Frete', yPos);

  // Um bloco por cotação vinculada (um por produto), Estoque Próprio ou POD
  for (const cotacao of cotacoes) {
    const bloco = blocoPdfFrete(cotacao);
    if (!bloco) continue;
    yPos = checkPageBreak(doc, yPos, 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.darkGreen);
    doc.setFontSize(LAYOUT.fontSize.body);
    doc.text(bloco.titulo, LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight;

    // Metadados (produto / tipo / envios)
    const meta: string[] = [];
    if (bloco.nomeProduto) meta.push(`Produto: ${bloco.nomeProduto}`);
    if (bloco.tipoProduto) meta.push(`Tipo: ${bloco.tipoProduto}`);
    if (bloco.tipo === 'pod' && bloco.quantEnviosMedio != null) {
      meta.push(`Quant. envios mensais médio: ${bloco.quantEnviosMedio}`);
    }
    if (meta.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textMedium);
      doc.setFontSize(LAYOUT.fontSize.small);
      const metaLinhas = doc.splitTextToSize(meta.join(' · '), pageWidth - 2 * LAYOUT.margin);
      doc.text(metaLinhas, LAYOUT.margin, yPos);
      yPos += (LAYOUT.lineHeight - 1) * metaLinhas.length;
    }
    yPos += 2;

    if (bloco.tipo === 'pod' && bloco.planos && bloco.planos.length > 0) {
      autoTable(doc, {
        startY: yPos,
        margin: { left: LAYOUT.margin, right: LAYOUT.margin },
        head: [['Plano (frascos)', 'Preço / Envio']],
        body: bloco.planos.map(p => [String(p.plano), formatCurrency(p.precoEnvio)]),
        theme: 'grid',
        headStyles: { fillColor: COLORS.darkGreen, textColor: COLORS.white, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: LAYOUT.fontSize.body, textColor: COLORS.textDark, halign: 'center' },
        columnStyles: { 0: { halign: 'center' }, 1: { halign: 'right', fontStyle: 'bold' } },
      });
      yPos = (doc as any).lastAutoTable.finalY + 4;
    } else if (bloco.tipo === 'estoque_proprio') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textDark);
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.text(`Valor do frete: ${formatCurrency(Number(bloco.valorFrete || 0))}  ·  Status: ${bloco.status || '—'}`, LAYOUT.margin, yPos);
      yPos += LAYOUT.lineHeight;
    }

    if (bloco.nota) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...COLORS.textLight);
      doc.setFontSize(LAYOUT.fontSize.small);
      const notaLinhas = doc.splitTextToSize(bloco.nota, pageWidth - 2 * LAYOUT.margin);
      doc.text(notaLinhas, LAYOUT.margin, yPos);
      yPos += (LAYOUT.lineHeight - 1) * notaLinhas.length;
    }
    yPos += 4;
  }

  if (!frete || (frete.frete_lemon_caps === undefined && !frete.detalhamento_envio)) {
    return yPos + LAYOUT.sectionGap;
  }

  doc.setFontSize(LAYOUT.fontSize.body);
  const labelWidth = 45;

  // Tipo de logística
  if (frete.detalhamento_envio) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Tipo de Logística:', LAYOUT.margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text(getTipoLogisticaLabel(frete.detalhamento_envio.tipo), LAYOUT.margin + labelWidth, yPos);
    yPos += LAYOUT.lineHeight;
    
    if (frete.detalhamento_envio.descricao_parcial) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textMedium);
      doc.text('Detalhes:', LAYOUT.margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      
      const maxWidth = pageWidth - LAYOUT.margin - labelWidth - LAYOUT.margin;
      const lines = doc.splitTextToSize(frete.detalhamento_envio.descricao_parcial, maxWidth);
      doc.text(lines, LAYOUT.margin + labelWidth, yPos);
      yPos += LAYOUT.lineHeight * lines.length;
    }
  }

  // Frete LC
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.textMedium);
  doc.text('Frete Lemon Caps:', LAYOUT.margin, yPos);
  doc.setFont('helvetica', 'bold');
  if (frete.frete_lemon_caps) {
    doc.setTextColor(34, 197, 94);
  } else {
    doc.setTextColor(...COLORS.textDark);
  }
  doc.text(frete.frete_lemon_caps ? 'SIM' : 'NÃO', LAYOUT.margin + labelWidth, yPos);
  yPos += LAYOUT.lineHeight;

  // Tabela tradicional
  if (frete.usa_tabela_tradicional) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Tabela de Preços:', LAYOUT.margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    doc.text('Tradicional', LAYOUT.margin + labelWidth, yPos);
    yPos += LAYOUT.lineHeight;
  }

  // Planos customizados
  if (frete.planos_customizados && frete.planos_customizados.length > 0) {
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.textMedium);
    doc.text('Planos de Frete Customizados:', LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textDark);
    
    for (const plano of frete.planos_customizados) {
      yPos = checkPageBreak(doc, yPos, 6);
      doc.text(`• ${plano.tipo_produto}: ${plano.plano} - ${formatCurrency(plano.valor)}`, LAYOUT.margin + 5, yPos);
      yPos += LAYOUT.lineHeight;
    }
  }

  return yPos + LAYOUT.sectionGap;
}

function renderTotal(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const pageWidth = getPageWidth(doc);
  const boxHeight = 28;
  
  yPos = checkPageBreak(doc, yPos, boxHeight + 15);
  yPos += 8;
  
  // Box do total
  doc.setFillColor(...COLORS.darkGreen);
  doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, boxHeight, 3, 3, 'F');
  
  // Borda amarela
  doc.setDrawColor(...COLORS.lemonYellow);
  doc.setLineWidth(1.5);
  doc.roundedRect(LAYOUT.margin, yPos, pageWidth - 2 * LAYOUT.margin, boxHeight, 3, 3, 'S');

  // Texto
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL', LAYOUT.margin + 12, yPos + 17);

  doc.setTextColor(...COLORS.brightYellow);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(orcamento.valor_total), pageWidth - LAYOUT.margin - 12, yPos + 18, { align: 'right' });

  return yPos + boxHeight + LAYOUT.sectionGap + 5;
}

function renderCondicoesPagamento(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const condicoes = orcamento.condicoes_pagamento;
  if (!condicoes) return yPos;

  // Check if there's any data (new format or legacy)
  const hasNewFormat = !!condicoes.metodo_principal;
  const hasLegacyFormat = condicoes.valor_entrada !== undefined || condicoes.valor_termino !== undefined || condicoes.usa_valor_restante;
  if (!hasNewFormat && !hasLegacyFormat) return yPos;

  const pageWidth = getPageWidth(doc);
  yPos = checkPageBreak(doc, yPos, 50);
  yPos = renderSectionTitle(doc, 'Condições de Pagamento', yPos);

  const labelWidth = 45;

  if (hasNewFormat) {
    // === NOVO FORMATO ===
    const metodo = condicoes.metodo_principal;
    const JUROS: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0.07, 5: 0.08, 6: 0.09 };

    const formatDateBR = (iso?: string) => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return d && m && y ? `${d}/${m}/${y}` : iso;
    };
    const metodoLabel: Record<string, string> = {
      pix_boleto: 'PIX / Boleto',
      cartao_credito: 'Cartão de Crédito',
      misto: 'Misto (PIX/Boleto + Cartão)',
    };
    if (metodo && metodoLabel[metodo]) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textMedium);
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.text('Método:', LAYOUT.margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      doc.text(metodoLabel[metodo], LAYOUT.margin + labelWidth, yPos);
      yPos += LAYOUT.lineHeight + 2;
    }

    const renderPixBoleto = (parcelas: any[], label: string) => {
      doc.setFillColor(...COLORS.lightGray);
      const height = 10 + parcelas.length * LAYOUT.lineHeight;
      doc.roundedRect(LAYOUT.margin, yPos - 4, pageWidth - 2 * LAYOUT.margin, height, 2, 2, 'F');
      doc.setTextColor(...COLORS.darkGreen);
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setFont('helvetica', 'bold');
      doc.text(label, LAYOUT.margin + 5, yPos + 2);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      parcelas.forEach((p: any, i: number) => {
        const val = p.tipo_valor === 'percentual' ? orcamento.valor_total * p.valor / 100 : p.valor;
        const pctLabel = p.tipo_valor === 'percentual' ? ` (${p.valor}%)` : '';
        const vencLabel = p.data_vencimento ? ` — vence ${formatDateBR(p.data_vencimento)}` : '';
        doc.text(`Parcela ${i + 1}: ${formatCurrency(val)}${pctLabel}${vencLabel}`, LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight;
      });
      yPos += 4;
    };

    const renderCartoes = (cartoes: any[], label: string) => {
      doc.setFillColor(...COLORS.lightGray);
      const height = 10 + cartoes.length * LAYOUT.lineHeight * 1.5;
      doc.roundedRect(LAYOUT.margin, yPos - 4, pageWidth - 2 * LAYOUT.margin, height, 2, 2, 'F');
      doc.setTextColor(...COLORS.darkGreen);
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setFont('helvetica', 'bold');
      doc.text(label, LAYOUT.margin + 5, yPos + 2);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      cartoes.forEach((c: any, i: number) => {
        const base = c.tipo_valor === 'percentual' ? orcamento.valor_total * c.valor / 100 : c.valor;
        const taxa = JUROS[c.parcelas] || 0;
        const total = base * (1 + taxa);
        const vp = total / c.parcelas;
        const pctLabel = c.tipo_valor === 'percentual' ? ` (${c.valor}%)` : '';
        const jurosLabel = taxa > 0 ? ` +${(taxa * 100).toFixed(0)}% juros` : '';
        const vencLabel = c.data_primeira_parcela ? ` — 1ª em ${formatDateBR(c.data_primeira_parcela)}` : '';
        doc.text(`Cartão ${i + 1}: ${c.parcelas}x de ${formatCurrency(vp)}${pctLabel}${jurosLabel}${vencLabel}`, LAYOUT.margin + 5, yPos);
        yPos += LAYOUT.lineHeight;
      });
      yPos += 4;
    };

    if (metodo === 'pix_boleto' && condicoes.parcelas_pix_boleto) {
      renderPixBoleto(condicoes.parcelas_pix_boleto, 'PIX / BOLETO');
    } else if (metodo === 'cartao_credito' && condicoes.cartoes) {
      renderCartoes(condicoes.cartoes, 'CARTÃO DE CRÉDITO');
    } else if (metodo === 'misto') {
      if (condicoes.misto_parcelas_pix_boleto?.length) {
        renderPixBoleto(condicoes.misto_parcelas_pix_boleto, 'PIX / BOLETO');
      }
      if (condicoes.misto_cartoes?.length) {
        yPos = checkPageBreak(doc, yPos, 30);
        renderCartoes(condicoes.misto_cartoes, 'CARTÃO DE CRÉDITO');
      }
    }
  } else {
    // === FORMATO LEGADO ===
    if (condicoes.valor_entrada !== undefined || condicoes.forma_pagamento_entrada) {
      doc.setFillColor(...COLORS.lightGray);
      doc.roundedRect(LAYOUT.margin, yPos - 4, pageWidth - 2 * LAYOUT.margin, 28, 2, 2, 'F');
      doc.setTextColor(...COLORS.darkGreen);
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setFont('helvetica', 'bold');
      doc.text('ENTRADA', LAYOUT.margin + 5, yPos + 2);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      if (condicoes.valor_entrada !== undefined) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textMedium);
        doc.text('Valor:', LAYOUT.margin + 5, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.darkGreen);
        doc.text(formatCurrency(condicoes.valor_entrada), LAYOUT.margin + labelWidth, yPos);
      }
      if (condicoes.forma_pagamento_entrada) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textMedium);
        doc.text('Forma:', pageWidth / 2, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        doc.text(getFormaPagamentoLabel(condicoes.forma_pagamento_entrada), pageWidth / 2 + 20, yPos);
      }
      yPos += LAYOUT.lineHeight;
      if (condicoes.descricao_entrada) {
        doc.setTextColor(...COLORS.textMedium);
        doc.setFont('helvetica', 'italic');
        doc.text(condicoes.descricao_entrada, LAYOUT.margin + 5, yPos);
      }
      yPos += 12;
    }

    if (condicoes.valor_termino !== undefined || condicoes.usa_valor_restante || condicoes.forma_pagamento_termino) {
      yPos = checkPageBreak(doc, yPos, 30);
      doc.setFillColor(...COLORS.lightGray);
      doc.roundedRect(LAYOUT.margin, yPos - 4, pageWidth - 2 * LAYOUT.margin, 28, 2, 2, 'F');
      doc.setTextColor(...COLORS.darkGreen);
      doc.setFontSize(LAYOUT.fontSize.body);
      doc.setFont('helvetica', 'bold');
      doc.text('NO TÉRMINO DA PRODUÇÃO', LAYOUT.margin + 5, yPos + 2);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textDark);
      let valorTermino = condicoes.valor_termino || 0;
      let labelValor = formatCurrency(valorTermino);
      if (condicoes.usa_valor_restante && condicoes.valor_entrada !== undefined) {
        valorTermino = Math.max(0, orcamento.valor_total - condicoes.valor_entrada);
        labelValor = `${formatCurrency(valorTermino)} (restante)`;
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.textMedium);
      doc.text('Valor:', LAYOUT.margin + 5, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.darkGreen);
      doc.text(labelValor, LAYOUT.margin + labelWidth, yPos);
      if (condicoes.forma_pagamento_termino) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textMedium);
        doc.text('Forma:', pageWidth / 2, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textDark);
        doc.text(getFormaPagamentoLabel(condicoes.forma_pagamento_termino), pageWidth / 2 + 20, yPos);
      }
      yPos += LAYOUT.lineHeight;
      if (condicoes.descricao_termino) {
        doc.setTextColor(...COLORS.textMedium);
        doc.setFont('helvetica', 'italic');
        doc.text(condicoes.descricao_termino, LAYOUT.margin + 5, yPos);
      }
      yPos += 12;
    }
  }

  return yPos + LAYOUT.sectionGap;
}

function renderFormaPagamento(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.forma_pagamento) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  
  yPos = renderSectionTitle(doc, 'Forma de Pagamento', yPos);
  
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textDark);
  
  const maxWidth = pageWidth - 2 * LAYOUT.margin;
  const lines = doc.splitTextToSize(orcamento.forma_pagamento, maxWidth);
  doc.text(lines, LAYOUT.margin, yPos);

  return yPos + (LAYOUT.lineHeight * lines.length) + LAYOUT.sectionGap;
}

function renderObservacoes(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  if (!orcamento.observacoes) {
    return yPos;
  }

  const pageWidth = getPageWidth(doc);
  
  yPos = renderSectionTitle(doc, 'Observações', yPos);
  
  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textDark);
  
  const maxWidth = pageWidth - 2 * LAYOUT.margin;
  const lines = doc.splitTextToSize(orcamento.observacoes, maxWidth);
  
  for (const line of lines) {
    yPos = checkPageBreak(doc, yPos, LAYOUT.lineHeight);
    doc.text(line, LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight;
  }

  return yPos + LAYOUT.sectionGap;
}

// Seção interna — só é renderizada no Projeto para Contrato (uso interno)
function renderIntermediador(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const interm = (orcamento as any).intermediador;
  if (!interm || !interm.nome) return yPos;

  yPos = renderSectionTitle(doc, 'Intermediador (uso interno)', yPos);

  doc.setFontSize(LAYOUT.fontSize.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textDark);

  const base = interm.tipo_base === 'recompra' ? 'Recompra' : 'Primeira compra';
  const linhas = [
    `Nome: ${interm.nome}`,
    `WhatsApp: ${interm.whatsapp || '—'}`,
    `Percentual aplicado: ${interm.percentual}% (${base})`,
    `Valor da comissão: ${formatCurrency(interm.valor_comissao || 0)}`,
  ];

  for (const linha of linhas) {
    yPos = checkPageBreak(doc, yPos, LAYOUT.lineHeight);
    doc.text(linha, LAYOUT.margin, yPos);
    yPos += LAYOUT.lineHeight;
  }

  return yPos + LAYOUT.sectionGap;
}

function renderFooter(doc: jsPDF, orcamento: Orcamento): void {
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageWidth = getPageWidth(doc);
    const footerY = PAGE_HEIGHT - 20;

    // Linha separadora
    doc.setDrawColor(...COLORS.lemonYellow);
    doc.setLineWidth(0.5);
    doc.line(LAYOUT.margin, footerY - 10, pageWidth - LAYOUT.margin, footerY - 10);

    // Validade
    doc.setTextColor(...COLORS.textMedium);
    doc.setFontSize(LAYOUT.fontSize.footer);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Este orçamento tem validade de ${orcamento.validade_dias} dias.`,
      LAYOUT.margin,
      footerY - 3
    );

    // Info da empresa
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.darkGreen);
    doc.text('LEMON CAPS', pageWidth - LAYOUT.margin, footerY - 3, { align: 'right' });
    
    doc.setTextColor(...COLORS.textLight);
    doc.setFontSize(8);
    doc.text('www.lemoncaps.com.br', pageWidth - LAYOUT.margin, footerY + 3, { align: 'right' });

    // Número da página
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      footerY + 3,
      { align: 'center' }
    );
  }
}

function renderStatusWatermark(doc: jsPDF, orcamento: Orcamento): void {
  if (orcamento.status === 'rascunho') {
    return;
  }

  const totalPages = doc.getNumberOfPages();
  const pageWidth = getPageWidth(doc);

  const statusLabels: Record<string, string> = {
    enviado: 'ENVIADO',
    pago: 'PAGO',
    recusado: 'RECUSADO',
  };
  
  const statusColors: Record<string, [number, number, number]> = {
    enviado: [59, 130, 246],
    pago: [34, 197, 94],
    recusado: [239, 68, 68],
  };

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
    doc.setTextColor(...(statusColors[orcamento.status] || COLORS.textLight));
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    
    doc.text(
      statusLabels[orcamento.status] || orcamento.status.toUpperCase(),
      pageWidth / 2,
      PAGE_HEIGHT / 2,
      { align: 'center', angle: 45 }
    );
    doc.restoreGraphicsState();
  }
}

// ========== FUNÇÃO PRINCIPAL ==========

interface OrcamentoPDFOptions {
  /** Inclui a seção interna de Intermediador (Projeto para Contrato). Nunca no PDF do cliente. */
  incluirIntermediador?: boolean;
  /** Nome do arquivo salvo. Sem isso, usa o padrão do Projeto para Contrato. */
  nomeArquivo?: string;
}

async function createOrcamentoPDF(orcamento: Orcamento, options: OrcamentoPDFOptions = {}): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  console.log(`[PDF] Gerando orçamento: ${orcamento.numero_orcamento} - Modo: Premium expandido`);

  try {
    // Busca cotação de frete vinculada (Estoque Próprio ou POD) — opcional
    try {
      const cots = await fetchFreteCotacoesByOrcamento(orcamento.id);
      (orcamento as any).__freteCotacoes = cots;
      (orcamento as any).__freteCotacao = cots[0] || null;
    } catch (e) {
      console.warn('[PDF] Não foi possível carregar cotação de frete', e);
    }

    // Renderizar seções em ordem
    let yPos = renderHeader(doc, orcamento);
    yPos = renderConsultor(doc, orcamento, yPos);
    yPos = renderDadosCliente(doc, orcamento, yPos);
    yPos = renderProdutos(doc, orcamento, yPos);
    yPos = renderServicos(doc, orcamento, yPos);
    yPos = renderFrete(doc, orcamento, yPos);
    yPos = renderTotal(doc, orcamento, yPos);
    yPos = renderCondicoesPagamento(doc, orcamento, yPos);
    yPos = renderFormaPagamento(doc, orcamento, yPos);
    yPos = renderObservacoes(doc, orcamento, yPos);
    if (options.incluirIntermediador) {
      yPos = renderIntermediador(doc, orcamento, yPos);
    }

    // Footer e marca d'água em todas as páginas
    renderFooter(doc, orcamento);
    renderStatusWatermark(doc, orcamento);
    
    console.log(`[PDF] Orçamento gerado com ${doc.getNumberOfPages()} página(s)`);
  } catch (error) {
    console.error('Erro ao criar PDF:', error);
    // Fallback mínimo
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('LEMON CAPS - Orçamento Comercial', 20, 30);
    doc.setFontSize(12);
    doc.text(`Nº: ${orcamento.numero_orcamento}`, 20, 45);
    doc.text(`Cliente: ${orcamento.nome_cliente}`, 20, 55);
    doc.text(`Total: ${formatCurrency(orcamento.valor_total)}`, 20, 65);
  }

  return doc;
}

// ========== EXPORTS ==========

export async function generateOrcamentoPDFBlob(orcamento: Orcamento, options: OrcamentoPDFOptions = {}): Promise<Blob> {
  const doc = await createOrcamentoPDF(orcamento, options);
  return doc.output('blob');
}

export async function generateOrcamentoPDF(orcamento: Orcamento, options: OrcamentoPDFOptions = {}): Promise<void> {
  const doc = await createOrcamentoPDF(orcamento, options);
  
  // [Cliente]_[Contrato]_[Data]_[Hora] -- a data e a hora sao as do download,
  // para distinguir duas versoes baixadas no mesmo dia.
  doc.save(options.nomeArquivo || nomeArquivoDocumento(orcamento.nome_cliente, 'Contrato'));
}
