import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarCondicoesPagamento } from './formatarPagamento';
import { derivarRecebimentos, Recebimento } from './recebimentos';
import { derivarComissoes, ItemComissao } from './comissoes';
import { Pedido } from '@/types/formula';

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
    servicos: ((snap.servicos_marca || []) as any[]).filter(
      (s: any) => s?.setup_detalhes?.perfil !== 'revenda_lemon'
    ),
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
  'Método Principal',
  'Nº de Parcelas',
  'Data 1ª Parcela',
  'Data Última Parcela',
  'Data Pagamento (aprovação)',
  'Valor Bruto (com juros)',
  'Valor Líquido (base comissão)',
  'Já Recebido',
  'A Receber',
  'Status Pagamento',
];

const COL = {
  numero: 0, cliente: 1, cnpj: 2, consultor: 3, tipo: 4,
  modalidade: 5, produto: 6, qtd: 7, precoUnit: 8,
  totalProducao: 9, totalSetup: 10, custoTotal: 11, link: 12,
  metodo: 13, numParcelas: 14, dataPrim: 15, dataUlt: 16,
  dataAprov: 17, valorBruto: 18, valorLiquido: 19,
  jaRecebido: 20, aReceber: 21, statusPagto: 22,
};
const MONEY_COLS = [
  COL.precoUnit, COL.totalProducao, COL.totalSetup, COL.custoTotal,
  COL.valorBruto, COL.valorLiquido, COL.jaRecebido, COL.aReceber,
];
const DATE_COLS = [COL.dataPrim, COL.dataUlt, COL.dataAprov];
const BRL_FMT = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const DATE_FMT = 'dd/mm/yyyy';

// ===== Helpers de pagamento =====

const METODO_LABELS: Record<string, string> = {
  pix_boleto: 'Pix / Boleto',
  cartao_credito: 'Cartão de Crédito',
  misto: 'Misto (Pix/Boleto + Cartão)',
};
const metodoLabel = (metodoPrincipal?: string): string =>
  metodoPrincipal ? (METODO_LABELS[metodoPrincipal] || metodoPrincipal) : 'Pagamento único';

const STATUS_PARCELA_LABELS: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  vencido: 'Vencido',
  sem_data: 'Sem data',
  futuro: 'Futuro',
};

const parseISO = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const monthKey = (s: string | null | undefined): string => {
  const d = parseISO(s);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
};

interface PagamentoResumo {
  metodo: string;
  numParcelas: number;
  dataPrim: Date | null;
  dataUlt: Date | null;
  dataAprov: Date | null;
  valorBruto: number;
  valorLiquido: number;
  jaRecebido: number;
  aReceber: number;
  statusPagto: string;
  recebimentos: Recebimento[];
  comissoes: ItemComissao[];
}

const buildPagamentoResumo = (pedido: PedidoReport): PagamentoResumo => {
  const snap: any = pedido.orcamento_snapshot || {};
  const cond: any = snap.condicoes_pagamento;
  const rec = derivarRecebimentos(pedido as unknown as Pedido);
  const com = derivarComissoes(pedido as unknown as Pedido);

  const datasVenc = rec.map(r => parseISO(r.data)).filter((d): d is Date => !!d);
  datasVenc.sort((a, b) => a.getTime() - b.getTime());

  const valorBruto = rec.reduce((s, r) => s + (r.valor || 0), 0);
  const valorLiquido = com.reduce((s, c) => s + (c.valorLiquido || 0), 0);
  const jaRecebido = rec.reduce((s, r) => s + (r.status === 'pago' ? r.valor : 0), 0);
  const aReceber = Math.max(0, valorBruto - jaRecebido);

  const pagos = rec.filter(r => r.status === 'pago').length;
  const statusPagto =
    rec.length === 0 ? '-' :
    pagos === 0 ? 'Em aberto' :
    pagos >= rec.length ? 'Quitado' : 'Parcial';

  return {
    metodo: metodoLabel(cond?.metodo_principal),
    numParcelas: rec.length,
    dataPrim: datasVenc[0] || null,
    dataUlt: datasVenc[datasVenc.length - 1] || null,
    dataAprov: parseISO(snap.data_pagamento || null),
    valorBruto, valorLiquido, jaRecebido, aReceber, statusPagto,
    recebimentos: rec, comissoes: com,
  };
};

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

    const pg = buildPagamentoResumo(pedido);
    resumo[COL.metodo] = pg.metodo;
    resumo[COL.numParcelas] = pg.numParcelas || '';
    resumo[COL.dataPrim] = pg.dataPrim || '';
    resumo[COL.dataUlt] = pg.dataUlt || '';
    resumo[COL.dataAprov] = pg.dataAprov || '';
    resumo[COL.valorBruto] = pg.valorBruto || 0;
    resumo[COL.valorLiquido] = pg.valorLiquido || 0;
    resumo[COL.jaRecebido] = pg.jaRecebido || 0;
    resumo[COL.aReceber] = pg.aReceber || 0;
    resumo[COL.statusPagto] = pg.statusPagto;

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
    { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
    { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
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
    DATE_COLS.forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && cell.v instanceof Date) {
        cell.t = 'd';
        cell.z = DATE_FMT;
      }
    });
  }

  // Freeze do cabeçalho
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 } as any;

  // AutoFilter no cabeçalho
  const lastCol = XLSX.utils.encode_col(headers.length - 1);
  const firstDataRow = headerRowIdx + 1;
  const lastRow = range.e.r + 1;
  ws['!autofilter'] = { ref: `A${firstDataRow}:${lastCol}${lastRow}` } as any;

  return ws;
};

// ===== Aba: Parcelas =====

const PARCELAS_HEADERS = [
  'Nº Pedido', 'Cliente', 'CNPJ/CPF', 'Consultor', 'Tipo', 'Método',
  'Descrição da Parcela', 'Parcela nº', 'Total de Parcelas',
  'Data Vencimento', 'Mês/Ano Vencimento', 'Data Pagamento', 'Mês/Ano Pagamento',
  'Status', 'Valor Bruto', 'Valor Líquido', '% Comissão',
  'Comissão da Parcela', 'Comissão Devida (pago)',
];

interface ParcelaRow {
  numeroPedido: string; cliente: string; doc: string; consultor: string;
  tipo: string; metodo: string; descricao: string; parcelaNum: number; total: number;
  dataVenc: Date | null; mesVenc: string; dataPag: Date | null; mesPag: string;
  status: string; valorBruto: number; valorLiquido: number;
  percentual: number; comissao: number; comissaoDevida: number;
}

const buildParcelasRows = (pedidos: PedidoReport[]): ParcelaRow[] => {
  const out: ParcelaRow[] = [];
  pedidos.forEach(pedido => {
    const data = extractData(pedido);
    if (!data) return;
    const pg = buildPagamentoResumo(pedido);
    const total = pg.recebimentos.length;
    pg.recebimentos.forEach((r, idx) => {
      const c = pg.comissoes.find(cc => cc.parcelaIndice === r.indice) || pg.comissoes[idx];
      const pago = r.status === 'pago';
      out.push({
        numeroPedido: data.numeroPedido,
        cliente: data.nomeCliente,
        doc: data.cnpj || (c?.clienteDoc || ''),
        consultor: data.consultor,
        tipo: data.tipoOrcamento,
        metodo: pg.metodo,
        descricao: r.descricao,
        parcelaNum: idx + 1,
        total,
        dataVenc: parseISO(r.data),
        mesVenc: monthKey(r.data),
        dataPag: pago ? parseISO(c?.dataPagamento || r.data) : null,
        mesPag: pago ? monthKey(c?.dataPagamento || r.data) : '',
        status: STATUS_PARCELA_LABELS[r.status] || r.status,
        valorBruto: r.valor,
        valorLiquido: c?.valorLiquido || 0,
        percentual: c?.percentual || 0,
        comissao: c?.comissao || 0,
        comissaoDevida: pago ? (c?.comissao || 0) : 0,
      });
    });
  });
  return out;
};

const buildParcelasSheet = (pedidos: PedidoReport[]): XLSX.WorkSheet => {
  const rows = buildParcelasRows(pedidos);
  const aoa: any[][] = [PARCELAS_HEADERS];
  rows.forEach(r => {
    aoa.push([
      r.numeroPedido, r.cliente, r.doc, r.consultor, r.tipo, r.metodo,
      r.descricao, r.parcelaNum, r.total,
      r.dataVenc || '', r.mesVenc, r.dataPag || '', r.mesPag,
      r.status, r.valorBruto, r.valorLiquido,
      r.percentual, r.comissao, r.comissaoDevida,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 26 },
    { wch: 36 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 20 },
  ];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const moneyCols = [14, 15, 17, 18];
  const dateCols = [9, 11];
  const pctCols = [16];
  for (let R = 1; R <= range.e.r; R++) {
    moneyCols.forEach(C => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = BRL_FMT; }
    });
    dateCols.forEach(C => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v instanceof Date) { cell.t = 'd'; cell.z = DATE_FMT; }
    });
    pctCols.forEach(C => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = '0.00%'; }
    });
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  const lastCol = XLSX.utils.encode_col(PARCELAS_HEADERS.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastCol}${range.e.r + 1}` } as any;
  return ws;
};

// ===== Aba: Entradas por Mês =====

const buildEntradasMesSheet = (pedidos: PedidoReport[]): XLSX.WorkSheet => {
  const parcelas = buildParcelasRows(pedidos);
  // Agrupamento: chave = mes + status + metodo
  const map = new Map<string, { mes: string; status: string; metodo: string; qtd: number; bruto: number; liquido: number }>();
  parcelas.forEach(p => {
    const isRec = p.status === 'Pago';
    const mes = isRec ? p.mesPag : p.mesVenc;
    if (!mes) return;
    const status = isRec ? 'Recebido' : 'Pendente';
    const key = `${mes}||${status}||${p.metodo}`;
    const cur = map.get(key) || { mes, status, metodo: p.metodo, qtd: 0, bruto: 0, liquido: 0 };
    cur.qtd += 1;
    cur.bruto += p.valorBruto;
    cur.liquido += p.valorLiquido;
    map.set(key, cur);
  });
  const rows = Array.from(map.values()).sort((a, b) =>
    a.mes.localeCompare(b.mes) || a.status.localeCompare(b.status) || a.metodo.localeCompare(b.metodo)
  );
  const headers2 = ['Mês/Ano', 'Status', 'Método', 'Nº Parcelas', 'Valor Bruto', 'Valor Líquido'];
  const aoa: any[][] = [headers2];
  rows.forEach(r => aoa.push([r.mes, r.status, r.metodo, r.qtd, r.bruto, r.liquido]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    [4, 5].forEach(C => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = BRL_FMT; }
    });
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  const lastCol = XLSX.utils.encode_col(headers2.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastCol}${range.e.r + 1}` } as any;
  return ws;
};

// ===== Aba: Comissões por Consultor / Mês =====

const buildComissoesMesSheet = (pedidos: PedidoReport[]): XLSX.WorkSheet => {
  const parcelas = buildParcelasRows(pedidos).filter(p => p.status === 'Pago');
  const map = new Map<string, { consultor: string; mes: string; qtd: number; liquido: number; nova: number; recompra: number; total: number }>();
  parcelas.forEach(p => {
    const consultor = p.consultor || '— Sem consultor —';
    const key = `${consultor}||${p.mesPag}`;
    const cur = map.get(key) || { consultor, mes: p.mesPag, qtd: 0, liquido: 0, nova: 0, recompra: 0, total: 0 };
    cur.qtd += 1;
    cur.liquido += p.valorLiquido;
    if (p.tipo === 'Recompra') cur.recompra += p.comissao;
    else cur.nova += p.comissao;
    cur.total += p.comissao;
    map.set(key, cur);
  });
  const rows = Array.from(map.values()).sort((a, b) =>
    a.consultor.localeCompare(b.consultor) || a.mes.localeCompare(b.mes)
  );
  const headers2 = ['Consultor', 'Mês/Ano Pagamento', 'Nº Parcelas Pagas', 'Valor Líquido Recebido', 'Comissão Nova Venda (5%)', 'Comissão Recompra (1%)', 'Comissão Total'];
  const aoa: any[][] = [headers2];
  rows.forEach(r => aoa.push([r.consultor, r.mes, r.qtd, r.liquido, r.nova, r.recompra, r.total]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    [3, 4, 5, 6].forEach(C => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = BRL_FMT; }
    });
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  const lastCol = XLSX.utils.encode_col(headers2.length - 1);
  ws['!autofilter'] = { ref: `A1:${lastCol}${range.e.r + 1}` } as any;
  return ws;
};

// ===== Aba: Detalhamento por Pedido =====

const buildDetalhamentoSheet = (pedidos: PedidoReport[]): XLSX.WorkSheet => {
  const aoa: any[][] = [];
  const merges: XLSX.Range[] = [];
  const boldRows: number[] = [];

  const push = (row: any[]) => { aoa.push(row); return aoa.length - 1; };
  const pushBold = (row: any[]) => { const i = push(row); boldRows.push(i); return i; };

  pedidos.forEach((pedido, idx) => {
    const data = extractData(pedido);
    if (!data) return;
    const pg = buildPagamentoResumo(pedido);

    if (idx > 0) push([]);
    const titleIdx = pushBold([`PEDIDO ${data.numeroPedido}`]);
    merges.push({ s: { r: titleIdx, c: 0 }, e: { r: titleIdx, c: 6 } });

    push(['Orçamento', data.numeroOrcamento, '', 'Tipo', data.tipoOrcamento]);
    push(['Data Pedido', fmtDate(data.dataPedido), '', 'Data Pagamento', data.dataPagamento ? fmtDate(data.dataPagamento) : '-']);
    push(['Consultor', data.consultor || '-']);
    push([]);
    pushBold(['Cliente']);
    push(['Nome', data.nomeCliente]);
    if (data.cnpj) push(['CNPJ/CPF', data.cnpj]);
    if (data.email) push(['Email', data.email]);
    if (data.telefone) push(['Telefone', data.telefone]);
    if (data.cidadeEstado) push(['Cidade/UF', data.cidadeEstado]);

    if (data.itens.length > 0) {
      push([]);
      pushBold(['Produtos']);
      push(['Produto', 'Tipo', 'Modelo', 'Qtd', 'Preço Unit.', 'Subtotal']);
      data.itens.forEach(i => push([i.nomeProduto, i.tipoProduto, i.modeloCompra, i.quantidade, i.precoUnitario, i.subtotal]));
    }

    if (data.servicos.length > 0) {
      push([]);
      pushBold(['Serviços de Marca']);
      push(['Serviço', 'Valor']);
      data.servicos.forEach((s: any) => push([s.nome_plano || '', s.valor || 0]));
    }

    push([]);
    pushBold(['Resumo Financeiro']);
    if (data.subtotalSetup > 0) push(['Orç. Setup (Serviços de Marca)', data.subtotalSetup]);
    if (data.subtotalProducao > 0) push(['Orç. Produção', data.subtotalProducao]);
    push(['Orç. Total', data.valorTotal]);
    push(['Valor Bruto (com juros)', pg.valorBruto]);
    push(['Valor Líquido (base comissão)', pg.valorLiquido]);
    push(['Já Recebido', pg.jaRecebido]);
    push(['A Receber', pg.aReceber]);
    push(['Status Pagamento', pg.statusPagto]);
    push(['Método', pg.metodo]);

    if (pg.recebimentos.length > 0) {
      push([]);
      pushBold(['Parcelas / Recebimentos']);
      push(['Descrição', 'Vencimento', 'Data Pagamento', 'Status', 'Valor Bruto', 'Valor Líquido', 'Comissão']);
      pg.recebimentos.forEach((r, i) => {
        const c = pg.comissoes.find(cc => cc.parcelaIndice === r.indice) || pg.comissoes[i];
        push([
          r.descricao,
          parseISO(r.data) || '',
          r.status === 'pago' ? (parseISO(c?.dataPagamento || r.data) || '') : '',
          STATUS_PARCELA_LABELS[r.status] || r.status,
          r.valor,
          c?.valorLiquido || 0,
          c?.comissao || 0,
        ]);
      });
    }

    if (data.frete) { push([]); pushBold(['Logística / Frete']); push([data.frete]); }

    if (data.acompanhamento) {
      const a = data.acompanhamento;
      push([]);
      pushBold(['Acompanhamento de Processos']);
      push(['Criação de Marca', acompStatusLabel(a.criacao_marca)]);
      push(['Produção', acompStatusLabel(a.producao)]);
      push(['Integração Logística', acompStatusLabel(a.integracao_logistica)]);
      push(['Página de Venda', acompStatusLabel(a.pagina_venda)]);
      push(['Envio do Produto', acompStatusLabel(a.envio_produto)]);
      if (a.satisfacao_nota != null) push(['Satisfação', `${a.satisfacao_nota}/10${a.satisfacao_observacoes ? ` — ${a.satisfacao_observacoes}` : ''}`]);
    }

    if (data.observacoes) { push([]); pushBold(['Observações']); push([data.observacoes]); }

    push([]); push([]); // separador
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  ws['!merges'] = merges;

  // Formatar datas e números automaticamente
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 0; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!cell) continue;
      if (cell.v instanceof Date) { cell.t = 'd'; cell.z = DATE_FMT; }
      else if (typeof cell.v === 'number' && C >= 3) { cell.t = 'n'; cell.z = BRL_FMT; }
    }
  }
  // Bold nas linhas de título
  boldRows.forEach(R => {
    for (let C = 0; C <= 6; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell) cell.s = { font: { bold: true } };
    }
  });
  return ws;
};

const appendAllSheets = (wb: XLSX.WorkBook, pedidos: PedidoReport[]) => {
  XLSX.utils.book_append_sheet(wb, buildParcelasSheet(pedidos), 'Parcelas');
  XLSX.utils.book_append_sheet(wb, buildEntradasMesSheet(pedidos), 'Entradas por Mês');
  XLSX.utils.book_append_sheet(wb, buildComissoesMesSheet(pedidos), 'Comissões por Consultor-Mês');
  XLSX.utils.book_append_sheet(wb, buildDetalhamentoSheet(pedidos), 'Detalhamento por Pedido');
};

export const gerarRelatorioPedidoExcel = (pedido: PedidoReport) => {
  const built = buildRows([pedido]);
  const ws = buildSheetWithFiltros(built, undefined, 1);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  appendAllSheets(wb, [pedido]);
  const data = extractData(pedido);
  XLSX.writeFile(wb, `Relatorio_${data?.numeroPedido || 'pedido'}.xlsx`);
};

export const gerarRelatorioPedidosGeralExcel = (pedidos: PedidoReport[], filtros?: RelatorioFiltros) => {
  const built = buildRows(pedidos);
  const ws = buildSheetWithFiltros(built, filtros, pedidos.length);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  appendAllSheets(wb, pedidos);
  XLSX.writeFile(wb, `Relatorio_Pedidos_Geral${buildFilenameSuffix(filtros)}.xlsx`);
};
