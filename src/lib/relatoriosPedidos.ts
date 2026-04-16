import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarCondicoesPagamento } from './formatarPagamento';

interface PedidoReport {
  numero_pedido: string;
  orcamento_snapshot?: any;
  formula_snapshot?: any;
  data_pedido: string | Date;
}

const extractData = (pedido: PedidoReport) => {
  const snap = pedido.orcamento_snapshot;
  if (!snap) return null;
  return {
    numeroPedido: pedido.numero_pedido,
    cliente: snap.nome_cliente || '',
    consultor: snap.consultor_responsavel || '',
    itens: (snap.itens_producao || []) as any[],
    servicos: (snap.servicos_marca || []) as any[],
    valorTotal: snap.valor_total || 0,
    dataPedido: pedido.data_pedido,
    condicoesPagamento: snap.condicoes_pagamento || null,
  };
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ===== PDF =====

const addPedidoToPDF = (doc: jsPDF, data: ReturnType<typeof extractData>, startY: number): number => {
  if (!data) return startY;
  let y = startY;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedido: ${data.numeroPedido}`, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${data.cliente}`, 14, y); y += 5;
  doc.text(`Consultor: ${data.consultor}`, 14, y); y += 5;
  doc.text(`Data: ${format(new Date(data.dataPedido), 'dd/MM/yyyy', { locale: ptBR })}`, 14, y); y += 8;

  // Produtos
  if (data.itens.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Produtos', 14, y); y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Produto', 'Qtd', 'Valor Unit.', 'Subtotal']],
      body: data.itens.map((i: any) => [
        i.nome_produto || '',
        i.modelo_negocio === 'print_on_demand' ? 'POD' : String(i.quantidade || 0),
        fmt(i.subtotal && i.quantidade ? i.subtotal / i.quantidade : 0),
        fmt(i.subtotal || 0),
      ]),
      margin: { left: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Serviços de marca
  if (data.servicos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Serviços de Criação de Marca', 14, y); y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Serviço', 'Valor']],
      body: data.servicos.map((s: any) => [s.nome_plano || '', fmt(s.valor || 0)]),
      margin: { left: 14 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${fmt(data.valorTotal)}`, 14, y);
  y += 8;

  // Condições de Pagamento
  if (data.condicoesPagamento) {
    const linhas = formatarCondicoesPagamento(data.condicoesPagamento, data.valorTotal);
    if (linhas.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Condições de Pagamento', 14, y); y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      linhas.forEach(l => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(l, 16, y); y += 4;
      });
      y += 4;
    }
  }

  return y;
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

export const gerarRelatorioPedidosGeralPDF = (pedidos: PedidoReport[]) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório Geral de Pedidos', 14, 20);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 26);
  doc.text(`Total de pedidos: ${pedidos.length}`, 14, 31);

  let y = 40;
  pedidos.forEach((pedido, idx) => {
    const data = extractData(pedido);
    if (!data) return;
    if (y > 240) { doc.addPage(); y = 20; }
    y = addPedidoToPDF(doc, data, y);
    if (idx < pedidos.length - 1) {
      doc.setDrawColor(200); doc.line(14, y - 4, 196, y - 4);
    }
  });

  doc.save('Relatorio_Pedidos_Geral.pdf');
};

// ===== EXCEL =====

const buildRows = (pedidos: PedidoReport[]) => {
  const rows: any[][] = [];
  pedidos.forEach(pedido => {
    const data = extractData(pedido);
    if (!data) return;
    const hasServicos = data.servicos.length > 0;
    const maxRows = Math.max(data.itens.length, hasServicos ? data.servicos.length : 0, 1);
    const pagamentoResumo = data.condicoesPagamento
      ? formatarCondicoesPagamento(data.condicoesPagamento, data.valorTotal).join(' | ')
      : '';
    for (let i = 0; i < maxRows; i++) {
      const item = data.itens[i];
      const serv = data.servicos[i];
      rows.push([
        i === 0 ? data.numeroPedido : '',
        i === 0 ? data.cliente : '',
        i === 0 ? data.consultor : '',
        item?.nome_produto || '',
        item ? (item.modelo_negocio === 'print_on_demand' ? 'POD' : item.quantidade || 0) : '',
        item ? (item.subtotal && item.quantidade ? item.subtotal / item.quantidade : 0) : '',
        item?.subtotal || '',
        serv?.nome_plano || '',
        serv?.valor || '',
        i === 0 ? pagamentoResumo : '',
      ]);
    }
  });
  return rows;
};

const headers = ['Nº Pedido', 'Cliente', 'Consultor', 'Produto', 'Qtd', 'Valor Unit.', 'Subtotal Produto', 'Serviço Marca', 'Valor Serviço', 'Forma Pagamento'];

export const gerarRelatorioPedidoExcel = (pedido: PedidoReport) => {
  const rows = buildRows([pedido]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((_, i) => ({ wch: i <= 2 ? 20 : i === 3 || i === 7 ? 30 : 15 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  const data = extractData(pedido);
  XLSX.writeFile(wb, `Relatorio_${data?.numeroPedido || 'pedido'}.xlsx`);
};

export const gerarRelatorioPedidosGeralExcel = (pedidos: PedidoReport[]) => {
  const rows = buildRows(pedidos);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((_, i) => ({ wch: i <= 2 ? 20 : i === 3 || i === 7 ? 30 : 15 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, 'Relatorio_Pedidos_Geral.xlsx');
};
