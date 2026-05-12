import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Eye, Download, Trash2, Receipt, FileSignature } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PedidoAnexo, downloadAnexo } from '@/hooks/usePedidoAnexos';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedidoNumero?: string;
  contratos: PedidoAnexo[];
  comprovantes: PedidoAnexo[];
  onAdicionar: (tipo: 'contrato' | 'comprovante') => void;
  onRemover: (anexo: PedidoAnexo) => void;
}

function getExt(nome: string) {
  const m = nome.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export function DocumentosPedidoDialog({
  open, onOpenChange, pedidoNumero, contratos, comprovantes, onAdicionar, onRemover,
}: Props) {
  const [preview, setPreview] = useState<PedidoAnexo | null>(null);

  const renderLista = (lista: PedidoAnexo[], vazio: string) => (
    <div className="space-y-2">
      {lista.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">{vazio}</p>
      )}
      {lista.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 p-3 border rounded-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.arquivo_nome}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" title="Visualizar" onClick={() => setPreview(a)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Baixar" onClick={() => downloadAnexo(a)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" title="Remover" onClick={() => onRemover(a)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  const ext = preview ? getExt(preview.arquivo_nome) : '';
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentos {pedidoNumero ? `— ${pedidoNumero}` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 max-h-[65vh] overflow-y-auto">
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  Contratos ({contratos.length})
                </h3>
                <Button size="sm" variant="outline" onClick={() => onAdicionar('contrato')}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
              {renderLista(contratos, 'Nenhum contrato anexado.')}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Comprovantes de Pagamento ({comprovantes.length})
                </h3>
                <Button size="sm" variant="outline" onClick={() => onAdicionar('comprovante')}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
              {renderLista(comprovantes, 'Nenhum comprovante anexado.')}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.arquivo_nome}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="w-full">
              {isPdf && (
                <iframe src={preview.arquivo_url} className="w-full h-[75vh] rounded border" title={preview.arquivo_nome} />
              )}
              {isImg && (
                <img src={preview.arquivo_url} alt={preview.arquivo_nome} className="max-h-[75vh] mx-auto object-contain" />
              )}
              {!isPdf && !isImg && (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm text-muted-foreground">Visualização indisponível para este formato.</p>
                  <Button onClick={() => downloadAnexo(preview)}>
                    <Download className="h-4 w-4 mr-1" /> Baixar arquivo
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => downloadAnexo(preview)}>
                  <Download className="h-4 w-4 mr-1" /> Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}