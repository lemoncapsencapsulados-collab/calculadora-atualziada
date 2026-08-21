import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extrairNomeArquivo, extrairThumbnailImagem, useMidia } from '@/hooks/useZapVendas';
import { TipoMidiaZap, ZapMensagem } from '@/types/zapvendas';
import { cn } from '@/lib/utils';
import { Download, FileText, ImageOff, Loader2, Play, Volume2, ZoomIn } from 'lucide-react';

interface MensagemMidiaProps {
  mensagem: ZapMensagem;
  instanceName: string;
  tipo: Exclude<TipoMidiaZap, 'texto'>;
}

/** Aviso discreto para mídia antiga que o WhatsApp já removeu do próprio servidor — não é um erro do sistema. */
function AvisoExpirada() {
  return (
    <div className="flex max-w-[240px] items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
      <ImageOff className="h-3.5 w-3.5 shrink-0" />
      <span>Mídia não está mais disponível (o WhatsApp remove arquivos antigos do servidor).</span>
    </div>
  );
}

function AvisoErro({ mensagem, onTentarDeNovo }: { mensagem: string; onTentarDeNovo: () => void }) {
  return (
    <div className="max-w-[240px] rounded-md border border-destructive-soft bg-destructive-soft px-2.5 py-2 text-xs text-destructive">
      Não foi possível carregar a mídia.
      <div className="mt-1 opacity-80">{mensagem}</div>
      <Button variant="outline" size="sm" className="mt-1.5 h-6 px-2 text-[11px]" onClick={onTentarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  );
}

/**
 * Renderiza o conteúdo de uma mensagem de mídia (imagem, áudio, vídeo ou
 * documento). Nada é baixado automaticamente — cada tipo tem um gatilho
 * explícito do usuário (clique na miniatura, botão "Ouvir"/"Carregar
 * vídeo"/"Baixar") porque uma conversa pode ter centenas de mídias e a
 * Evolution só entrega uma por vez, sob demanda.
 */
export function MensagemMidia({ mensagem, instanceName, tipo }: MensagemMidiaProps) {
  const [visualizadorAberto, setVisualizadorAberto] = useState(false);

  const chaveMensagem = mensagem.key;
  const params =
    chaveMensagem?.id && chaveMensagem?.remoteJid
      ? {
          instanceName,
          messageId: chaveMensagem.id,
          remoteJid: chaveMensagem.remoteJid,
          fromMe: !!chaveMensagem.fromMe,
        }
      : null;

  const { midia, expirada, carregando, erro, buscar } = useMidia(params);
  const dataUrl = midia ? `data:${midia.mimetype};base64,${midia.base64}` : null;

  if (!params) {
    return <AvisoErro mensagem="Mensagem sem identificador válido." onTentarDeNovo={() => {}} />;
  }

  if (tipo === 'imagem') {
    const thumbnail = extrairThumbnailImagem(mensagem);
    return (
      <>
        <button
          type="button"
          className="block overflow-hidden rounded-md border border-border/60 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setVisualizadorAberto(true);
            if (!midia) buscar();
          }}
          title="Ver imagem"
        >
          {thumbnail ? (
            <div className="relative h-40 w-40">
              <img src={thumbnail} alt="Prévia da imagem" className="h-40 w-40 object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/30 hover:opacity-100">
                <ZoomIn className="h-5 w-5" />
              </span>
            </div>
          ) : (
            <span className="flex h-40 w-40 flex-col items-center justify-center gap-1.5 bg-muted text-muted-foreground">
              <ZoomIn className="h-5 w-5" />
              <span className="text-[11px]">Ver imagem</span>
            </span>
          )}
        </button>

        <Dialog open={visualizadorAberto} onOpenChange={setVisualizadorAberto}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Imagem</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              {carregando && <Skeleton className="h-72 w-full rounded-md" />}
              {!carregando && expirada && <AvisoExpirada />}
              {!carregando && !expirada && erro && <AvisoErro mensagem={erro} onTentarDeNovo={buscar} />}
              {!carregando && !expirada && !erro && dataUrl && (
                <img src={dataUrl} alt="Imagem recebida" className="max-h-[70vh] w-auto max-w-full rounded-md" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (tipo === 'audio') {
    if (expirada) return <AvisoExpirada />;
    if (erro) return <AvisoErro mensagem={erro} onTentarDeNovo={buscar} />;
    if (carregando) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando áudio…
        </div>
      );
    }
    if (dataUrl) {
      // eslint-disable-next-line jsx-a11y/media-has-caption
      return <audio controls src={dataUrl} className="h-9 max-w-[260px]" />;
    }
    return (
      <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={buscar}>
        <Volume2 className="h-3.5 w-3.5" />
        Ouvir áudio
      </Button>
    );
  }

  if (tipo === 'video') {
    if (expirada) return <AvisoExpirada />;
    if (erro) return <AvisoErro mensagem={erro} onTentarDeNovo={buscar} />;
    if (carregando) return <Skeleton className="h-40 w-56 rounded-md" />;
    if (dataUrl) {
      // eslint-disable-next-line jsx-a11y/media-has-caption
      return <video controls src={dataUrl} className="max-h-64 w-auto max-w-full rounded-md" />;
    }
    return (
      <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={buscar}>
        <Play className="h-3.5 w-3.5" />
        Carregar vídeo
      </Button>
    );
  }

  // documento
  const nomeArquivo = extrairNomeArquivo(mensagem) || 'Arquivo';

  if (expirada) return <AvisoExpirada />;
  if (erro) return <AvisoErro mensagem={erro} onTentarDeNovo={buscar} />;

  return (
    <div className="flex max-w-[260px] items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs">{nomeArquivo}</span>
      {carregando && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      {!carregando && !dataUrl && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={buscar} title="Baixar arquivo">
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
      {!carregando && dataUrl && (
        <a
          href={dataUrl}
          download={nomeArquivo}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-6 w-6 shrink-0')}
          title="Salvar arquivo"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
