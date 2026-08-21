import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { invokeZap } from '@/hooks/useZapVendas';
import { Loader2 } from 'lucide-react';

interface DialogQrCodeProps {
  /** Nome da instância sendo conectada; `null` quando o diálogo está fechado. */
  instanceName: string | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}

/** Extrai a imagem do QR code do retorno (variado) da Evolution. */
function extrairImagemQrCode(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const base64 =
    (data as any).base64 ??
    (data as any).qrcode?.base64 ??
    (data as any).qr ??
    null;
  if (typeof base64 !== 'string' || !base64) return null;
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

/** Extrai o estado de conexão do retorno da ação `instances.state`. */
function extrairEstado(data: unknown): string {
  if (!data || typeof data !== 'object') return 'close';
  return (data as any).instance?.state ?? (data as any).state ?? 'close';
}

/**
 * Diálogo de conexão: mostra o QR code da Evolution e reconsulta o estado da
 * instância a cada 5s até ficar `open`, fechando sozinho quando conectar.
 * Sem tempo real — é polling manual, deliberadamente simples.
 */
export function DialogQrCode({ instanceName, aberto, onOpenChange }: DialogQrCodeProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ativo = aberto && !!instanceName;

  const qrQuery = useQuery({
    queryKey: ['zap-qrcode-dialog', instanceName],
    enabled: ativo,
    staleTime: 0,
    refetchInterval: ativo ? 20_000 : false,
    queryFn: () => invokeZap('instances.qrcode', { instanceName }),
  });

  const estadoQuery = useQuery({
    queryKey: ['zap-instancia-estado', instanceName],
    enabled: ativo,
    staleTime: 0,
    refetchInterval: ativo ? 5_000 : false,
    queryFn: () => invokeZap('instances.state', { instanceName }),
  });

  const estado = useMemo(() => extrairEstado(estadoQuery.data), [estadoQuery.data]);
  const imagemQrCode = useMemo(() => extrairImagemQrCode(qrQuery.data), [qrQuery.data]);

  // `staleTime: 0` força um refetch ao reabrir, mas não apaga o cache: no
  // primeiro render após reabrir (ou trocar de instância), `estadoQuery.data`
  // ainda pode trazer o valor de uma sessão anterior do diálogo — se aquela
  // instância chegou a conectar antes, esse valor é `open`. Por isso não
  // reagimos ao VALOR absoluto de `estado`, e sim à TRANSIÇÃO: só disparamos
  // o toast/fechamento quando observarmos, dentro desta abertura do diálogo,
  // uma mudança de um estado não-`open` para `open`.
  const estadoAnteriorRef = useRef<string | null>(null);

  useEffect(() => {
    // Novo ciclo de abertura (ou instância diferente): esquece a transição
    // observada na sessão anterior do diálogo.
    estadoAnteriorRef.current = null;
  }, [ativo, instanceName]);

  useEffect(() => {
    if (!ativo) return;
    const anterior = estadoAnteriorRef.current;
    estadoAnteriorRef.current = estado;

    if (anterior !== null && anterior !== 'open' && estado === 'open') {
      toast({
        title: 'WhatsApp conectado',
        description: `A instância "${instanceName}" foi conectada com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['zap-instancias'] });
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, ativo]);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no celular do vendedor, toque em Aparelhos conectados e
            escaneie o código abaixo. Isto atualiza sozinho a cada 5 segundos até conectar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-3 py-2">
          {qrQuery.isLoading ? (
            <Skeleton className="h-56 w-56" />
          ) : qrQuery.isError ? (
            <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Não foi possível carregar o QR Code.
              <span className="text-xs">{(qrQuery.error as Error)?.message}</span>
            </div>
          ) : imagemQrCode ? (
            <img
              src={imagemQrCode}
              alt="QR Code para conectar o WhatsApp"
              className="h-56 w-56 rounded-md border border-border"
            />
          ) : (
            <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              QR Code indisponível no momento.
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Aguardando conexão…
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
