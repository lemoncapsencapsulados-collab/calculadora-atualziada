import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Send, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { renderDocxComVariaveis, blobToBase64 } from '@/lib/contratoDocx';
import { ContratoModelo } from '@/hooks/useContratoModelos';

// SuperDoc (estilo Word no navegador)
// Carregamento dinâmico para evitar bundling pesado quando o dialog não está aberto.

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  modelo: ContratoModelo | null;
  variaveis: Record<string, string>;
  /** Chamado com o blob .docx final editado (para envio à ZapSign). */
  onEnviar: (docxBlobBase64: string, fileName: string) => Promise<void> | void;
}

export function EditorContratoDocxDialog({ open, onOpenChange, modelo, variaveis, onEnviar }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const superdocRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    if (!modelo?.docx_path) {
      setErro('Este modelo não tem documento Word cadastrado. Vá em Configuração de Contratos e envie o .docx.');
      return;
    }

    let destroyed = false;
    let createdInstance: any = null;

    (async () => {
      setLoading(true);
      try {
        // 1. Baixar o .docx do storage
        const { data: signed, error: sErr } = await supabase.storage.from('contratos').createSignedUrl(modelo.docx_path!, 300);
        if (sErr || !signed) throw new Error('Não foi possível baixar o modelo.');
        const resp = await fetch(signed.signedUrl);
        const baseBuf = await resp.arrayBuffer();

        // 2. Mesclar variáveis -> .docx pronto
        const mergedBlob = await renderDocxComVariaveis(baseBuf, variaveis);

        // 3. Inicializar SuperDoc no container
        const { SuperDoc } = await import('@harbour-enterprises/superdoc');
        await import('@harbour-enterprises/superdoc/style.css' as any).catch(() => null);

        if (destroyed || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        const file = new File([mergedBlob], modelo.docx_nome || 'contrato.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        createdInstance = new SuperDoc({
          selector: containerRef.current,
          document: file,
          documentMode: 'editing',
          pagination: true,
          rulers: false,
          toolbar: '#superdoc-toolbar',
        });
        superdocRef.current = createdInstance;
      } catch (e: any) {
        console.error('SuperDoc init error:', e);
        setErro(e?.message || 'Falha ao carregar o editor');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      destroyed = true;
      try { createdInstance?.destroy?.(); } catch { /* ignore */ }
      superdocRef.current = null;
    };
  }, [open, modelo?.id]);

  const enviar = async () => {
    if (!superdocRef.current) {
      toast.error('Editor não carregado.');
      return;
    }
    setEnviando(true);
    try {
      const result: any = await superdocRef.current.export({ exportType: 'docx' });
      // export pode retornar Blob[] (para múltiplos docs) ou Blob
      const blob: Blob = Array.isArray(result) ? result[0] : result;
      if (!blob || !(blob instanceof Blob)) throw new Error('Falha ao exportar documento editado.');
      const base64 = await blobToBase64(blob);
      const fileName = (modelo?.docx_nome || 'contrato').replace(/\.docx$/i, '') + '_editado.docx';
      await onEnviar(base64, fileName);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao enviar: ' + (e?.message || 'desconhecido'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Editor de Contrato — {modelo?.nome}
          </DialogTitle>
        </DialogHeader>

        <div id="superdoc-toolbar" className="border-b bg-muted/30 px-2 py-1 min-h-[44px]" />

        <div className="flex-1 min-h-0 overflow-auto bg-muted/20">
          {erro ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="max-w-md text-center space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
                <p className="text-sm font-semibold">Não foi possível abrir o editor</p>
                <p className="text-xs text-muted-foreground">{erro}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Renderizando contrato...</span>
            </div>
          ) : null}
          <div ref={containerRef} className="min-h-full" />
        </div>

        <DialogFooter className="px-4 py-3 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando || loading || !!erro}>
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar para ZapSign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}