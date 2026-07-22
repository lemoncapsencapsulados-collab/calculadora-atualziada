import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Copy, ImageIcon } from 'lucide-react';
import { FreteCotacao } from '@/types/frete';
import { renderElementToPngBlob } from '@/lib/freteImageExport';
import CotacaoExportCard from './CotacaoExportCard';
import { toast } from 'sonner';

interface Props {
  cotacao: FreteCotacao;
  produtor: string;
  numeroOrc: string;
  onClose: () => void;
}

export default function CotacaoPreviewDialog({ cotacao, produtor, numeroOrc, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const filename = `frete_${numeroOrc}_${cotacao.nome_produto || cotacao.tipo_produto || 'produto'}`.replace(/[^\w-]+/g, '_') + '.png';

  useEffect(() => {
    let alive = true;
    (async () => {
      // aguarda o card montar
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 60));
      if (!alive || !cardRef.current) return;
      try {
        const { blob, dataUrl } = await renderElementToPngBlob(cardRef.current);
        if (!alive) return;
        setBlob(blob);
        setDataUrl(dataUrl);
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao gerar prévia');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copiar = async () => {
    if (!blob) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('Navegador não suporta cópia de imagem');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Imagem copiada');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível copiar');
    }
  };

  const baixar = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download iniciado');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Prévia da cotação de frete
          </DialogTitle>
          <DialogDescription>
            {produtor} · Orçamento {numeroOrc}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center min-h-[240px] overflow-auto">
          {loading && !dataUrl ? (
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Gerando prévia...
            </div>
          ) : dataUrl ? (
            <img src={dataUrl} alt="Prévia da cotação" className="max-w-full h-auto rounded" />
          ) : null}
        </div>

        {/* Card renderizado off-screen para captura */}
        <div style={{ position: 'fixed', left: '-10000px', top: 0 }} aria-hidden>
          <CotacaoExportCard
            ref={cardRef}
            cotacao={cotacao}
            produtor={produtor}
            numeroOrc={numeroOrc}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button variant="outline" onClick={copiar} disabled={loading || !blob}>
            <Copy className="w-4 h-4 mr-2" />
            Copiar imagem
          </Button>
          <Button onClick={baixar} disabled={loading || !dataUrl}>
            <Download className="w-4 h-4 mr-2" />
            Baixar imagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}