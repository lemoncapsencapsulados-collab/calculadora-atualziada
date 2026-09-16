import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extrairNomeArquivo, extrairThumbnailImagem, useMidia } from '@/hooks/useZapVendas';
import { TipoMidiaZap, ZapMensagem } from '@/types/zapvendas';
import { cn } from '@/lib/utils';
import { Download, FileText, ImageOff, Loader2, Play, ZoomIn } from 'lucide-react';

interface MensagemMidiaProps {
  mensagem: ZapMensagem;
  instanceName: string;
  tipo: Exclude<TipoMidiaZap, 'texto'>;
}

/**
 * A mesma peça em duas peles. A bolha recebida é clara e a enviada é teal com
 * `text-primary-foreground`; qualquer controle que não declare a própria cor
 * herda o branco e desaparece sobre o branco do botão. Por isso cada superfície
 * de mídia declara fundo, borda e texto explicitamente para os dois lados.
 */
function pele(fromMe: boolean) {
  return {
    superficie: fromMe
      ? 'border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25'
      : 'border-border bg-card text-foreground hover:bg-secondary',
    disco: fromMe ? 'bg-primary-foreground/20' : 'bg-primary/10',
    icone: fromMe ? 'text-primary-foreground' : 'text-primary',
    onda: fromMe ? 'bg-primary-foreground/45' : 'bg-primary/30',
    tenue: fromMe ? 'text-primary-foreground/80' : 'text-muted-foreground',
    tracejado: fromMe
      ? 'border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground/85'
      : 'border-border bg-muted/40 text-muted-foreground',
  };
}

/** Aviso discreto para mídia antiga que o WhatsApp já removeu do próprio servidor — não é um erro do sistema. */
function AvisoExpirada({ fromMe }: { fromMe: boolean }) {
  const s = pele(fromMe);
  return (
    <div className={cn('flex max-w-[240px] items-center gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-xs', s.tracejado)}>
      <ImageOff className="h-3.5 w-3.5 shrink-0" />
      <span>Mídia não está mais disponível (o WhatsApp remove arquivos antigos do servidor).</span>
    </div>
  );
}

function AvisoErro({ mensagem, onTentarDeNovo, fromMe }: { mensagem: string; onTentarDeNovo: () => void; fromMe: boolean }) {
  // O erro fica sempre na placa clara: vermelho sobre teal não se lê.
  return (
    <div className={cn(
      'max-w-[240px] rounded-md border px-2.5 py-2 text-xs text-destructive',
      fromMe ? 'border-destructive/30 bg-card' : 'border-destructive-soft bg-destructive-soft',
    )}>
      Não foi possível carregar a mídia.
      <div className="mt-1 opacity-80">{mensagem}</div>
      <Button variant="outline" size="sm" className="mt-1.5 h-6 bg-card px-2 text-[11px] text-foreground" onClick={onTentarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  );
}

/** Onda estática: a forma diz "som" antes da palavra dizer. */
const ALTURAS_ONDA = [7, 12, 9, 15, 10, 6, 13, 8, 11];

function Onda({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-[2px]">
      {ALTURAS_ONDA.map((altura, i) => (
        <span key={i} className={cn('w-[2px] rounded-full', className)} style={{ height: altura }} />
      ))}
    </span>
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
  const fromMe = !!chaveMensagem?.fromMe;
  const s = pele(fromMe);

  const params =
    chaveMensagem?.id && chaveMensagem?.remoteJid
      ? {
          instanceName,
          messageId: chaveMensagem.id,
          remoteJid: chaveMensagem.remoteJid,
          fromMe,
        }
      : null;

  const { midia, expirada, carregando, erro, buscar } = useMidia(params);
  const dataUrl = midia ? `data:${midia.mimetype};base64,${midia.base64}` : null;

  if (!params) {
    return <AvisoErro mensagem="Mensagem sem identificador válido." onTentarDeNovo={() => {}} fromMe={fromMe} />;
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
              {!carregando && expirada && <AvisoExpirada fromMe={false} />}
              {!carregando && !expirada && erro && <AvisoErro mensagem={erro} onTentarDeNovo={buscar} fromMe={false} />}
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
    if (expirada) return <AvisoExpirada fromMe={fromMe} />;
    if (erro) return <AvisoErro mensagem={erro} onTentarDeNovo={buscar} fromMe={fromMe} />;

    // Carregando: o mesmo formato do botão, para a bolha não pular de tamanho.
    if (carregando) {
      return (
        <div className={cn('flex w-[212px] items-center gap-2.5 rounded-full border px-1.5 py-1.5 text-xs font-medium', s.superficie)}>
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', s.disco)}>
            <Loader2 className={cn('h-3.5 w-3.5 animate-spin', s.icone)} />
          </span>
          <span className={cn('flex-1 text-left', s.tenue)}>Carregando áudio…</span>
        </div>
      );
    }

    // Já baixado: o player nativo ganha uma placa clara própria. Os controles do
    // navegador são desenhados escuros — sobre o teal da bolha eles sumiriam.
    if (dataUrl) {
      return (
        <div className={cn(
          'inline-flex rounded-full border p-0.5',
          fromMe ? 'border-primary-foreground/30 bg-primary-foreground' : 'border-border bg-card',
        )}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={dataUrl} className="h-9 w-[240px] max-w-full" />
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={buscar}
        aria-label="Ouvir áudio"
        className={cn(
          'flex w-[212px] items-center gap-2.5 rounded-full border px-1.5 py-1.5 text-xs font-medium transition-colors',
          s.superficie,
        )}
      >
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', s.disco)}>
          <Play className={cn('h-3.5 w-3.5 translate-x-[1px]', s.icone)} fill="currentColor" />
        </span>
        <span className="flex-1 text-left">Ouvir áudio</span>
        <Onda className={s.onda} />
        <span className="w-1" />
      </button>
    );
  }

  if (tipo === 'video') {
    if (expirada) return <AvisoExpirada fromMe={fromMe} />;
    if (erro) return <AvisoErro mensagem={erro} onTentarDeNovo={buscar} fromMe={fromMe} />;
    if (carregando) return <Skeleton className="h-40 w-56 rounded-md" />;
    if (dataUrl) {
      // eslint-disable-next-line jsx-a11y/media-has-caption
      return <video controls src={dataUrl} className="max-h-64 w-auto max-w-full rounded-md" />;
    }
    return (
      <button
        type="button"
        onClick={buscar}
        className={cn(
          'flex items-center gap-2 rounded-full border px-1.5 py-1.5 pr-3 text-xs font-medium transition-colors',
          s.superficie,
        )}
      >
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', s.disco)}>
          <Play className={cn('h-3.5 w-3.5 translate-x-[1px]', s.icone)} fill="currentColor" />
        </span>
        Carregar vídeo
      </button>
    );
  }

  // documento
  const nomeArquivo = extrairNomeArquivo(mensagem) || 'Arquivo';

  if (expirada) return <AvisoExpirada fromMe={fromMe} />;
  if (erro) return <AvisoErro mensagem={erro} onTentarDeNovo={buscar} fromMe={fromMe} />;

  return (
    <div className={cn('flex max-w-[260px] items-center gap-2 rounded-md border px-2.5 py-2', s.superficie)}>
      <FileText className={cn('h-4 w-4 shrink-0', s.icone)} />
      <span className="min-w-0 flex-1 truncate text-xs">{nomeArquivo}</span>
      {carregando && <Loader2 className={cn('h-3.5 w-3.5 shrink-0 animate-spin', s.tenue)} />}
      {!carregando && !dataUrl && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-current hover:bg-transparent hover:opacity-70" onClick={buscar} title="Baixar arquivo">
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
      {!carregando && dataUrl && (
        <a
          href={dataUrl}
          download={nomeArquivo}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-6 w-6 shrink-0 text-current hover:bg-transparent hover:opacity-70')}
          title="Salvar arquivo"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
