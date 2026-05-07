import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarCondicoesPagamento } from './formatarPagamento';

interface PedidoReport {
  id?: string;
  numero_pedido: string;
  orcamento_snapshot?: any;
  formula_snapshot?: any;
  data_pedido: string | Date;
  observacoes?: string | null;
  acompanhamento_processos?: any;
}

const ACOMP_STATUS_LABELS: Record<string, string> = {
  pendente: '⏳ Pendente',
  entregue: '✅ Entregue',
  nao_necessario: '— Não Necessário',
};

const acompStatusLabel = (v?: string) => (v ? ACOMP_STATUS_LABELS[v] || v : '-');

export interface RelatorioFiltros {
  dataInicio?: Date;
  dataFim?: Date;
  consultor?: string;
  status?: string;
}

const TIPO_PRODUTO_LABELS: Record<string, string> = {
  encapsulado: 'Encapsulado',
  soluvel: 'Solúvel',
  liquido_gotas: 'Líquido (Gotas)',
  liquido_spray: 'Líquido (Spray)',
  gummy: 'Gummy',
};

const STATUS_LABELS: Record<string, string> = {
  aguardando_producao: 'Aguardando Produção',
  no_estoque: 'No Estoque',
  enviado: 'Enviado',
  concluido: 'Concluído',
};

const tipoProdutoLabel = (raw?: string) => (raw ? TIPO_PRODUTO_LABELS[raw] || raw : '-');

const modeloCompraLabel = (item: any): string => {
  if (item?.modelo_negocio === 'print_on_demand') return 'Print on Demand';
  if (item?.modelo_negocio === 'estoque') return 'Estoque';
  return item?.modelo_negocio || 'Estoque';
};

const formatarFrete = (frete: any): string => {
  if (!frete || (!frete.detalhamento_envio && frete.frete_lemon_caps == null)) return '';
  const partes: string[] = [];
  const tipo = frete.detalhamento_envio?.tipo;
  if (tipo === 'total_produtor') partes.push('Logística: Todo para o Produtor');
  else if (tipo === 'total_lemoncaps') partes.push('Logística: Via Lemon Caps');
  else if (tipo === 'parcial') partes.push('Logística: Parcial');
  if (frete.detalhamento_envio?.descricao_parcial) partes.push(frete.detalhamento_envio.descricao_parcial);
  if (frete.frete_lemon_caps != null) partes.push(`Frete Lemon Caps: ${frete.frete_lemon_caps ? 'Sim' : 'Não'}`);
  return partes.join(' | ');
};

const extractData = (pedido: PedidoReport) => {
  const snap = pedido.orcamento_snapshot;
  if (!snap) return null;
  const dadosCliente = snap.dados_cliente || {};
  const itens = (snap.itens_producao || []) as any[];
  const itensEnriquecidos = itens.map((item: any) => {
    const tipoRaw =
      item.formula_snapshot?.tipo_produto ||
      item.tipo_produto ||
      pedido.formula_snapshot?.tipo_produto;
    const isPOD = item.modelo_negocio === 'print_on_demand';
    const qtd = isPOD ? 0 : (item.quantidade || 0);
    const subtotal = item.subtotal || 0;
    const precoUnit = qtd > 0 ? subtotal / qtd : 0;
    return {
      nomeProduto: item.nome_produto || '',
      tipoProduto: tipoProdutoLabel(tipoRaw),
      modeloCompra: modeloCompraLabel(item),
      quantidade: isPOD ? 'POD' : qtd,
      precoUnitario: precoUnit,
      subtotal,
    };
  });

  return {
    id: pedido.id || '',
    numeroPedido: pedido.numero_pedido,
    numeroOrcamento: snap.numero_orcamento || '',
    dataPedido: pedido.data_pedido,
    dataPagamento: snap.data_pagamento || null,
    consultor: snap.consultor_responsavel || '',
    nomeCliente: dadosCliente.nome_completo || snap.nome_cliente || '',
    cnpj: dadosCliente.cnpj || '',
    email: dadosCliente.email || '',
    telefone: dadosCliente.telefone || '',
    cidadeEstado:
      dadosCliente.cidade && dadosCliente.estado
        ? `${dadosCliente.cidade}/${dadosCliente.estado}`
        : dadosCliente.cidade || '',
    tipoOrcamento: snap.tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor',
    itens: itensEnriquecidos,
    servicos: (snap.servicos_marca || []) as any[],
    subtotalSetup: snap.subtotal_servicos || 0,
    subtotalProducao: snap.subtotal_producao || 0,
    valorTotal: snap.valor_total || 0,
    condicoesPagamento: snap.condicoes_pagamento || null,
    frete: formatarFrete(snap.detalhamento_frete),
    observacoes: pedido.observacoes || '',
    acompanhamento: pedido.acompanhamento_processos || null,
  };
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | Date | null | undefined) =>
  d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '';

// ===== PDF =====

const addPedidoToPDF = (doc: jsPDF, data: ReturnType<typeof extractData>, startY: number): number => {
  if (!data) return startY;
  let y = startY;
  const ensure = (lines = 1) => {
    if (y + lines * 5 > 280) { doc.addPage(); y = 20; }
  };

  ensure(2);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedido: ${data.numeroPedido}`, 14, y); y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Orçamento: ${data.numeroOrcamento} (${data.tipoOrcamento})`, 14, y); y += 5;
  doc.text(`Data do Pedido: ${fmtDate(data.dataPedido)}`, 14, y);
  doc.text(`Data de Pagamento: ${data.dataPagamento ? fmtDate(data.dataPagamento) : '-'}`, 110, y);
  y += 6;

  // Dados do Cliente
  doc.setFont('helvetica', 'bold');
  doc.text('Dados do Cliente', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Consultor: ${data.consultor || '-'}`, 14, y); y += 4;
  doc.text(`Cliente: ${data.nomeCliente || '-'}`, 14, y); y += 4;
  if (data.cnpj) { doc.text(`CNPJ: ${data.cnpj}`, 14, y); y += 4; }
  if (data.email) { doc.text(`Email: ${data.email}`, 14, y); y += 4; }
  if (data.telefone) { doc.text(`Telefone: ${data.telefone}`, 14, y); y += 4; }
  if (data.cidadeEstado) { doc.text(`Cidade/Estado: ${data.cidadeEstado}`, 14, y); y += 4; }
  y += 2;

  // Produtos
  if (data.itens.length > 0) {
    ensure(4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Produtos', 14, y); y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Produto', 'Tipo', 'Modelo', 'Qtd', 'Preço Unit.', 'Subtotal']],
      body: data.itens.map((i) => [
        i.nomeProduto,
        i.tipoProduto,
        i.modeloCompra,
        String(i.quantidade),
        fmt(i.precoUnitario),
        fmt(i.subtotal),
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Serviços de marca
  if (data.servicos.length > 0) {
    ensure(4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Serviços de Criação de Marca', 14, y); y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Serviço', 'Valor']],
      body: data.servicos.map((s: any) => [s.nome_plano || '', fmt(s.valor || 0)]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Resumo Financeiro
  ensure(5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Resumo Financeiro', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.subtotalSetup > 0) { doc.text(`Orç. Setup (Serviços de Marca): ${fmt(data.subtotalSetup)}`, 14, y); y += 4; }
  if (data.subtotalProducao > 0) { doc.text(`Orç. Produção: ${fmt(data.subtotalProducao)}`, 14, y); y += 4; }
  doc.setFont('helvetica', 'bold');
  doc.text(`Orç. Total: ${fmt(data.valorTotal)}`, 14, y); y += 6;

  // Condições de Pagamento
  if (data.condicoesPagamento) {
    const linhas = formatarCondicoesPagamento(data.condicoesPagamento, data.valorTotal);
    if (linhas.length > 0) {
      ensure(2);
      doc.setFont('helvetica', 'bold');
      doc.text('Condições de Pagamento', 14, y); y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      linhas.forEach(l => { ensure(); doc.text(l, 16, y); y += 4; });
      y += 2;
    }
  }

  // Frete
  if (data.frete) {
    ensure(2);
    doc.setFont('helvetica', 'bold');
    doc.text('Logística / Frete', 14, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const freteLines = doc.splitTextToSize(data.frete, 180);
    freteLines.forEach((l: string) => { ensure(); doc.text(l, 16, y); y += 4; });
    y += 2;
  }

  // Acompanhamento de Processos
  if (data.acompanhamento) {
    ensure(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Acompanhamento de Processos', 14, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const a = data.acompanhamento;
    const linhasAcomp = [
      `Criação de Marca: ${acompStatusLabel(a.criacao_marca)}`,
      `Produção: ${acompStatusLabel(a.producao)}`,
      `Integração Logística: ${acompStatusLabel(a.integracao_logistica)}`,
      `Página de Venda: ${acompStatusLabel(a.pagina_venda)}`,
      `Envio do Produto: ${acompStatusLabel(a.envio_produto)}`,
    ];
    linhasAcomp.forEach(l => { ensure(); doc.text(l, 16, y); y += 4; });
    if (a.satisfacao_nota != null) {
      ensure();
      const satTxt = `Satisfação: ${a.satisfacao_nota}/10${a.satisfacao_observacoes ? ` — ${a.satisfacao_observacoes}` : ''}`;
      const satLines = doc.splitTextToSize(satTxt, 180);
      satLines.forEach((l: string) => { ensure(); doc.text(l, 16, y); y += 4; });
    }
    y += 2;
  }

  // Observações
  if (data.observacoes) {
    ensure(2);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', 14, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(data.observacoes, 180);
    obsLines.forEach((l: string) => { ensure(); doc.text(l, 16, y); y += 4; });
    y += 2;
  }

  return y + 2;
};

const buildFiltrosLinhas = (filtros?: RelatorioFiltros): string[] => {
  if (!filtros) return [];
  const linhas: string[] = [];
  if (filtros.dataInicio || filtros.dataFim) {
    const ini = filtros.dataInicio ? fmtDate(filtros.dataInicio) : '...';
    const fim = filtros.dataFim ? fmtDate(filtros.dataFim) : '...';
    linhas.push(`Período (Data de Pagamento): ${ini} a ${fim}`);
  }
  if (filtros.consultor) linhas.push(`Consultor: ${filtros.consultor}`);
  if (filtros.status) linhas.push(`Status: ${STATUS_LABELS[filtros.status] || filtros.status}`);
  return linhas;
};

const buildFilenameSuffix = (filtros?: RelatorioFiltros): string => {
  if (!filtros) return '';
  const parts: string[] = [];
  if (filtros.dataInicio) parts.push(format(filtros.dataInicio, 'yyyy-MM-dd'));
  if (filtros.dataFim) parts.push(`a_${format(filtros.dataFim, 'yyyy-MM-dd')}`);
  return parts.length > 0 ? `_${parts.join('_')}` : '';
};

export const gerarRelatorioPedidoPDF = (pedido: PedidoReport) => {
  const data = extractData(pedido);
  if (!data) return;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório de Pedido', 14, 20);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 26);
  addPedidoToPDF(doc, data, 35);
  doc.save(`Relatorio_${data.numeroPedido}.pdf`);
};

export const gerarRelatorioPedidosGeralPDF = (pedidos: PedidoReport[], filtros?: RelatorioFiltros) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório Geral de Pedidos', 14, 20);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 26);
  doc.text(`Total de pedidos: ${pedidos.length}`, 14, 31);

  let y = 36;
  buildFiltrosLinhas(filtros).forEach(l => {
    doc.text(l, 14, y); y += 4;
  });
  y += 4;

  pedidos.forEach((pedido, idx) => {
    const data = extractData(pedido);
    if (!data) return;
    if (y > 240) { doc.addPage(); y = 20; }
    y = addPedidoToPDF(doc, data, y);
    if (idx < pedidos.length - 1) {
      doc.setDrawColor(200); doc.line(14, y - 2, 196, y - 2);
      y += 2;
    }
  });

  doc.save(`Relatorio_Pedidos_Geral${buildFilenameSuffix(filtros)}.pdf`);
};

// ===== EXCEL =====

const headers = [
  'Nº Pedido',
  'Cliente',
  'CNPJ',
  'Consultor Responsável',
  'Tipo',
  'Modalidade',
  'Produto',
  'Quantidade',
  'Preço Unitário',
  'Valor Total Produção',
  'Valor Total Setup',
  'Custo Total Pedido',
  'Abrir Pedido',
];

const COL = {
  numero: 0, cliente: 1, cnpj: 2, consultor: 3, tipo: 4,
  modalidade: 5, produto: 6, qtd: 7, precoUnit: 8,
  totalProducao: 9, totalSetup: 10, custoTotal: 11, link: 12,
};
const MONEY_COLS = [COL.precoUnit, COL.totalProducao, COL.totalSetup, COL.custoTotal];
const BRL_FMT = 'R$ #,##0.00;[Red]-R$ #,##0.00';

type BuiltRow = {
  cells: any[];
  level: 0 | 1; // 0 = resumo do pedido, 1 = produto (filho)
  link?: string;
};

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
};

const buildRows = (pedidos: PedidoReport[]) => {
  const rows: BuiltRow[] = [];
  let totProducao = 0;
  let totSetup = 0;
  let totGeral = 0;
  const baseUrl = getBaseUrl();

  pedidos.forEach(pedido => {
    const data = extractData(pedido);
    if (!data) return;
    const custoTotalPedido = (data.subtotalProducao || 0) + (data.subtotalSetup || 0);
    totProducao += data.subtotalProducao || 0;
    totSetup += data.subtotalSetup || 0;
    totGeral += custoTotalPedido;

    const link = data.id ? `${baseUrl}/pedidos?pedido=${data.id}` : '';

    // Linha-resumo do pedido (nível 0)
    const resumo: any[] = new Array(headers.length).fill('');
    resumo[COL.numero] = data.numeroPedido;
    resumo[COL.cliente] = data.nomeCliente;
    resumo[COL.cnpj] = data.cnpj;
    resumo[COL.consultor] = data.consultor;
    resumo[COL.tipo] = data.tipoOrcamento;
    resumo[COL.totalProducao] = data.subtotalProducao || 0;
    resumo[COL.totalSetup] = data.subtotalSetup || 0;
    resumo[COL.custoTotal] = custoTotalPedido;
    resumo[COL.link] = link ? 'Abrir' : '';
    rows.push({ cells: resumo, level: 0, link });

    // Linhas filhas com produtos (nível 1)
    data.itens.forEach(item => {
      const r: any[] = new Array(headers.length).fill('');
      r[COL.produto] = `   ↳ ${item.nomeProduto}`;
      r[COL.modalidade] = item.modeloCompra;
      r[COL.qtd] = item.quantidade;
      r[COL.precoUnit] = item.precoUnitario;
      r[COL.totalProducao] = item.subtotal;
      rows.push({ cells: r, level: 1 });
    });
  });

  return { rows, totals: { totProducao, totSetup, totGeral } };
};

const buildSheetWithFiltros = (
  built: ReturnType<typeof buildRows>,
  filtros?: RelatorioFiltros,
  totalPedidos?: number,
) => {
  const filtroLinhas = buildFiltrosLinhas(filtros);
  const aoa: any[][] = [];
  aoa.push(['Relatório de Pedidos']);
  filtroLinhas.forEach(l => aoa.push([l]));
  if (totalPedidos != null) aoa.push([`Total de pedidos: ${totalPedidos}`]);
  aoa.push([`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`]);
  aoa.push([]);
  const headerRowIdx = aoa.length; // 0-based
  aoa.push(headers);
  built.rows.forEach(r => aoa.push(r.cells));
  // TOTAL GERAL
  const totalRow: any[] = new Array(headers.length).fill('');
  totalRow[COL.numero] = 'TOTAL GERAL';
  totalRow[COL.totalProducao] = built.totals.totProducao;
  totalRow[COL.totalSetup] = built.totals.totSetup;
  totalRow[COL.custoTotal] = built.totals.totGeral;
  aoa.push([]);
  const totalRowIdx = aoa.length;
  aoa.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
    { wch: 18 }, { wch: 36 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 20 }, { wch: 14 },
  ];

  // Outline (agrupamento) — produtos colapsáveis sob a linha-resumo
  const wsRows: any[] = [];
  built.rows.forEach((r, i) => {
    const sheetRowIdx = headerRowIdx + 1 + i;
    if (r.level === 1) {
      wsRows[sheetRowIdx] = { level: 1 };
    }
    // Hyperlink na coluna "Abrir Pedido" da linha-resumo
    if (r.level === 0 && r.link) {
      const addr = XLSX.utils.encode_cell({ r: sheetRowIdx, c: COL.link });
      const cell = ws[addr];
      if (cell) {
        cell.l = { Target: r.link, Tooltip: 'Abrir pedido na aplicação' };
      }
    }
  });
  ws['!rows'] = wsRows;
  ws['!outline'] = { above: false, left: false } as any;

  // Formato BRL nas colunas monetárias
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = headerRowIdx + 1; R <= range.e.r; R++) {
    MONEY_COLS.forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = BRL_FMT;
      }
    });
  }

  // Freeze do cabeçalho
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 } as any;

  return ws;
};

export const gerarRelatorioPedidoExcel = (pedido: PedidoReport) => {
  const built = buildRows([pedido]);
  const ws = buildSheetWithFiltros(built, undefined, 1);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  const data = extractData(pedido);
  XLSX.writeFile(wb, `Relatorio_${data?.numeroPedido || 'pedido'}.xlsx`);
};

export const gerarRelatorioPedidosGeralExcel = (pedidos: PedidoReport[], filtros?: RelatorioFiltros) => {
  const built = buildRows(pedidos);
  const ws = buildSheetWithFiltros(built, filtros, pedidos.length);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, `Relatorio_Pedidos_Geral${buildFilenameSuffix(filtros)}.xlsx`);
};
