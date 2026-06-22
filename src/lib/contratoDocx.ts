import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Lê um arquivo .docx e retorna um Uint8Array (ArrayBuffer)
 */
export async function fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

/**
 * Detecta placeholders no formato {variavel} ou {{variavel}} dentro de um .docx
 */
export async function detectarVariaveisDocx(file: File | Blob): Promise<string[]> {
  const buf = await fileToArrayBuffer(file);
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml')?.asText() || '';
  const stripped = xml.replace(/<[^>]+>/g, '');
  const found = new Set<string>();
  const re1 = /\{\{\s*([\w.\-]+)\s*\}\}/g;
  const re2 = /\{\s*([\w.\-]+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(stripped))) found.add(m[1]);
  while ((m = re2.exec(stripped))) found.add(m[1]);
  return Array.from(found);
}

/**
 * Renderiza um .docx mesclando variáveis usando docxtemplater.
 * Aceita placeholders no formato {variavel} (delimitadores padrão).
 */
export async function renderDocxComVariaveis(
  docxBuffer: ArrayBuffer,
  variaveis: Record<string, string>,
): Promise<Blob> {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
    nullGetter: () => '',
  });
  // Suporta {{x}} também: pré-processa o XML
  // (Docxtemplater faz isso com delimiters customizados, mas {{ }} requer outro setup;
  //  então, primeiro substituímos {{x}} por {x} no XML)
  // Como docxtemplater não expõe o zip pronto, fazemos um pre-pass manual:
  // converte {{var}} -> {var} em todos os arquivos xml relevantes
  ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml']
    .forEach((p) => {
      const f = zip.file(p);
      if (f) {
        const txt = f.asText().replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, '{$1}');
        zip.file(p, txt);
      }
    });
  // recria docxtemplater após preprocess
  const doc2 = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
    nullGetter: () => '',
  });
  doc2.render(variaveis);
  const out = doc2.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return out;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}