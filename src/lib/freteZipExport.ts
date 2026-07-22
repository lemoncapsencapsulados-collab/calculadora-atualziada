import JSZip from 'jszip';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import CotacaoExportCard from '@/components/frete/CotacaoExportCard';
import { renderElementToPngBlob } from './freteImageExport';
import { FreteCotacao } from '@/types/frete';

export interface CotacaoZipItem {
  cotacao: FreteCotacao;
  produtor: string;
  numeroOrc: string;
}

/** Renderiza cada cotação off-screen, converte em PNG e empacota tudo num .zip. */
export async function exportCotacoesAsZip(
  items: CotacaoZipItem[],
  zipFilename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (items.length === 0) throw new Error('Nenhuma cotação para exportar');
  const zip = new JSZip();

  // Container off-screen compartilhado.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const mount = document.createElement('div');
      host.appendChild(mount);
      const root = createRoot(mount);

      const captured = await new Promise<HTMLElement>((resolve) => {
        const refCb = (el: HTMLDivElement | null) => {
          if (el) requestAnimationFrame(() => resolve(el));
        };
        root.render(
          createElement(CotacaoExportCard, {
            ref: refCb,
            cotacao: item.cotacao,
            produtor: item.produtor,
            numeroOrc: item.numeroOrc,
          } as any),
        );
      });

      // Pequeno delay para garantir layout final antes do html2canvas.
      await new Promise((r) => setTimeout(r, 80));
      const { blob } = await renderElementToPngBlob(captured);

      const safeProd = (item.cotacao.nome_produto || item.cotacao.tipo_produto || 'produto')
        .toString()
        .replace(/[^\w-]+/g, '_');
      const safeOrc = (item.numeroOrc || 'orc').toString().replace(/[^\w-]+/g, '_');
      const safeProdutor = (item.produtor || 'produtor').toString().replace(/[^\w-]+/g, '_');
      const filename = `${safeProdutor}/${safeOrc}_${safeProd}.png`;
      zip.file(filename, blob);

      root.unmount();
      mount.remove();
      onProgress?.(i + 1, items.length);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    host.remove();
  }
}