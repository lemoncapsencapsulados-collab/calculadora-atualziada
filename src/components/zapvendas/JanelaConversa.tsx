import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ehGrupo,
  extrairTexto,
  jidParaTelefone,
  tipoMidia,
  useEnviarMensagem,
  useZapMensagens,
} from '@/hooks/useZapVendas';
import { ZapMensagem } from '@/types/zapvendas';
import { cn } from '@/lib/utils';
import { MessageCircleOff, RefreshCw, Send, Users } from 'lucide-react';
import type { ChatSelecionado } from './ListaConversas';

const ROTULOS_MIDIA: Record<string, string> = {
  imagem: '📷 Imagem recebida',
  audio: '🎤 Áudio recebido',
  video: '🎬 Vídeo recebido',
  documento: '📄 Documento recebido',
  texto: 'Mensagem sem conteúdo de texto',
};

function formatarHoraMensagem(ts: number): string {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(ms);
}

function iniciais(nome: string): string {
  return (
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

interface JanelaConversaProps {
  chat: ChatSelecionado | null;
  /** Estado de conexão da instância dona da conversa selecionada. */
  statusInstancia: 'open' | 'close' | 'connecting' | 'desconhecido' | undefined;
}

/**
 * Painel direito: histórico da conversa selecionada e composer de texto.
 * Não há tempo real — o botão "Atualizar" refaz a busca sob demanda.
 */
export function JanelaConversa({ chat, statusInstancia }: JanelaConversaProps) {
  const [texto, setTexto] = useState('');
  const fimListaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const {
    data: mensagens,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useZapMensagens(chat?.instanceName, chat?.remoteJid);

  const enviarMensagem = useEnviarMensagem();

  useEffect(() => {
    fimListaRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens, chat?.remoteJid]);

  if (!chat) {
    return (
      <section className="flex h-full flex-1 flex-col items-center justify-center gap-2 bg-background text-center text-muted-foreground">
        <MessageCircleOff className="h-8 w-8" />
        <p className="text-sm">Selecione uma conversa para começar.</p>
      </section>
    );
  }

  const grupo = ehGrupo(chat.remoteJid);
  const nome = chat.pushName || jidParaTelefone(chat.remoteJid) || 'Contato';
  const podeEnviar = statusInstancia === 'open';

  const motivoDesabilitado = !podeEnviar
    ? statusInstancia === 'connecting'
      ? 'Conectando o WhatsApp deste vendedor — aguarde para enviar.'
      : statusInstancia === 'desconhecido'
      ? 'Não foi possível confirmar o status do WhatsApp desta instância — o servidor pode estar indisponível no momento. Tente novamente em instantes.'
      : 'WhatsApp desconectado. Conecte a instância deste vendedor para responder.'
    : null;

  const enviar = () => {
    const conteudo = texto.trim();
    if (!conteudo || enviarMensagem.isPending || !podeEnviar) return;
    enviarMensagem.mutate(
      { instanceName: chat.instanceName, remoteJid: chat.remoteJid, texto: conteudo },
      { onSuccess: () => setTexto('') }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const mensagensOrdenadas = [...(mensagens || [])].sort(
    (a, b) => a.messageTimestamp - b.messageTimestamp
  );

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={chat.profilePicUrl} alt={nome} />
          <AvatarFallback>{grupo ? <Users className="h-4 w-4" /> : iniciais(nome)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {nome}
            {grupo && (
              <Badge variant="secondary" className="ml-1.5 align-middle text-[10px]">
                Grupo
              </Badge>
            )}
          </p>
          <p className="num text-xs text-muted-foreground">{jidParaTelefone(chat.remoteJid)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['zap-chats', chat.instanceName] });
          }}
          disabled={isFetching}
          title="Sem atualização em tempo real — clique para buscar mensagens novas"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className={cn('h-12 w-2/3 rounded-lg', i % 2 === 0 && 'ml-auto')} />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="mx-auto max-w-sm rounded-md border border-destructive-soft bg-destructive-soft p-3 text-center text-sm text-destructive">
            Não foi possível carregar as mensagens.
            <div className="mt-1 text-xs">{(error as Error)?.message}</div>
            <Button variant="outline" size="sm" className="mt-2 h-7" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {!isLoading && !isError && mensagensOrdenadas.length === 0 && (
          <div className="mx-auto max-w-sm rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhuma mensagem encontrada nesta conversa.
          </div>
        )}

        {!isLoading &&
          mensagensOrdenadas.map((m: ZapMensagem) => {
            const fromMe = !!m.key?.fromMe;
            const texto = extrairTexto(m);
            const tipo = tipoMidia(m);
            const conteudo = texto || ROTULOS_MIDIA[tipo] || ROTULOS_MIDIA.texto;

            return (
              <div key={m.id || m.key?.id} className={cn('mb-2 flex', fromMe ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm',
                    fromMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    !texto && 'italic opacity-90'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{conteudo}</p>
                  <p
                    className={cn(
                      'num mt-1 text-right text-[10px] opacity-70',
                      fromMe ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {formatarHoraMensagem(m.messageTimestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        <div ref={fimListaRef} />
      </div>

      <div className="border-t border-border p-3">
        {motivoDesabilitado && (
          <p className="mb-2 text-xs text-warning">{motivoDesabilitado}</p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={podeEnviar ? 'Escreva uma mensagem — Enter envia, Shift+Enter quebra linha' : 'Composer desabilitado'}
            disabled={!podeEnviar || enviarMensagem.isPending}
            className="min-h-[40px] flex-1 resize-none"
            rows={1}
          />
          <Button
            size="icon"
            onClick={enviar}
            disabled={!podeEnviar || !texto.trim() || enviarMensagem.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
