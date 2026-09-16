import html2canvas from 'html2canvas';

export async function renderElementToPngBlob(el: HTMLElement): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
  const dataUrl = canvas.toDataURL('image/png');
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), 'image/png');
  });
  return { blob, dataUrl };
}

export async function exportElementAsPng(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}