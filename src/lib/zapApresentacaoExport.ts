// Import NOMEADO, não default: o default do jspdf não é construtor em bundle
// CJS ("import_jspdf.default is not a constructor"). O nomeado funciona nos
// dois mundos, e o erro só apareceria em runtime — não no build.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PptxGenJS from 'pptxgenjs';
import { blocosDaApresentacao, type Apresentacao, type Bloco } from './zapApresentacaoBlocos';

/**
 * Exportação da apresentação em PDF (A4) e PPTX (16:9).
 *
 * Os dois formatos leem `blocosDaApresentacao`, nunca o payload direto — é o
 * que garante números idênticos entre relatório e slide. E ambos partem do
 * `payload_json` já gravado: re-exportar não consome crédito de IA.
 *
 * Paleta de sala de controle, igual à do ERP: fundo quase preto, acento
 * verde-menta, alerta âmbar, crítico coral. Números grandes, `n` em corpo
 * pequeno logo abaixo.
 */

const COR = {
  fundo: '0B0F0E',
  cartao: '141A19',
  borda: '1F2A28',
  acento: '3FDDA5',
  ambar: 'E8B75A',
  coral: 'FF6B6B',
  neutro: '7A8683',
  texto: 'E6EDEA',
};

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(0, 2), 16),
  parseInt(h.slice(2, 4), 16),
  parseInt(h.slice(4, 6), 16),
];

/** Nome de arquivo fixo por consultor e período, como a especificação exige. */
export function nomeArquivo(a: Apresentacao, ext: 'pdf' | 'pptx'): string {
  const slug = a.consultor_nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `IA-Atendimento_${slug}_${a.periodo_inicio}_a_${a.periodo_fim}_v${a.versao}.${ext}`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const M = 14;

/** '2026-07-01' vira '01/07/2026' sem depender de fuso. */
const fmt = (iso: string) => iso.split('-').reverse().join('/');
const LARGURA = 210;
const UTIL = LARGURA - M * 2;

/** Guardado no módulo porque o cabeçalho é desenhado a cada página nova. */
let cabecalhoAtual = { consultor: '', periodo: '' };

function fundoPagina(doc: jsPDF) {
  doc.setFillColor(...hex(COR.fundo));
  doc.rect(0, 0, LARGURA, 297, 'F');

  // Faixa de identificação em TODA página. Um relatório impresso circula
  // solto: quem pega a página 4 precisa saber de quem e de quando ela é.
  doc.setFillColor(...hex(COR.cartao));
  doc.rect(0, 0, LARGURA, 11, 'F');
  doc.setDrawColor(...hex(COR.acento));
  doc.setLineWidth(0.5);
  doc.line(0, 11, LARGURA, 11);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hex(COR.texto));
  doc.text(cabecalhoAtual.consultor, M, 7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hex(COR.neutro));
  doc.text(cabecalhoAtual.periodo, LARGURA - M, 7.2, { align: 'right' });
}

function novaPagina(doc: jsPDF): number {
  doc.addPage();
  fundoPagina(doc);
  // Abaixo da faixa de cabeçalho, não colado nela.
  return M + 10;
}

function tituloBloco(doc: jsPDF, texto: string, y: number): number {
  if (y > 258) y = novaPagina(doc);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hex(COR.texto));
  doc.text(texto, M, y);
  doc.setDrawColor(...hex(COR.acento));
  doc.setLineWidth(0.6);
  doc.line(M, y + 1.6, M + 26, y + 1.6);
  return y + 8;
}

function paragrafo(doc: jsPDF, texto: string, y: number, cor = COR.texto, tam = 9.5): number {
  doc.setFontSize(tam);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hex(cor));
  for (const linha of doc.splitTextToSize(texto || '—', UTIL) as string[]) {
    if (y > 280) y = novaPagina(doc);
    doc.text(linha, M, y);
    y += tam * 0.5;
  }
  return y + 3;
}

function tabelaPdf(doc: jsPDF, b: Extract<Bloco, { tipo: 'tabela' }>, y: number): number {
  autoTable(doc, {
    startY: y,
    head: [b.colunas],
    body: b.linhas,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: hex(COR.texto),
      fillColor: hex(COR.cartao),
      lineColor: hex(COR.borda),
      lineWidth: 0.1,
      valign: 'top',
    },
    headStyles: { fillColor: hex(COR.borda), textColor: hex(COR.acento), fontStyle: 'bold' },
    alternateRowStyles: { fillColor: hex(COR.fundo) },
    // Proporções convertidas para milímetros do espaço útil.
    columnStyles: b.larguras
      ? Object.fromEntries(
          b.larguras.map((p, i) => [
            i,
            { cellWidth: (p / b.larguras!.reduce((x, y) => x + y, 0)) * UTIL },
          ])
        )
      : undefined,
    margin: { left: M, right: M },
  });
  let novoY = (doc as any).lastAutoTable.finalY + 4;
  if (b.nota) novoY = paragrafo(doc, b.nota, novoY, COR.neutro, 8);
  return novoY + 3;
}

/**
 * Legendas do bloco, logo abaixo dele. Recuadas e em corpo menor para não
 * competir com o dado — são apoio à leitura, não conteúdo.
 */
function legendasPdf(doc: jsPDF, legendas: string[] | undefined, y: number): number {
  if (!legendas?.length) return y;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hex(COR.neutro));
  for (const l of legendas) {
    for (const linha of doc.splitTextToSize(l, UTIL - 4) as string[]) {
      if (y > 282) y = novaPagina(doc);
      doc.text(linha, M + 3, y);
      y += 3.4;
    }
    y += 0.8;
  }
  return y + 2;
}

export function exportarPdf(a: Apresentacao): void {
  const blocos = blocosDaApresentacao(a);
  cabecalhoAtual = {
    consultor: a.consultor_nome,
    periodo: `${fmt(a.periodo_inicio)} a ${fmt(a.periodo_fim)}  ·  v${a.versao}`,
  };
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  fundoPagina(doc);
  let y = M + 12;

  for (const b of blocos) {
    if (b.tipo === 'capa') {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...hex(COR.acento));
      doc.text('Inteligência de Atendimento', M, y + 6);
      doc.setFontSize(16);
      doc.setTextColor(...hex(COR.texto));
      doc.text(b.titulo, M, y + 16);
      y += 24;
      for (const l of b.linhas) y = paragrafo(doc, l, y, COR.neutro, 9);
      // Selos de limitação em âmbar, no topo: quem lê precisa saber do buraco
      // antes de olhar qualquer número.
      for (const s of b.selos) {
        doc.setFillColor(...hex(COR.ambar));
        doc.rect(M, y - 3.4, 2, 4.4, 'F');
        y = paragrafo(doc, s, y, COR.ambar, 9);
      }
      y += 4;
      continue;
    }

    y = tituloBloco(doc, b.titulo, y);

    if (b.tipo === 'gauge') {
      doc.setFontSize(34);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...hex(COR.acento));
      doc.text(String(b.valor), M, y + 8);
      doc.setFontSize(8);
      doc.setTextColor(...hex(COR.neutro));
      doc.text('de 100', M + 26, y + 8);
      y += 14;
      if (b.legenda) y = paragrafo(doc, b.legenda, y);
      y = tabelaPdf(
        doc,
        {
          tipo: 'tabela',
          titulo: '',
          colunas: ['Eixo', 'Valor', 'Peso', 'Base'],
          linhas: b.eixos.map((e) => [
            e.nome,
            e.valor == null ? (e.indisponivel ? 'não medido' : '—') : `${e.valor}%`,
            String(e.peso),
            e.n ? `n=${e.n}` : '',
          ]),
        },
        y
      );
    } else if (b.tipo === 'funil') {
      y = tabelaPdf(
        doc,
        {
          tipo: 'tabela',
          titulo: '',
          colunas: ['Etapa', 'Contatos', 'Conversão do passo', 'Perdidos'],
          linhas: b.etapas.map((e) => [
            e.etapa,
            String(e.valor),
            e.conv == null ? '—' : `${e.conv}%`,
            e.queda ? `-${e.queda}` : '',
          ]),
          nota: b.nota,
        },
        y
      );
    } else if (b.tipo === 'tabela') {
      y = tabelaPdf(doc, b, y);
    } else if (b.tipo === 'cards') {
      for (const c of b.cards) {
        if (y > 250) y = novaPagina(doc);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...hex(COR.texto));
        doc.text(c.titulo, M, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...hex(COR.acento));
        doc.text(`${c.metrica}: ${c.valor}`, M, y + 4.5);
        y = paragrafo(doc, c.leitura, y + 9, COR.texto, 8.5);
        if (c.custo) y = paragrafo(doc, `Custo estimado: ${c.custo}`, y - 1, COR.coral, 8);
        y += 1;
      }
    } else if (b.tipo === 'texto') {
      y = paragrafo(doc, b.texto, y);
    }

    y = legendasPdf(doc, (b as any).legendas, y);
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...hex(COR.neutro));
    doc.text(`${a.consultor_nome} · ${a.periodo_inicio} a ${a.periodo_fim} · v${a.versao}`, M, 290);
    doc.text(`${i}/${paginas}`, LARGURA - M, 290, { align: 'right' });
  }

  doc.save(nomeArquivo(a, 'pdf'));
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

/**
 * O PptxGenJS aceita célula só como objeto, nunca como string solta. Converter
 * aqui evita repetir o `map` em cada tabela e mantém as linhas legíveis nos
 * blocos.
 */
const celulas = (linhas: string[][]) =>
  linhas.map((l) => l.map((c) => ({ text: String(c ?? '') })));

export async function exportarPptx(a: Apresentacao): Promise<void> {
  const blocos = blocosDaApresentacao(a);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.defineSlideMaster({
    title: 'ESCURO',
    background: { color: COR.fundo },
  });

  for (const b of blocos) {
    const s = pptx.addSlide({ masterName: 'ESCURO' });

    if (b.tipo === 'capa') {
      s.addText('Inteligência de Atendimento', {
        x: 0.6, y: 1.5, w: 9, h: 0.6, fontSize: 30, bold: true, color: COR.acento,
      });
      s.addText(b.titulo, { x: 0.6, y: 2.2, w: 9, h: 0.5, fontSize: 22, color: COR.texto });
      s.addText(b.linhas.join('\n'), {
        x: 0.6, y: 2.9, w: 9, h: 1.4, fontSize: 12, color: COR.neutro, lineSpacing: 18,
      });
      if (b.selos.length) {
        s.addText(b.selos.join('\n'), {
          x: 0.6, y: 4.3, w: 9, h: 0.8, fontSize: 11, color: COR.ambar,
        });
      }
      continue;
    }

    s.addText(b.titulo, { x: 0.5, y: 0.35, w: 9, h: 0.5, fontSize: 20, bold: true, color: COR.texto });
    s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.85, w: 1.1, h: 0.05, fill: { color: COR.acento } });

    if (b.tipo === 'gauge') {
      s.addText(String(b.valor), { x: 0.5, y: 1.1, w: 2.2, h: 1.1, fontSize: 54, bold: true, color: COR.acento });
      s.addText('de 100', { x: 0.5, y: 2.1, w: 2.2, h: 0.3, fontSize: 11, color: COR.neutro });
      if (b.legenda) {
        s.addText(b.legenda, { x: 2.9, y: 1.1, w: 6.6, h: 1.3, fontSize: 12, color: COR.texto });
      }
      s.addTable(
        [
          ['Eixo', 'Valor', 'Peso', 'Base'].map((h) => ({ text: h, options: { bold: true, color: COR.acento } })),
          ...celulas(
            b.eixos.map((e) => [
              e.nome,
              e.valor == null ? 'não medido' : `${e.valor}%`,
              String(e.peso),
              e.n ? `n=${e.n}` : '',
            ])
          ),
        ],
        { x: 0.5, y: 2.6, w: 9, fontSize: 10, color: COR.texto, border: { pt: 0.5, color: COR.borda } }
      );
    } else if (b.tipo === 'funil') {
      s.addTable(
        [
          ['Etapa', 'Contatos', 'Conversão do passo', 'Perdidos'].map((h) => ({
            text: h, options: { bold: true, color: COR.acento },
          })),
          ...celulas(
            b.etapas.map((e) => [
              e.etapa, String(e.valor), e.conv == null ? '—' : `${e.conv}%`, e.queda ? `-${e.queda}` : '',
            ])
          ),
        ],
        { x: 0.5, y: 1.1, w: 9, fontSize: 11, color: COR.texto, border: { pt: 0.5, color: COR.borda } }
      );
      if (b.nota) {
        s.addText(b.nota, {
          x: 0.5, y: b.legendas?.length ? 3.62 : 4.6,
          w: 9, h: 0.4, fontSize: 9, color: COR.texto,
        });
      }
    } else if (b.tipo === 'tabela') {
      // Menos linhas quando há legenda: ela ocupa o rodapé, e tabela colada na
      // legenda fica ilegível projetada.
      const limite = (b as any).legendas?.length ? 7 : 9;
      const linhas = b.linhas.slice(0, limite);
      s.addTable(
        [
          b.colunas.map((h) => ({ text: h, options: { bold: true, color: COR.acento } })),
          ...celulas(linhas),
        ],
        { x: 0.5, y: 1.1, w: 9, fontSize: 10, color: COR.texto, border: { pt: 0.5, color: COR.borda } }
      );
      const nota = [
        b.linhas.length > linhas.length ? `+${b.linhas.length - linhas.length} linhas no PDF.` : '',
        b.nota ?? '',
      ].filter(Boolean).join(' ');
      if (nota) {
        s.addText(nota, {
          x: 0.5, y: (b as any).legendas?.length ? 3.62 : 4.7,
          w: 9, h: 0.4, fontSize: 9, color: COR.texto,
        });
      }
    } else if (b.tipo === 'cards') {
      b.cards.slice(0, 4).forEach((c, i) => {
        const x = 0.5 + (i % 2) * 4.6;
        const y = 1.15 + Math.floor(i / 2) * 1.9;
        s.addShape(pptx.ShapeType.roundRect, {
          x, y, w: 4.3, h: 1.7, fill: { color: COR.cartao }, line: { color: COR.borda, pt: 1 },
        });
        s.addText(c.titulo, { x: x + 0.15, y: y + 0.1, w: 4, h: 0.35, fontSize: 12, bold: true, color: COR.texto });
        s.addText(`${c.metrica}: ${c.valor}`, { x: x + 0.15, y: y + 0.45, w: 4, h: 0.3, fontSize: 10, color: COR.acento });
        s.addText(c.leitura, { x: x + 0.15, y: y + 0.75, w: 4, h: 0.85, fontSize: 9, color: COR.texto });
      });
    } else if (b.tipo === 'texto') {
      s.addText(b.texto, { x: 0.5, y: 1.2, w: 9, h: 3, fontSize: 14, color: COR.texto });
    }

    // Legendas no rodapé do próprio slide: ele é projetado isolado, e quem lê
    // "n=357" precisa da definição ali, não num glossário que ninguém abre.
    const legendas = (b as any).legendas as string[] | undefined;
    if (legendas?.length) {
      s.addText(legendas.map((l) => `· ${l}`).join(String.fromCharCode(10)), {
        x: 0.5, y: 4.05, w: 9, h: 1.0, fontSize: 8, color: COR.neutro, lineSpacing: 11,
      });
    }

    s.addText(`${a.consultor_nome} · ${a.periodo_inicio} a ${a.periodo_fim} · v${a.versao}`, {
      x: 0.5, y: 5.15, w: 9, h: 0.3, fontSize: 8, color: COR.neutro,
    });
  }

  await pptx.writeFile({ fileName: nomeArquivo(a, 'pptx') });
}
