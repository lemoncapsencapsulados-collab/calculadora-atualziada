import { useState, useEffect, useRef } from 'react';
import { Orcamento } from '@/types/orcamento';
import { generateOrcamentoPDFBlob, generateOrcamentoPDF } from '@/lib/orcamentoGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, AlertCircle } from 'lucide-react';

interface PreviewPdfDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
}

export default function PreviewPdfDialog({
  orcamento,
  onClose,
}: PreviewPdfDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Iniciando geração do PDF preview...');
        const blob = await generateOrcamentoPDFBlob(orcamento);
        
        if (!isMounted) return;
        
        if (!blob || blob.size === 0) {
          throw new Error('Blob do PDF está vazio');
        }
        
        console.log('PDF gerado com sucesso, tamanho:', blob.size);
        
        // Limpar URL anterior se existir
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        console.error('Erro ao gerar preview:', err);
        if (isMounted) {
          setError(`Erro ao gerar PDF: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [orcamento]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await generateOrcamentoPDF(orcamento);
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Preview do Orçamento
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
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="Preview do PDF"
            />
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading || isLoading}>
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Baixando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
