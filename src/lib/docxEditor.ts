import PizZip from 'pizzip';
import { asBlob } from 'html-docx-js-typescript';
import { saveAs } from 'file-saver';
import Docxtemplater from 'docxtemplater';
import { normalizarVariavel } from './contratoDocxAutoFill';
import watermarkUrl from '@/assets/watermark-lemoncaps.jpeg';

// ---------------------------------------------------------------------------
// Marca d'água — imagem pequena no canto superior direito de todas as páginas
// ---------------------------------------------------------------------------
let _watermarkBytesPromise: Promise<Uint8Array> | null = null;
async function getWatermarkBytes(): Promise<Uint8Array> {
  if (!_watermarkBytesPromise) {
    _watermarkBytesPromise = fetch(watermarkUrl)
      .then((r) => r.arrayBuffer())
      .then((b) => new Uint8Array(b));
  }
  return _watermarkBytesPromise;
}

export const WATERMARK_URL = watermarkUrl;

function buildHeaderXml(): string {
  // EMUs: 914400 = 1 inch. Imagem ~0.55in (500000 EMU) posicionada perto do
  // canto superior direito da página (A4/Letter ~5.9-6.2in do lado esquerdo).
  const cx = 500000;
  const cy = 650000;
  const posH = 5600000; // ~6.1in a partir da esquerda da página
  const posV = 200000;  // ~0.22in do topo
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:p>
    <w:r>
      <w:rPr><w:noProof/></w:rPr>
      <w:drawing>
        <wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
          <wp:simplePos x="0" y="0"/>
          <wp:positionH relativeFrom="page"><wp:posOffset>${posH}</wp:posOffset></wp:positionH>
          <wp:positionV relativeFrom="page"><wp:posOffset>${posV}</wp:posOffset></wp:positionV>
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:wrapNone/>
          <wp:docPr id="1001" name="MarcaDagua"/>
          <wp:cNvGraphicFramePr/>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic>
                <pic:nvPicPr>
                  <pic:cNvPr id="1001" name="wm.jpeg"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="rIdWmImg"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:anchor>
      </w:drawing>
    </w:r>
  </w:p>
</w:hdr>`;
}

async function injetarMarcaDagua(blob: Blob): Promise<Blob> {
  try {
    const ab = await blob.arrayBuffer();
    const zip = new PizZip(ab);
    const imgBytes = await getWatermarkBytes();

    // 1) media
    zip.file('word/media/watermark-lemoncaps.jpeg', imgBytes, { binary: true });

    // 2) header xml
    zip.file('word/header_watermark.xml', buildHeaderXml());

    // 3) rels do header → imagem
    const headerRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdWmImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/watermark-lemoncaps.jpeg"/>
</Relationships>`;
    zip.file('word/_rels/header_watermark.xml.rels', headerRels);

    // 4) rels do document → header
    const relsPath = 'word/_rels/document.xml.rels';
    let relsXml = zip.file(relsPath)?.asText();
    if (!relsXml) return blob;
    const headerRelId = 'rIdWmHeader';
    if (!relsXml.includes(headerRelId)) {
      relsXml = relsXml.replace(
        /<\/Relationships>/i,
        `<Relationship Id="${headerRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header_watermark.xml"/></Relationships>`,
      );
      zip.file(relsPath, relsXml);
    }

    // 5) [Content_Types].xml — jpeg default + header override
    const ctPath = '[Content_Types].xml';
    let ct = zip.file(ctPath)?.asText();
    if (ct) {
      if (!/Extension="jpeg"/i.test(ct) && !/Extension="jpg"/i.test(ct)) {
        ct = ct.replace(/<Types(\s[^>]*)?>/i, (m) => `${m}<Default Extension="jpeg" ContentType="image/jpeg"/>`);
      }
      if (!ct.includes('header_watermark.xml')) {
        ct = ct.replace(
          /<\/Types>/i,
          `<Override PartName="/word/header_watermark.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`,
        );
      }
      zip.file(ctPath, ct);
    }

    // 6) document.xml — inserir headerReference no sectPr
    const docPath = 'word/document.xml';
    let docXml = zip.file(docPath)?.asText();
    if (docXml && !docXml.includes(`r:id="${headerRelId}"`)) {
      const headerRef = `<w:headerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="${headerRelId}"/>`;
      if (/<w:sectPr(\s[^>]*)?>/i.test(docXml)) {
        docXml = docXml.replace(/<w:sectPr(\s[^>]*)?>/i, (m) => `${m}${headerRef}`);
      } else {
        // Cria sectPr no fim do body
        docXml = docXml.replace(
          /<\/w:body>/i,
          `<w:sectPr>${headerRef}</w:sectPr></w:body>`,
        );
      }
      zip.file(docPath, docXml);
    }

    const outBlob = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    });
    return outBlob;
  } catch (err) {
    console.warn('[watermark] falha ao injetar marca d\'água:', err);
    return blob;
  }
}

// ---------------------------------------------------------------------------
// Conversor OOXML → HTML de alta fidelidade
// Preserva fonte, tamanho, cor, negrito/itálico/sublinhado, alinhamento,
// espaçamento, recuo, listas e tabelas — usando estilos inline para que o
// editor TipTap mantenha a formatação idêntica ao arquivo Word original.
// ---------------------------------------------------------------------------

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function q(el: Element, local: string): Element | null {
  const list = el.getElementsByTagNameNS(W_NS, local);
  return list.length ? list.item(0) : null;
}
function qAll(el: Element, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(W_NS, local));
}
function child(el: Element, local: string): Element | null {
  for (const c of Array.from(el.children)) {
    if (c.localName === local && c.namespaceURI === W_NS) return c;
  }
  return null;
}
function children(el: Element, local?: string): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(el.children)) {
    if (c.namespaceURI === W_NS && (!local || c.localName === local)) out.push(c);
  }
  return out;
}
function attr(el: Element | null, local: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W_NS, local) ?? el.getAttribute(`w:${local}`) ?? el.getAttribute(local);
}
function relAttr(el: Element | null, local: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(R_NS, local) ?? el.getAttribute(`r:${local}`) ?? el.getAttribute(local);
}

// Word usa half-points para sz e twentieths-of-a-point (dxa) para espaçamento.
function halfPtToPt(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n / 2 : null;
}
function dxaToPt(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n / 20 : null;
}

type StyleDef = {
  pStyle?: Record<string, string>;
  rStyle?: Record<string, string>;
};

function parseStylesXml(xml: string): { docDefaults: StyleDef; styles: Record<string, StyleDef & { basedOn?: string }> } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const docDefaults: StyleDef = { pStyle: {}, rStyle: {} };
  const rPrDefault = doc.getElementsByTagNameNS(W_NS, 'rPrDefault').item(0);
  if (rPrDefault) {
    const rpr = child(rPrDefault as Element, 'rPr');
    if (rpr) docDefaults.rStyle = readRPr(rpr);
  }
  const pPrDefault = doc.getElementsByTagNameNS(W_NS, 'pPrDefault').item(0);
  if (pPrDefault) {
    const ppr = child(pPrDefault as Element, 'pPr');
    if (ppr) docDefaults.pStyle = readPPr(ppr);
  }
  const styles: Record<string, StyleDef & { basedOn?: string }> = {};
  for (const st of Array.from(doc.getElementsByTagNameNS(W_NS, 'style'))) {
    const id = attr(st as Element, 'styleId') || '';
    if (!id) continue;
    const basedOn = attr(child(st as Element, 'basedOn'), 'val') || undefined;
    const pPr = child(st as Element, 'pPr');
    const rPr = child(st as Element, 'rPr');
    styles[id] = {
      basedOn,
      pStyle: pPr ? readPPr(pPr) : {},
      rStyle: rPr ? readRPr(rPr) : {},
    };
  }
  return { docDefaults, styles };
}

function readRPr(rPr: Element): Record<string, string> {
  const s: Record<string, string> = {};
  const rFonts = child(rPr, 'rFonts');
  const font = attr(rFonts, 'ascii') || attr(rFonts, 'hAnsi') || attr(rFonts, 'cs');
  if (font) s['font-family'] = `'${font.replace(/'/g, '')}'`;
  const sz = attr(child(rPr, 'sz'), 'val');
  const pt = halfPtToPt(sz);
  if (pt) s['font-size'] = `${pt}pt`;
  const color = attr(child(rPr, 'color'), 'val');
  if (color && color !== 'auto') s['color'] = `#${color}`;
  const b = child(rPr, 'b');
  if (b) {
    const v = attr(b, 'val');
    s['font-weight'] = v === 'false' || v === '0' ? 'normal' : 'bold';
  }
  const i = child(rPr, 'i');
  if (i) {
    const v = attr(i, 'val');
    s['font-style'] = v === 'false' || v === '0' ? 'normal' : 'italic';
  }
  const u = child(rPr, 'u');
  if (u) {
    const v = attr(u, 'val');
    if (v && v !== 'none') s['text-decoration'] = 'underline';
  }
  const strike = child(rPr, 'strike');
  if (strike) s['text-decoration'] = (s['text-decoration'] ? s['text-decoration'] + ' ' : '') + 'line-through';
  const highlight = attr(child(rPr, 'highlight'), 'val');
  if (highlight && highlight !== 'none') s['background-color'] = highlight;
  const shd = attr(child(rPr, 'shd'), 'fill');
  if (shd && shd !== 'auto') s['background-color'] = `#${shd}`;
  return s;
}

function readPPr(pPr: Element): Record<string, string> {
  const s: Record<string, string> = {};
  const jc = attr(child(pPr, 'jc'), 'val');
  if (jc) {
    const map: Record<string, string> = { left: 'left', center: 'center', right: 'right', both: 'justify', justify: 'justify', start: 'left', end: 'right' };
    if (map[jc]) s['text-align'] = map[jc];
  }
  const spacing = child(pPr, 'spacing');
  if (spacing) {
    const before = dxaToPt(attr(spacing, 'before'));
    const after = dxaToPt(attr(spacing, 'after'));
    if (before != null) s['margin-top'] = `${before}pt`;
    if (after != null) s['margin-bottom'] = `${after}pt`;
    const line = attr(spacing, 'line');
    const lineRule = attr(spacing, 'lineRule');
    if (line) {
      const n = parseFloat(line);
      if (lineRule === 'exact' || lineRule === 'atLeast') {
        s['line-height'] = `${n / 20}pt`;
      } else {
        s['line-height'] = `${n / 240}`; // auto: 240 = 1.0
      }
    }
  }
  const ind = child(pPr, 'ind');
  if (ind) {
    const left = dxaToPt(attr(ind, 'left') || attr(ind, 'start'));
    const right = dxaToPt(attr(ind, 'right') || attr(ind, 'end'));
    const firstLine = dxaToPt(attr(ind, 'firstLine'));
    const hanging = dxaToPt(attr(ind, 'hanging'));
    if (left != null) s['padding-left'] = `${left}pt`;
    if (right != null) s['padding-right'] = `${right}pt`;
    if (firstLine != null) s['text-indent'] = `${firstLine}pt`;
    if (hanging != null) s['text-indent'] = `-${hanging}pt`;
  }
  return s;
}

function mergeStyle(base: Record<string, string>, extra: Record<string, string>): Record<string, string> {
  return { ...base, ...extra };
}

function resolvePStyle(styles: Record<string, StyleDef & { basedOn?: string }>, id: string): StyleDef {
  const st = styles[id];
  if (!st) return { pStyle: {}, rStyle: {} };
  let base: StyleDef = { pStyle: {}, rStyle: {} };
  if (st.basedOn) base = resolvePStyle(styles, st.basedOn);
  return {
    pStyle: mergeStyle(base.pStyle || {}, st.pStyle || {}),
    rStyle: mergeStyle(base.rStyle || {}, st.rStyle || {}),
  };
}

function styleAttr(map: Record<string, string>): string {
  const entries = Object.entries(map).filter(([, v]) => v);
  if (!entries.length) return '';
  return ` style="${entries.map(([k, v]) => `${k}: ${String(v).replace(/"/g, '&quot;')}`).join('; ')}"`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderRun(r: Element, defaults: StyleDef, stylesMap: Record<string, StyleDef & { basedOn?: string }>): string {
  const rPr = child(r, 'rPr');
  let style: Record<string, string> = { ...(defaults.rStyle || {}) };
  // rStyle reference
  const rStyleRef = attr(child(rPr || r, 'rStyle'), 'val');
  if (rStyleRef) {
    const resolved = resolvePStyle(stylesMap, rStyleRef);
    style = mergeStyle(style, resolved.rStyle || {});
  }
  if (rPr) style = mergeStyle(style, readRPr(rPr));

  let text = '';
  for (const c of Array.from(r.children)) {
    if (c.namespaceURI !== W_NS) continue;
    if (c.localName === 't') text += escapeText(c.textContent || '');
    else if (c.localName === 'tab') text += '&nbsp;&nbsp;&nbsp;&nbsp;';
    else if (c.localName === 'br') text += attr(c as Element, 'type') === 'page' ? '<hr data-page-break="true" />' : '<br/>';
    else if (c.localName === 'noBreakHyphen') text += '&#8209;';
    else if (c.localName === 'sym') text += '';
  }
  if (!text) return '';
  return `<span${styleAttr(style)}>${text}</span>`;
}

function renderParagraph(p: Element, defaults: StyleDef, stylesMap: Record<string, StyleDef & { basedOn?: string }>, numbering: NumberingCtx): string {
  const pPr = child(p, 'pPr');
  let pStyle: Record<string, string> = { ...(defaults.pStyle || {}) };
  let rDefaults: StyleDef = { rStyle: { ...(defaults.rStyle || {}) } };

  const pStyleRef = attr(child(pPr || p, 'pStyle'), 'val');
  if (pStyleRef) {
    const resolved = resolvePStyle(stylesMap, pStyleRef);
    pStyle = mergeStyle(pStyle, resolved.pStyle || {});
    rDefaults = { rStyle: mergeStyle(rDefaults.rStyle || {}, resolved.rStyle || {}) };
  }
  if (pPr) {
    pStyle = mergeStyle(pStyle, readPPr(pPr));
    const rInPPr = child(pPr, 'rPr');
    if (rInPPr) rDefaults = { rStyle: mergeStyle(rDefaults.rStyle || {}, readRPr(rInPPr)) };
  }

  const pageBreakOnly = qAll(p, 'br').some((br) => attr(br, 'type') === 'page') && !qAll(p, 't').some((t) => (t.textContent || '').trim());
  if (pageBreakOnly) return '<hr data-page-break="true" />';

  // Runs
  let inner = '';
  for (const c of children(p)) {
    if (c.localName === 'r') inner += renderRun(c, rDefaults, stylesMap);
    else if (c.localName === 'hyperlink') {
      let sub = '';
      for (const rr of children(c, 'r')) sub += renderRun(rr, rDefaults, stylesMap);
      inner += `<a>${sub}</a>`;
    }
  }
  if (!inner) inner = '<br/>';

  // Lista?
  const numPr = pPr ? child(pPr, 'numPr') : null;
  if (numPr) {
    const numId = attr(child(numPr, 'numId'), 'val');
    const ilvl = attr(child(numPr, 'ilvl'), 'val') || '0';
    const kind = numbering.kindFor(numId, ilvl);
    return `<li data-list="${kind}"${styleAttr(pStyle)}>${inner}</li>`;
  }

  return `<p${styleAttr(pStyle)}>${inner}</p>`;
}

// ------ Numbering (mínimo: bullet vs decimal) ---------------------------
type NumberingCtx = { kindFor: (numId: string | null, ilvl: string) => 'bullet' | 'ordered' };

function parseNumbering(xml: string | undefined): NumberingCtx {
  if (!xml) return { kindFor: () => 'bullet' };
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const abstractMap: Record<string, Record<string, 'bullet' | 'ordered'>> = {};
  for (const a of Array.from(doc.getElementsByTagNameNS(W_NS, 'abstractNum'))) {
    const id = attr(a as Element, 'abstractNumId') || '';
    const levels: Record<string, 'bullet' | 'ordered'> = {};
    for (const lvl of qAll(a as Element, 'lvl')) {
      const ilvl = attr(lvl, 'ilvl') || '0';
      const fmt = attr(child(lvl, 'numFmt'), 'val') || 'decimal';
      levels[ilvl] = fmt === 'bullet' ? 'bullet' : 'ordered';
    }
    abstractMap[id] = levels;
  }
  const numToAbstract: Record<string, string> = {};
  for (const n of Array.from(doc.getElementsByTagNameNS(W_NS, 'num'))) {
    const id = attr(n as Element, 'numId') || '';
    const ref = attr(child(n as Element, 'abstractNumId'), 'val') || '';
    numToAbstract[id] = ref;
  }
  return {
    kindFor: (numId, ilvl) => {
      if (!numId) return 'bullet';
      const abs = numToAbstract[numId];
      if (!abs) return 'bullet';
      return abstractMap[abs]?.[ilvl] || 'bullet';
    },
  };
}

// Agrupa <li> sequenciais em <ul>/<ol>
function wrapLists(html: string): string {
  const parts = html.split(/(?=<li |<p |<table)/g);
  const out: string[] = [];
  let buf: string[] = [];
  let bufKind: 'bullet' | 'ordered' | null = null;
  const flush = () => {
    if (!buf.length) return;
    const tag = bufKind === 'ordered' ? 'ol' : 'ul';
    out.push(`<${tag}>${buf.join('')}</${tag}>`);
    buf = [];
    bufKind = null;
  };
  for (const seg of parts) {
    const m = seg.match(/^<li data-list="(bullet|ordered)"/);
    if (m) {
      const kind = m[1] as 'bullet' | 'ordered';
      if (bufKind && bufKind !== kind) flush();
      bufKind = kind;
      buf.push(seg.replace(/^<li data-list="(?:bullet|ordered)"/, '<li'));
    } else {
      flush();
      out.push(seg);
    }
  }
  flush();
  return out.join('');
}

function renderTable(tbl: Element, defaults: StyleDef, stylesMap: Record<string, StyleDef & { basedOn?: string }>, numbering: NumberingCtx): string {
  const tblPr = child(tbl, 'tblPr');
  const tableStyle: Record<string, string> = { 'border-collapse': 'collapse', 'table-layout': 'fixed' };
  const tblW = tblPr ? child(tblPr, 'tblW') : null;
  if (tblW && attr(tblW, 'type') === 'dxa') {
    const pt = dxaToPt(attr(tblW, 'w'));
    if (pt) tableStyle.width = `${pt}pt`;
  }

  const grid = child(tbl, 'tblGrid');
  const gridWidths = grid ? children(grid, 'gridCol').map((gc) => attr(gc, 'w')).filter(Boolean) as string[] : [];
  const colgroup = gridWidths.length
    ? `<colgroup>${gridWidths.map((w) => `<col style="width: ${dxaToPt(w) || 0}pt" />`).join('')}</colgroup>`
    : '';

  const tableBorder = readBorderCss(tblPr ? child(tblPr, 'tblBorders') : null);
  let rows = '';
  for (const tr of children(tbl, 'tr')) {
    let cells = '';
    const rowStyle: Record<string, string> = {};
    for (const [cellIndex, tc] of children(tr, 'tc').entries()) {
      const tcStyle: Record<string, string> = { ...(tableBorder ? { border: tableBorder } : {}) };
      const tcPr = child(tc, 'tcPr');
      if (tcPr) {
        const w = attr(child(tcPr, 'tcW'), 'w');
        const type = attr(child(tcPr, 'tcW'), 'type');
        if (w && type === 'dxa') {
          const pt = dxaToPt(w);
          if (pt) tcStyle['width'] = `${pt}pt`;
        } else if (w && type === 'pct') {
          tcStyle['width'] = `${parseFloat(w) / 50}%`;
        }
        const shd = attr(child(tcPr, 'shd'), 'fill');
        if (shd && shd !== 'auto') tcStyle['background-color'] = `#${shd}`;
        const tcMar = child(tcPr, 'tcMar');
        if (tcMar) {
          const top = dxaToPt(attr(child(tcMar, 'top'), 'w'));
          const right = dxaToPt(attr(child(tcMar, 'right'), 'w'));
          const bottom = dxaToPt(attr(child(tcMar, 'bottom'), 'w'));
          const left = dxaToPt(attr(child(tcMar, 'left'), 'w'));
          const parts = [top ?? 0, right ?? 4, bottom ?? 0, left ?? 4].map((n) => `${n}pt`);
          tcStyle.padding = parts.join(' ');
        }
      } else if (gridWidths[cellIndex]) {
        const pt = dxaToPt(gridWidths[cellIndex]);
        if (pt) tcStyle.width = `${pt}pt`;
      }
      let inner = '';
      for (const c of children(tc)) {
        if (c.localName === 'p') inner += renderParagraph(c, defaults, stylesMap, numbering);
        else if (c.localName === 'tbl') inner += renderTable(c, defaults, stylesMap, numbering);
      }
      cells += `<td${styleAttr(tcStyle)}>${wrapLists(inner)}</td>`;
    }
    rows += `<tr${styleAttr(rowStyle)}>${cells}</tr>`;
  }
  return `<table${styleAttr(tableStyle)}>${colgroup}<tbody>${rows}</tbody></table>`;
}

function readBorderCss(borders: Element | null): string | null {
  if (!borders) return null;
  const top = child(borders, 'top') || child(borders, 'left') || child(borders, 'insideH');
  const val = attr(top, 'val');
  if (!top || !val || val === 'nil' || val === 'none') return null;
  const sz = parseFloat(attr(top, 'sz') || '4');
  const pt = Number.isFinite(sz) ? Math.max(sz / 8, 0.5) : 0.5;
  const rawColor = attr(top, 'color');
  const color = !rawColor || rawColor === 'auto' ? '#000' : `#${rawColor}`;
  return `${pt}pt solid ${color}`;
}

function parseDocumentRels(xml: string | undefined): Record<string, string> {
  if (!xml) return {};
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out: Record<string, string> = {};
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) out[id] = target;
  }
  return out;
}

function renderHeader(zip: PizZip, sectPr: Element | null, defaults: StyleDef, stylesMap: Record<string, StyleDef & { basedOn?: string }>, numbering: NumberingCtx): string {
  const headerRef = sectPr ? child(sectPr, 'headerReference') : null;
  const relId = relAttr(headerRef, 'id');
  if (!relId) return '';
  const rels = parseDocumentRels(zip.file('word/_rels/document.xml.rels')?.asText());
  const target = rels[relId];
  if (!target) return '';
  const path = target.startsWith('/') ? target.replace(/^\//, '') : `word/${target.replace(/^\.\//, '')}`;
  const headerXml = zip.file(path)?.asText();
  if (!headerXml) return '';
  const headerDoc = new DOMParser().parseFromString(headerXml, 'application/xml');
  let html = '';
  for (const p of Array.from(headerDoc.getElementsByTagNameNS(W_NS, 'p'))) {
    html += renderParagraph(p as Element, defaults, stylesMap, numbering);
  }
  return html ? `<div data-docx-header="true" style="margin-bottom: 24pt">${html}</div>` : '';
}

export async function docxParaHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = new PizZip(arrayBuffer);
  const documentXml = zip.file('word/document.xml')?.asText();
  if (!documentXml) throw new Error('DOCX inválido: word/document.xml não encontrado');
  const stylesXml = zip.file('word/styles.xml')?.asText();
  const numberingXml = zip.file('word/numbering.xml')?.asText();

  const { docDefaults, styles } = stylesXml
    ? parseStylesXml(stylesXml)
    : { docDefaults: { pStyle: {}, rStyle: {} }, styles: {} };
  const numbering = parseNumbering(numberingXml);

  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W_NS, 'body').item(0);
  if (!body) return '';
  const sectPr = child(body as Element, 'sectPr');

  let html = renderHeader(zip, sectPr, docDefaults, styles, numbering);
  for (const c of children(body as Element)) {
    if (c.localName === 'p') html += renderParagraph(c, docDefaults, styles, numbering);
    else if (c.localName === 'tbl') html += renderTable(c, docDefaults, styles, numbering);
  }
  return wrapLists(html);
}

export function preencherHtmlComVariaveis(html: string, valores: Record<string, string>): string {
  // 1) Placeholders cujo valor contém quebras de linha (ex.: ENTREGAVEIS) são
  // expandidos em múltiplos parágrafos alinhados à esquerda, dividindo o <p>
  // pai. Isso evita que a justificação do parágrafo original estique linhas
  // intermediárias (o Word só não estica a última linha antes de <w:br/>).
  let out = html;
  const multi = Object.entries(valores).filter(
    ([, v]) => typeof v === 'string' && /\n/.test(v as string),
  );
  for (const [k, v] of multi) {
    const linhas = String(v)
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!linhas.length) continue;
    const bloco = linhas
      .map(
        (l) =>
          `<p style="text-align:left;margin:2pt 0">${escapeHtml(l)}</p>`,
      )
      .join('');
    const escKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<p([^>]*)>([\\s\\S]*?)\\{\\{\\s*${escKey}\\s*\\}\\}([\\s\\S]*?)</p>`,
      'gi',
    );
    out = out.replace(re, (_m, attrs: string, antes: string, depois: string) => {
      const antesLimpo = antes.replace(/(?:&nbsp;|\s|<br\s*\/?>)+$/i, '');
      const depoisLimpo = depois.replace(/^(?:&nbsp;|\s|<br\s*\/?>)+/i, '');
      const antesP = antesLimpo.trim() ? `<p${attrs}>${antesLimpo}</p>` : '';
      const depoisP = depoisLimpo.trim() ? `<p${attrs}>${depoisLimpo}</p>` : '';
      return `${antesP}${bloco}${depoisP}`;
    });
  }
  // 2) Substitui os placeholders restantes normalmente (com escape de HTML).
  return out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_all, nome) => {
    const chave = String(nome).trim();
    if (chave in valores) return escapeHtml(valores[chave] ?? '');
    // tenta case-insensitive
    const found = Object.keys(valores).find((k) => k.toUpperCase() === chave.toUpperCase());
    if (found) return escapeHtml(valores[found] ?? '');
    return `{{${chave}}}`;
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

function envolverHtmlParaDocx(html: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
    h1 { font-size: 18pt; margin: 12pt 0 6pt; }
    h2 { font-size: 14pt; margin: 10pt 0 6pt; }
    h3 { font-size: 12pt; margin: 8pt 0 4pt; }
    h4, h5 { font-size: 11pt; margin: 6pt 0 3pt; }
    p { margin: 4pt 0; text-align: justify; }
    ul, ol { margin: 4pt 0 4pt 20pt; }
    li { margin: 2pt 0; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0; }
    td, th { border: 1px solid #666; padding: 6px; vertical-align: top; }
    blockquote { margin: 6pt 20pt; font-style: italic; color: #333; border-left: 3px solid #ccc; padding-left: 10pt; }
    strong, b { font-weight: bold; }
    em, i { font-style: italic; }
    u { text-decoration: underline; }
  </style></head><body>${html}</body></html>`;
}

export async function htmlComoDocxBlob(html: string): Promise<Blob> {
  const result = await asBlob(envolverHtmlParaDocx(html));
  const blob = result instanceof Blob
    ? result
    : new Blob([result as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return injetarMarcaDagua(blob);
}

export async function baixarHtmlComoDocx(html: string, nomeArquivo: string) {
  const blob = await htmlComoDocxBlob(html);
  saveAs(blob, nomeArquivo.endsWith('.docx') ? nomeArquivo : `${nomeArquivo}.docx`);
}

export function baixarHtmlComoHtml(html: string, nomeArquivo: string) {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  const blob = new Blob([wrapped], { type: 'text/html;charset=utf-8' });
  saveAs(blob, nomeArquivo.endsWith('.html') ? nomeArquivo : `${nomeArquivo}.html`);
}

// ---------------------------------------------------------------------------
// Preenche o DOCX ORIGINAL substituindo apenas {{VAR}} — preserva 100% da
// formatação (fontes, tamanhos, alinhamento, cabeçalhos, tabelas, etc).
// Usa docxtemplater sobre o arquivo Word real, sem passar por HTML.
// ---------------------------------------------------------------------------
export function preencherDocxOriginal(
  arrayBuffer: ArrayBuffer,
  valores: Record<string, string>,
): Blob {
  const zip = new PizZip(arrayBuffer);

  // Mapa normalizado (case/acento-insensível) para casar com variantes das chaves
  const mapa: Record<string, string> = {};
  for (const [k, v] of Object.entries(valores || {})) {
    const key = normalizarVariavel(k);
    if (key) mapa[key] = v ?? '';
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '',
    parser: (tag: string) => ({
      get: () => {
        const key = normalizarVariavel(tag);
        return mapa[key] ?? '';
      },
    }),
  });

  doc.render();
  const out = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
  return out as Blob;
}

export async function preencherDocxOriginalComMarcaDagua(
  arrayBuffer: ArrayBuffer,
  valores: Record<string, string>,
): Promise<Blob> {
  const blob = preencherDocxOriginal(arrayBuffer, valores);
  return injetarMarcaDagua(blob);
}