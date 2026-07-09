import mammoth from 'mammoth';
// @ts-ignore - html-docx-js has no bundled types
import htmlDocx from 'html-docx-js/dist/html-docx';
import { saveAs } from 'file-saver';

export async function docxParaHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    },
  );
  return result.value;
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

export function baixarHtmlComoDocx(html: string, nomeArquivo: string) {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
    h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
    table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #999; padding: 6px; }
    p { margin: 6px 0; }
  </style></head><body>${html}</body></html>`;
  const blob = htmlDocx.asBlob(wrapped);
  saveAs(blob, nomeArquivo.endsWith('.docx') ? nomeArquivo : `${nomeArquivo}.docx`);
}

export function baixarHtmlComoHtml(html: string, nomeArquivo: string) {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  const blob = new Blob([wrapped], { type: 'text/html;charset=utf-8' });
  saveAs(blob, nomeArquivo.endsWith('.html') ? nomeArquivo : `${nomeArquivo}.html`);
}