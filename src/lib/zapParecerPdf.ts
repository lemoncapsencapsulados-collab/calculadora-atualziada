// Import NOMEADO, não default: o default do jspdf não é construtor em bundle
// CJS ("import_jspdf.default is not a constructor"). O nomeado funciona nos
// dois mundos, e o erro só apareceria em runtime — não no build.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MetricasConsultor, ParecerCompleto, ObjecaoRanking } from '@/hooks/useZapInteligencia';
import { formatarDuracao, taxa } from '@/hooks/useZapInteligencia';

/**
 * PDF do plano de ação, para enviar ao próprio consultor.
 *
 * O documento é escrito para ELE, não para quem administra: sem nome de tabela,
 * sem "IA", sem jargão do sistema. Um consultor que recebe um relatório cheio de
 * termo técnico ignora o conteúdo.
 *
 * Gerado com jsPDF direto, e não capturando a tela com html2canvas: captura de
 * tela vira imagem, que não permite copiar texto, pesa mais e fica ilegível
 * quando o PDF é impresso. O plano é feito para ser lido e cobrado depois.
 */

const MARGEM = 16;
const LARGURA = 210; // A4 retrato, em mm
const UTIL = LARGURA - MARGEM * 2;

interface Dados {
  metricas: MetricasConsultor;
  parecer: ParecerCompleto;
  objecoes: ObjecaoRanking[];
  periodoInicio: Date;
  periodoFim: Date;
}

/** Escreve um parágrafo com quebra automática e devolve o novo Y. */
function paragrafo(doc: jsPDF, texto: string, y: number, tamanho = 10): number {
  doc.setFontSize(tamanho);
  doc.setFont('helvetica', 'normal');
  const linhas = doc.splitTextToSize(texto || '—', UTIL) as string[];
  // Quebra de página antes de escrever, não depois: um parágrafo cortado ao
  // meio pela borda é pior que uma página com espaço sobrando.
  for (const linha of linhas) {
    if (y > 275) {
      doc.addPage();
      y = MARGEM + 4;
    }
    doc.text(linha, MARGEM, y);
    y += tamanho * 0.5;
  }
  return y + 3;
}

function titulo(doc: jsPDF, texto: string, y: number): number {
  if (y > 262) {
    doc.addPage();
    y = MARGEM + 4;
  }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(texto, MARGEM, y);
  doc.setDrawColor(200);
  doc.line(MARGEM, y + 1.5, LARGURA - MARGEM, y + 1.5);
  return y + 7;
}

export function gerarPdfParecer(d: Dados): void {
  const { metricas: m, parecer, objecoes, periodoInicio, periodoFim } = d;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ---- Cabeçalho
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('Plano de Ação Comercial', MARGEM, 22);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(m.consultor, MARGEM, 30);

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Período analisado: ${format(periodoInicio, 'dd/MM/yyyy')} a ${format(periodoFim, 'dd/MM/yyyy')}` +
      `   ·   Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    MARGEM,
    36
  );
  doc.setTextColor(0);

  // ---- Indicadores
  // Cada linha traz o denominador junto: número de taxa sem base convida a
  // comparações que o dado não sustenta.
  autoTable(doc, {
    startY: 42,
    head: [['Indicador', 'Valor', 'Base']],
    body: [
      ['Contatos atendidos', String(m.contatos), `${m.contatos_internos_excluidos} internos fora da conta`],
      [
        'Tempo até a 1ª resposta (mediana)',
        formatarDuracao(m.tmr1_mediana_seg),
        `${m.contatos_cliente_iniciou} conversas iniciadas pelo cliente`,
      ],
      ['Mesmo indicador, 10% piores (p90)', formatarDuracao(m.tmr1_p90_seg), 'a cauda que perde cliente'],
      ['1% piores (p99)', formatarDuracao(m.tmr1_p99_seg), ''],
      [
        'Resposta ao longo da conversa (mediana)',
        formatarDuracao(m.resposta_continua_mediana_seg),
        `p90 ${formatarDuracao(m.resposta_continua_p90_seg)}`,
      ],
      ['O cliente responde em (mediana)', formatarDuracao(m.resposta_cliente_mediana_seg), ''],
      [
        'Prospecção sem resposta',
        m.vacuo_inicial_pct == null ? '—' : `${m.vacuo_inicial_pct}%`,
        `${m.contatos_consultor_iniciou} abordagens feitas por você`,
      ],
      [
        'Contatos que receberam catálogo ou link',
        String(m.contatos_com_link),
        taxa(m.contatos_com_link, m.contatos),
      ],
      [
        'Áudios enviados',
        String(m.audios_enviados),
        `${(m.audios_enviados / Math.max(m.contatos, 1)).toFixed(1)} por contato`,
      ],
      [
        'Vídeos / imagens / documentos',
        `${m.videos_enviados} / ${m.imagens_enviadas} / ${m.documentos_enviados}`,
        '',
      ],
      [
        'Chegaram a reunião, proposta ou fechamento',
        String(m.contatos_com_reuniao),
        `${taxa(m.contatos_com_reuniao, m.conversas_analisadas)} das ${m.conversas_analisadas} conversas avaliadas`,
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { textColor: 120 } },
    margin: { left: MARGEM, right: MARGEM },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;

  // ---- Objeções
  if (objecoes.length) {
    y = titulo(doc, 'Objeções que você recebeu', y);
    autoTable(doc, {
      startY: y,
      head: [['Objeção', 'Vezes', 'Contornadas', 'Conversas']],
      body: objecoes
        .slice(0, 10)
        .map((o) => [o.categoria, String(o.total), String(o.superadas), String(o.conversas)]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: MARGEM, right: MARGEM },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ---- Plano de ação: primeiro, porque é o que o consultor precisa fazer
  const itens = parecer.plano_acao_itens ?? [];
  doc.addPage();
  y = MARGEM + 6;
  y = titulo(doc, 'Plano de ação', y);

  if (itens.length) {
    autoTable(doc, {
      startY: y,
      head: [['#', 'O que fazer', 'Indicador', 'Hoje', 'Meta', 'Prazo']],
      body: itens.map((a, i) => [
        String(i + 1),
        a.acao,
        a.metrica,
        a.valor_atual,
        a.meta,
        a.prazo,
      ]),
      styles: { fontSize: 8.5, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: [40, 40, 40] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 55 },
        2: { cellWidth: 32 },
        3: { cellWidth: 25 },
        4: { cellWidth: 35 },
        5: { cellWidth: 24 },
      },
      margin: { left: MARGEM, right: MARGEM },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y = paragrafo(doc, parecer.plano_acao, y);
  }

  // ---- Análise em texto
  y = titulo(doc, 'Onde você está forte e onde perde', y);
  y = paragrafo(doc, parecer.eficiencia, y);
  y = paragrafo(doc, parecer.processo, y);
  y = paragrafo(doc, parecer.relacionamento, y);

  if (parecer.comparativo_time) {
    y = titulo(doc, 'Comparado ao time', y);
    y = paragrafo(doc, parecer.comparativo_time, y);
  }

  const impacto = parecer.pontos_impacto ?? [];
  if (impacto.length) {
    y = titulo(doc, 'Os três pontos de maior impacto', y);
    impacto.forEach((p, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      if (y > 272) {
        doc.addPage();
        y = MARGEM + 4;
      }
      doc.text(`${i + 1}. ${p.titulo}`, MARGEM, y);
      y += 5;

      // A métrica que sustenta o ponto vem logo abaixo do título. Sem ela, a
      // afirmação não é conferível — e era essa a queixa: pontuação sem
      // embasamento à vista.
      if (p.metrica) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(110, 110, 110);
        const lm = doc.splitTextToSize(`Base: ${p.metrica}`, UTIL);
        doc.text(lm, MARGEM, y);
        y += lm.length * 3.8 + 1.5;
        doc.setTextColor(30, 30, 30);
      }

      doc.setFont('helvetica', 'normal');
      y = paragrafo(doc, p.porque, y, 9.5);

      // As conversas concretas. É o que separa "seu tempo de resposta é alto"
      // de "este contato esperou 71h e a conversa morreu".
      for (const e of p.evidencias ?? []) {
        if (y > 262) {
          doc.addPage();
          y = MARGEM + 4;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`• ${e.contato}`, MARGEM + 3, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        for (const [rotulo, texto] of [
          ['O que aconteceu', e.observado],
          ['O erro', e.erro],
          ['O que deveria ter feito', e.deveria],
        ] as [string, string][]) {
          if (!texto) continue;
          const linhas = doc.splitTextToSize(`${rotulo}: ${texto}`, UTIL - 6);
          if (y + linhas.length * 3.8 > 275) {
            doc.addPage();
            y = MARGEM + 4;
          }
          doc.text(linhas, MARGEM + 6, y);
          y += linhas.length * 3.8 + 0.8;
        }
        y += 1.5;
      }
      y += 2;
    });
  }

  // ---- Rodapé com paginação, aplicado no fim porque só agora se sabe o total
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`${m.consultor} · ${format(periodoInicio, 'MM/yyyy')}`, MARGEM, 290);
    doc.text(`${i} de ${paginas}`, LARGURA - MARGEM, 290, { align: 'right' });
  }

  const nome = m.consultor.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`plano-acao-${nome}-${format(periodoInicio, 'yyyy-MM')}.pdf`);
}
