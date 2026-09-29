import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Download, ExternalLink, FileSignature, Loader2, Pencil } from 'lucide-react';
import { gerarPedidoCompraPDF, baixarPedidoCompraPDF } from '@/lib/pedidoCompraPdf';
import { listarCamposFaltantes, type DadosPedidoCompra } from '@/types/pedidoCompra';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dados: DadosPedidoCompra;
  numeroPedido: string;
  numeroContrato: string;
  /** Abre o formulário. Sem isto o botão de editar não aparece. */
  onEditar?: () => void;
}

/**
 * Prévia do Pedido de Compra antes de baixar ou mandar assinar.
 *
 * O documento é o que vai ao cliente e à fábrica, e uma vez assinado não se
 * refaz. Ver a página montada -- com os produtos, as parcelas e a embalagem no
 * lugar -- pega o erro que a lista de campos não pega: o nome do produto
 * trocado, a parcela com a data errada, a cor da tampa que ficou do pedido
 * anterior.
 *
 * O PDF é gerado no navegador, então a prévia é o arquivo de verdade, não uma
 * aproximação em HTML: o que está na tela é byte a byte o que vai ser baixado.
 */
export default function PreviewPedidoCompraDialog({
  open,
  onOpenChange,
  dados,
  numeroPedido,
  numeroContrato,
  onEditar,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(true);
  const urlRef = useRef<string | null>(null);

  const faltantes = listarCamposFaltantes(dados, numeroContrato || '');

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setGerando(true);
    setErro(null);

    try {
      const doc = gerarPedidoCompraPDF({ numeroPedido, numeroContrato, dados });
      const blob = doc.output('blob') as Blob;
      if (!vivo) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const novo = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      urlRef.current = novo;
      setUrl(novo);
    } catch (e) {
      if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível montar o documento');
    } finally {
      if (vivo) setGerando(false);
    }

    return () => {
      vivo = false;
    };
  }, [open, dados, numeroPedido, numeroContrato]);

  // O blob só é liberado ao desmontar: revogar a cada fechamento deixaria o
  // iframe apontando para um endereço morto se o diálogo reabrisse.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <FileSignature className="h-5 w-5 text-primary" />
            Pedido de Compra nº {numeroPedido || '—'}
            {faltantes.length > 0 ? (
              <Badge
                variant="outline"
                className="border-amber-500/60 text-amber-700 dark:text-amber-500"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {faltantes.length} {faltantes.length === 1 ? 'pendência' : 'pendências'}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-green-500/60 text-green-700 dark:text-green-400"
              >
                completo
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {faltantes.length > 0
              ? `Falta preencher: ${faltantes.map((f) => f.label).join(', ')}.`
              : 'É exatamente este arquivo que será baixado e enviado para assinatura.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-muted/30">
          {gerando ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Montando o documento…</p>
              </div>
            </div>
          ) : erro ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
                <p className="mb-3 text-sm text-destructive">{erro}</p>
                {onEditar && (
                  <Button variant="outline" size="sm" onClick={onEditar}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Abrir para corrigir
                  </Button>
                )}
              </div>
            </div>
          ) : url ? (
            <div className="flex h-full flex-col">
              <iframe src={url} className="w-full flex-1" title="Prévia do Pedido de Compra" />
              <div className="flex justify-center border-t bg-muted/50 py-1.5">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto text-xs text-muted-foreground"
                  onClick={() => window.open(url, '_blank')}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Não está vendo? Abrir em nova aba
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:px-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Fechar
          </Button>
          {onEditar && (
            <Button variant="outline" onClick={onEditar}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar pedido de compra
            </Button>
          )}
          <Button
            onClick={() => baixarPedidoCompraPDF({ numeroPedido, numeroContrato, dados })}
            disabled={gerando || !!erro}
          >
            <Download className="mr-2 h-4 w-4" />
            Baixar pedido de compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
