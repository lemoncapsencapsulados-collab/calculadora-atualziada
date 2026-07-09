import mammoth from 'mammoth';
import { asBlob } from 'html-docx-js-typescript';
import { saveAs } from 'file-saver';

export async function docxParaHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  // Mammoth por padrão preserva bold/italic mas descarta alinhamento, underline
  // e algumas classes. Usamos transformDocument para carimbar o alinhamento em
  // parágrafos "Normal" e depois convertemos as classes resultantes em
  // style="text-align: X" para que o TipTap (extensão TextAlign) reconheça.
  const paragraphTransform = (mammoth as any).transforms?.paragraph
    ? (mammoth as any).transforms.paragraph((paragraph: any) => {
        const align = paragraph.alignment;
        if (!align || align === 'left') return paragraph;
        // Não sobrescreve estilos existentes (headings, títulos etc.)
        if (paragraph.styleName) return paragraph;
        const map: Record<string, string> = {
          center: 'AlignCenter',
          right: 'AlignRight',
          justify: 'AlignJustify',
          both: 'AlignJustify',
        };
        const name = map[align];
        if (!name) return paragraph;
        return { ...paragraph, styleName: name };
      })
    : undefined;

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1.doc-title:fresh",
        "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote.intense:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        "p[style-name='AlignCenter'] => p.align-center:fresh",
        "p[style-name='AlignRight'] => p.align-right:fresh",
        "p[style-name='AlignJustify'] => p.align-justify:fresh",
      ],
      transformDocument: paragraphTransform,
    } as any,
  );

  let html = result.value || '';
  // Converte classes de alinhamento em inline style (compatível com TipTap TextAlign)
  html = html
    .replace(/<p class="align-center">/g, '<p style="text-align: center">')
    .replace(/<p class="align-right">/g, '<p style="text-align: right">')
    .replace(/<p class="align-justify">/g, '<p style="text-align: justify">');
  return html;
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