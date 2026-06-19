import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Eye, Download, Trash2, Receipt, FileSignature, ArrowUp, ArrowDown, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PedidoAnexo, downloadAnexo, ANEXO_LIMITES } from '@/hooks/usePedidoAnexos';
import { Pedido } from '@/types/formula';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedidoNumero?: string;
  pedidoId?: string;
  pedido?: Pedido | null;
  contratos: PedidoAnexo[];
  comprovantes: PedidoAnexo[];
  onAdicionar: (tipo: 'contrato' | 'comprovante') => void;
  onRemover: (anexo: PedidoAnexo) => void;
  onReordenar?: (pedidoId: string, tipo: 'contrato' | 'comprovante', novaOrdemIds: string[]) => void;
}

function getExt(nome: string) {
  const m = nome.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export function DocumentosPedidoDialog({
  open, onOpenChange, pedidoNumero, pedidoId, pedido, contratos, comprovantes, onAdicionar, onRemover, onReordenar,
}: Props) {
  const [preview, setPreview] = useState<PedidoAnexo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PedidoAnexo | null>(null);
  const [enviandoClickup, setEnviandoClickup] = useState<string | null>(null);

  const enviarParaClickUp = async (a: PedidoAnexo) => {
    setEnviandoClickup(a.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

      const cliente = (pedido?.orcamento_snapshot as any)?.cliente_nome
        || (pedido?.orcamento_snapshot as any)?.cliente
        || '';
      const taskName = `${pedidoNumero || 'Pedido'}${cliente ? ' — ' + cliente : ''}`;
      const { data, error } = await supabase.functions.invoke('clickup-enviar-contrato', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          taskName,
          description: `Contrato do pedido ${pedidoNumero || ''}${cliente ? ' — ' + cliente : ''}`,
          arquivoUrl: a.arquivo_url,
          arquivoNome: a.arquivo_nome,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Enviado para o ClickUp (Rótulos / Contratos)');
    } catch (e: any) {
      toast.error('Erro ao enviar para o ClickUp: ' + (e?.message || String(e)));
    } finally {
      setEnviandoClickup(null);
    }
  };

  const mover = (tipo: 'contrato' | 'comprovante', lista: PedidoAnexo[], idx: number, dir: -1 | 1) => {
    if (!onReordenar || !pedidoId) return;
    const novo = idx + dir;
    if (novo < 0 || novo >= lista.length) return;
    const ids = lista.map(a => a.id);
    [ids[idx], ids[novo]] = [ids[novo], ids[idx]];
    onReordenar(pedidoId, tipo, ids);
  };

  const renderLista = (tipo: 'contrato' | 'comprovante', lista: PedidoAnexo[], vazio: string) => (
    <div className="space-y-2">
      {lista.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">{vazio}</p>
      )}
      {lista.map((a, idx) => (
        <div key={a.id} className="flex items-center justify-between gap-2 p-3 border rounded-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex flex-col">
              <Button
                variant="ghost" size="sm" className="h-5 w-5 p-0"
                disabled={idx === 0}
                title="Mover para cima"
                onClick={() => mover(tipo, lista, idx, -1)}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost" size="sm" className="h-5 w-5 p-0"
                disabled={idx === lista.length - 1}
                title="Mover para baixo"
                onClick={() => mover(tipo, lista, idx, 1)}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.arquivo_nome}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {tipo === 'contrato' && (
              <Button
                variant="ghost" size="sm" title="Enviar para ClickUp (Rótulos / Contratos)"
                disabled={enviandoClickup === a.id}
                onClick={() => enviarParaClickUp(a)}
              >
                {enviandoClickup === a.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" title="Visualizar" onClick={() => setPreview(a)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Baixar" onClick={() => downloadAnexo(a)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" title="Remover" onClick={() => setConfirmDelete(a)}>
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
              {renderLista('contrato', contratos, 'Nenhum contrato anexado.')}
              <p className="text-[11px] text-muted-foreground mt-1">
                Aceitos: {ANEXO_LIMITES.contrato.extensoes.join(', ').toUpperCase()} · até {Math.round(ANEXO_LIMITES.contrato.maxBytes / (1024*1024))}MB
              </p>
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
              {renderLista('comprovante', comprovantes, 'Nenhum comprovante anexado.')}
              <p className="text-[11px] text-muted-foreground mt-1">
                Aceitos: {ANEXO_LIMITES.comprovante.extensoes.join(', ').toUpperCase()} · até {Math.round(ANEXO_LIMITES.comprovante.maxBytes / (1024*1024))}MB
              </p>
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

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O arquivo <strong>{confirmDelete?.arquivo_nome}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) onRemover(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}