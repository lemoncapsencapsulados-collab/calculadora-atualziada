import { useState, useEffect, useRef } from 'react';
import { gerarFichaTecnicaPDFBlob, gerarFichaTecnicaDownload } from '@/lib/pdfGenerator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, ExternalLink, Printer } from 'lucide-react';

interface FichaTecnicaDialogProps {
  pedido: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FichaTecnicaDialog({ pedido, open, onOpenChange }: FichaTecnicaDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open || !pedido) return;
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const blob = gerarFichaTecnicaPDFBlob(pedido);
        if (!isMounted) return;
        if (!blob || blob.size === 0) throw new Error('PDF vazio');
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        objectUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        if (isMounted) setError(`Erro ao gerar PDF: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    };
  }, [open, pedido]);

  const handleDownload = () => gerarFichaTecnicaDownload(pedido);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleOpenNewTab = () => { if (pdfUrl) window.open(pdfUrl, '_blank'); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Ficha Técnica — {pedido?.numero_pedido}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Gerando preview...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-destructive mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF diretamente
                </Button>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="flex flex-col h-full">
              <iframe ref={iframeRef} src={pdfUrl} className="w-full flex-1" title="Preview Ficha Técnica" />
              <div className="flex justify-center py-2 bg-muted/50 border-t">
                <Button variant="link" size="sm" onClick={handleOpenNewTab} className="text-xs text-muted-foreground">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Não consegue ver? Abrir em nova aba
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="outline" onClick={handlePrint} disabled={isLoading}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleDownload} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
