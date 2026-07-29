import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DemandaMarca,
  DEMANDA_STATUS_LABELS,
  DEMANDA_TIPO_LABELS,
  DEMANDA_TIPO_SETOR,
  DadosBanner,
  DadosCriativos,
  DadosMonetizze,
  DadosRotulo,
  ProdutoPedido,
} from '@/types/demandaMarca';

interface Contexto {
  numeroPedido: string;
  clienteNome: string;
  vendedorNome: string;
}

const MARGEM = 14;

function cabecalho(doc: jsPDF, ctx: Contexto, titulo: string) {
  doc.setFillColor(23, 37, 84);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, MARGEM, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Pedido ${ctx.numeroPedido}  •  Cliente: ${ctx.clienteNome}  •  Vendedor responsável: ${ctx.vendedorNome}`,
    MARGEM,
    19,
  );
  doc.setTextColor(0, 0, 0);
  return 34;
}

function secaoDemanda(doc: jsPDF, d: DemandaMarca, y: number): number {
  const larguraUtil = doc.internal.pageSize.getWidth() - MARGEM * 2;
  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(MARGEM, y - 5, larguraUtil, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${DEMANDA_TIPO_LABELS[d.tipo].toUpperCase()} — ${DEMANDA_TIPO_SETOR[d.tipo]}`, MARGEM + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${DEMANDA_STATUS_LABELS[d.status]}  •  Criada em ${format(new Date(d.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    doc.internal.pageSize.getWidth() - MARGEM - 2,
    y + 1,
    { align: 'right' },
  );
  y += 10;

  const linhas: string[][] = [];
  const dados = d.dados || {};

  const produtosPedido: ProdutoPedido[] = Array.isArray(dados.produtos_pedido) ? dados.produtos_pedido : [];
  produtosPedido.forEach((p, i) => {
    const detalhes = [
      p.tipo_produto,
      p.segmento ? `Segmento: ${p.segmento}` : '',
      p.dose_diaria_sugerida ? `Dose diária: ${p.dose_diaria_sugerida}` : '',
      p.quantidade_por_pote ? `${p.quantidade_por_pote} ${p.unidade_por_pote || 'un'}/pote` : '',
      p.quantidade_doses ? `${p.quantidade_doses} doses/pote` : '',
      p.cor_pote ? `Pote: ${p.cor_pote}` : '',
      p.cor_tampa ? `Tampa: ${p.cor_tampa}` : '',
      p.quantidade ? `${p.quantidade} un. contratadas` : '',
    ].filter(Boolean).join(' | ');
    linhas.push([
      `Produto do pedido ${produtosPedido.length > 1 ? i + 1 : ''}`.trim(),
      `${p.nome_produto}\n${detalhes}`,
    ]);
  });

  if (d.tipo === 'rotulo') {
    const r = dados as DadosRotulo;
    linhas.push(['Tipo de papel', r.tipo_papel || '-']);
    linhas.push(['Nome da marca', r.sem_marca ? 'Sem marca ainda' : r.nome_marca || '-']);
    linhas.push(['Posicionamento', r.posicionamento || '-']);
    linhas.push(['Estrutura do rótulo', r.estrutura || '-']);
    (r.produtos || []).forEach((p, i) => {
      linhas.push([
        `Produto ${i + 1}`,
        `${p.nome_indefinido ? 'Nome indefinido ainda' : p.nome_produto || '-'} | ${p.tipo_produto || '-'} | ${p.quantidade_potes || 0} potes | Segmento: ${p.segmento || '-'}`,
      ]);
    });
    if (r.observacoes) linhas.push(['Observações', r.observacoes]);
  } else if (d.tipo === 'criativos') {
    const c = dados as DadosCriativos;
    (c.produtos || []).forEach((p) => {
      linhas.push([
        p.nome_produto || 'Produto',
        `${p.quantidade} criativo(s) — ${(p.objetivos || []).map((o, i) => `${i + 1}) ${o}`).join('  ')}`,
      ]);
    });
    if (c.observacoes) linhas.push(['Observações', c.observacoes]);
  } else if (d.tipo === 'banner') {
    const b = dados as DadosBanner;
    (b.produtos || []).filter((p) => p.selecionado).forEach((p) => {
      const formatos = [p.vertical ? '1 banner vertical' : '', p.horizontal ? '1 banner horizontal' : '']
        .filter(Boolean)
        .join(' + ');
      linhas.push([p.nome_produto || 'Produto', formatos || '-']);
    });
    if (b.observacoes) linhas.push(['Observações', b.observacoes]);
  } else if (d.tipo === 'monetizze') {
    const m = dados as DadosMonetizze;
    (m.etapas || []).forEach((e) => {
      linhas.push([e.concluida ? 'Concluída' : 'Pendente', e.descricao]);
    });
    if (m.link_divulgacao) linhas.push(['Link de divulgação', m.link_divulgacao]);
    if (m.observacoes) linhas.push(['Observações', m.observacoes]);
  }

  if ((d.arquivos || []).length > 0) {
    linhas.push([
      'Arquivos anexados',
      d.arquivos.map((a) => `${a.categoria === 'logo' ? 'Logo' : 'Referência'}: ${a.nome}`).join(' | '),
    ]);
  }

  autoTable(doc, {
    startY: y,
    body: linhas,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', fillColor: [248, 250, 252] } },
    margin: { left: MARGEM, right: MARGEM },
  });

  return (doc as any).lastAutoTable.finalY + 8;
}

export function gerarBriefingDemandasPDF(demandas: DemandaMarca[], ctx: Contexto, nomeArquivo?: string) {
  const doc = new jsPDF();
  const titulo = demandas.length === 1
    ? `Briefing — ${DEMANDA_TIPO_LABELS[demandas[0].tipo]}`
    : 'Briefing de Demandas de Marca';
  let y = cabecalho(doc, ctx, titulo);

  if (demandas.length === 0) {
    doc.setFontSize(10);
    doc.text('Nenhuma demanda cadastrada para este pedido.', MARGEM, y);
  } else {
    demandas.forEach((d) => {
      y = secaoDemanda(doc, d, y);
    });
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      MARGEM,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() - MARGEM,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  const base = nomeArquivo || `demandas-${ctx.numeroPedido}`;
  doc.save(`${base.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`);
}

export interface GrupoBriefing {
  ctx: Contexto;
  demandas: DemandaMarca[];
}

export function gerarBriefingConsolidadoPDF(
  grupos: GrupoBriefing[],
  filtros: string[] = [],
  nomeArquivo?: string,
) {
  const doc = new jsPDF();
  const larguraUtil = doc.internal.pageSize.getWidth() - MARGEM * 2;

  doc.setFillColor(23, 37, 84);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Briefing Consolidado — Demandas de Marca', MARGEM, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const totalDemandas = grupos.reduce((s, g) => s + g.demandas.length, 0);
  doc.text(
    `${totalDemandas} demanda(s) em ${grupos.length} pedido(s)${filtros.length ? '  •  ' + filtros.join('  •  ') : ''}`,
    MARGEM,
    19,
  );
  doc.setTextColor(0, 0, 0);
  let y = 34;

  if (grupos.length === 0) {
    doc.setFontSize(10);
    doc.text('Nenhuma demanda encontrada para os filtros selecionados.', MARGEM, y);
  }

  grupos.forEach((g) => {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(23, 37, 84);
    doc.rect(MARGEM, y - 5, larguraUtil, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      `Pedido ${g.ctx.numeroPedido} — ${g.ctx.clienteNome}`,
      MARGEM + 2,
      y + 1.5,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Vendedor: ${g.ctx.vendedorNome}`,
      doc.internal.pageSize.getWidth() - MARGEM - 2,
      y + 1.5,
      { align: 'right' },
    );
    doc.setTextColor(0, 0, 0);
    y += 13;

    g.demandas.forEach((d) => {
      y = secaoDemanda(doc, d, y);
    });
    y += 4;
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      MARGEM,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() - MARGEM,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  doc.save(`${(nomeArquivo || 'demandas-marca-consolidado').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`);
}
