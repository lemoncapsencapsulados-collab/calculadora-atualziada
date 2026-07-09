import PizZip from 'pizzip';
import { asBlob } from 'html-docx-js-typescript';
import { saveAs } from 'file-saver';

// ---------------------------------------------------------------------------
// Conversor OOXML → HTML de alta fidelidade
// Preserva fonte, tamanho, cor, negrito/itálico/sublinhado, alinhamento,
// espaçamento, recuo, listas e tabelas — usando estilos inline para que o
// editor TipTap mantenha a formatação idêntica ao arquivo Word original.
// ---------------------------------------------------------------------------

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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
  if (font) s['font-family'] = `"${font}"`;
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
  return ` style="${entries.map(([k, v]) => `${k}: ${v}`).join('; ')}"`;
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
    else if (c.localName === 'br') text += '<br/>';
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
  let rows = '';
  for (const tr of children(tbl, 'tr')) {
    let cells = '';
    for (const tc of children(tr, 'tc')) {
      const tcStyle: Record<string, string> = {};
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
      }
      let inner = '';
      for (const c of children(tc)) {
        if (c.localName === 'p') inner += renderParagraph(c, defaults, stylesMap, numbering);
        else if (c.localName === 'tbl') inner += renderTable(c, defaults, stylesMap, numbering);
      }
      cells += `<td${styleAttr(tcStyle)}>${wrapLists(inner)}</td>`;
    }
    rows += `<tr>${cells}</tr>`;
  }
  return `<table><tbody>${rows}</tbody></table>`;
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

  let html = '';
  for (const c of children(body as Element)) {
    if (c.localName === 'p') html += renderParagraph(c, docDefaults, styles, numbering);
    else if (c.localName === 'tbl') html += renderTable(c, docDefaults, styles, numbering);
  }
  return wrapLists(html);
}

export function preencherHtmlComVariaveis(html: string, valores: Record<string, string>): string {
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_all, nome) => {
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

export async function baixarHtmlComoDocx(html: string, nomeArquivo: string) {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
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
  const result = await asBlob(wrapped);
  const blob = result instanceof Blob ? result : new Blob([result as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  saveAs(blob, nomeArquivo.endsWith('.docx') ? nomeArquivo : `${nomeArquivo}.docx`);
}

export function baixarHtmlComoHtml(html: string, nomeArquivo: string) {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  const blob = new Blob([wrapped], { type: 'text/html;charset=utf-8' });
  saveAs(blob, nomeArquivo.endsWith('.html') ? nomeArquivo : `${nomeArquivo}.html`);
}