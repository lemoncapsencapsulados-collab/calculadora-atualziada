import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatBRL, labelCanal } from '@/lib/anuncios';
import type { KpisAnuncios, LinhaConsultorAnuncio, RegistroTabela } from '@/hooks/useAnunciosDados';

export interface DadosExport {
  periodoLabel: string;
  filtroLabel: string;
  nomeArquivo: string;
  kpis: KpisAnuncios;
  consultores: LinhaConsultorAnuncio[];
  registros: RegistroTabela[];
}

function tabelaKpis(k: KpisAnuncios) {
  return [
    ['Indicador', 'Valor'],
    ['Total investido', formatBRL(k.invest)],
    ['Leads', String(k.leads)],
    ['Orçamentos', String(k.orcamentos)],
    ['Vendas', String(k.vendas)],
    ['CPL médio', formatBRL(k.cpl)],
    ['CAC (custo por venda)', formatBRL(k.cac)],
    ['Taxa Lead→Orçamento', `${k.taxaLO.toFixed(1)}%`],
    ['Taxa Orçamento→Venda', `${k.taxaOV.toFixed(1)}%`],
    ['Taxa Lead→Venda', `${k.taxaLV.toFixed(1)}%`],
  ];
}

function tabelaConsultores(cs: LinhaConsultorAnuncio[]) {
  return [
    ['Consultor', 'Investimento', 'Leads', 'Orçamentos', 'Vendas', 'CPL', 'Custo/Venda', 'Lead→Orç', 'Orç→Venda', 'Lead→Venda'],
    ...cs.map((c) => [
      c.nome,
      formatBRL(c.invest),
      c.leads,
      c.orcamentos,
      c.vendas,
      formatBRL(c.cpl),
      formatBRL(c.custoVenda),
      `${c.taxaLO.toFixed(1)}%`,
      `${c.taxaOV.toFixed(1)}%`,
      `${c.taxaLV.toFixed(1)}%`,
    ]),
  ];
}

function tabelaRegistros(rs: RegistroTabela[]) {
  return [
    ['Data', 'Origem', 'Canal', 'Campanha', 'Investimento', 'Leads', 'CPL'],
    ...rs.map((r) => [
      r.dataLabel,
      r.origem === 'meta' ? 'Meta API' : 'Manual',
      r.canal === 'meta_api' ? 'Meta Ads (API)' : labelCanal(r.canal),
      r.campanha,
      formatBRL(r.invest),
      r.leads,
      formatBRL(r.cpl),
    ]),
  ];
}

export function exportarCSV(d: DadosExport) {
  const esc = (v: any) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas: string[] = [
    `Investimento em Anúncios — ${d.periodoLabel}`,
    d.filtroLabel,
    '',
    'Resumo',
    ...tabelaKpis(d.kpis).map((r) => r.map(esc).join(',')),
    '',
    'Por consultor',
    ...tabelaConsultores(d.consultores).map((r) => r.map(esc).join(',')),
    '',
    'Registros detalhados',
    ...tabelaRegistros(d.registros).map((r) => r.map(esc).join(',')),
  ];
  const blob = new Blob([`\uFEFF${linhas.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${d.nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarXLSX(d: DadosExport) {
  const wb = XLSX.utils.book_new();
  const cab = [['Investimento em Anúncios'], [d.periodoLabel], [d.filtroLabel], []];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...cab, ...tabelaKpis(d.kpis)]), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...cab, ...tabelaConsultores(d.consultores)]), 'Por Consultor');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...cab, ...tabelaRegistros(d.registros)]), 'Registros');
  XLSX.writeFile(wb, `${d.nomeArquivo}.xlsx`);
}

export function exportarPDF(d: DadosExport) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14;

  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Investimento em Anúncios', m, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(d.periodoLabel, pageW - m, 10, { align: 'right' });
  doc.text(d.filtroLabel, pageW - m, 16, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  const head = (rows: any[][]) => [rows[0]];
  const body = (rows: any[][]) => rows.slice(1).map((r) => r.map(String));
  const estilo = {
    headStyles: { fillColor: [0, 200, 170] as [number, number, number], textColor: 20 },
    alternateRowStyles: { fillColor: [244, 246, 248] as [number, number, number] },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: m, right: m },
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumo do período', m, 34);
  autoTable(doc, { startY: 38, head: head(tabelaKpis(d.kpis)), body: body(tabelaKpis(d.kpis)), ...estilo });

  let y = (doc as any).lastAutoTable.finalY + 8;
  if (y > pageH - 40) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.text('Funil por consultor', m, y);
  const tc = tabelaConsultores(d.consultores);
  autoTable(doc, { startY: y + 4, head: head(tc), body: body(tc), ...estilo, styles: { fontSize: 7.5, cellPadding: 2 } });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > pageH - 40) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.text('Registros de investimento', m, y);
  const tr = tabelaRegistros(d.registros);
  autoTable(doc, { startY: y + 4, head: head(tr), body: body(tr), ...estilo, styles: { fontSize: 8, cellPadding: 2 } });

  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, m, pageH - 8);
    doc.text(`Página ${i} de ${pages}`, pageW - m, pageH - 8, { align: 'right' });
  }
  doc.save(`${d.nomeArquivo}.pdf`);
}
