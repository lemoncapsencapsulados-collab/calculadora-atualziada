import { useState, useEffect, useRef } from 'react';
import { Orcamento } from '@/types/orcamento';
import { generateOrcamentoPDFBlob, generateOrcamentoPDF } from '@/lib/orcamentoGenerator';
import { nomeArquivoOrcamentoCliente } from '@/lib/nomeArquivo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, ExternalLink } from 'lucide-react';

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
        
        // Criar blob com type explícito para garantir exibição correta
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
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
      await generateOrcamentoPDF(orcamento, {
        nomeArquivo: nomeArquivoOrcamentoCliente(orcamento.nome_cliente, orcamento.created_at),
      });
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
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
                <p className="text-sm text-destructive mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF diretamente
                </Button>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="flex flex-col h-full">
              <iframe
                src={pdfUrl}
                className="w-full flex-1"
                title="Preview do PDF"
              />
              <div className="flex justify-center py-2 bg-muted/50 border-t">
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleOpenNewTab}
                  className="text-xs text-muted-foreground"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Não consegue ver? Abrir em nova aba
                </Button>
              </div>
            </div>
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