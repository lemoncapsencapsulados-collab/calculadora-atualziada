import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  extrairTexto,
  ehGrupo,
  invokeZap,
  jidParaTelefone,
  tipoMidia,
} from '@/hooks/useZapVendas';
import { ZapChat, ZapInstanciaCombinada } from '@/types/zapvendas';
import { cn } from '@/lib/utils';
import { Search, Users } from 'lucide-react';

export interface ChatSelecionado {
  instanceName: string;
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
}

interface ConversaUnificada {
  chat: ZapChat;
  instanceName: string;
  vendedor: string;
}

function rotuloUltimaMensagem(chat: ZapChat): string {
  const ultima = chat.lastMessage;
  if (!ultima) return 'Sem mensagens ainda';
  const texto = extrairTexto(ultima as any);
  if (texto) return texto;
  const tipo = tipoMidia(ultima as any);
  const rotulos: Record<string, string> = {
    imagem: '📷 Imagem',
    audio: '🎤 Áudio',
    video: '🎬 Vídeo',
    documento: '📄 Documento',
    texto: 'Mensagem',
  };
  return rotulos[tipo] ?? 'Mensagem';
}

function timestampOrdenacao(chat: ZapChat): number {
  if (chat.updatedAt) {
    const t = new Date(chat.updatedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const ts = chat.lastMessage?.messageTimestamp;
  if (typeof ts === 'number') return ts < 1e12 ? ts * 1000 : ts;
  return 0;
}

function formatarHora(chat: ZapChat): string {
  const ms = timestampOrdenacao(chat);
  if (!ms) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(ms);
}

/** Registro mínimo da tabela `usuarios`, para exibir o selo do vendedor dono da instância. */
function useUsuariosMapa() {
  return useQuery({
    queryKey: ['zap-usuarios-mapa'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nome');
      if (error) throw error;
      const mapa = new Map<string, string>();
      (data || []).forEach((u) => mapa.set(u.id, u.nome));
      return mapa;
    },
  });
}

interface ListaConversasProps {
  instancias: ZapInstanciaCombinada[];
  filtroInstanceName: string;
  selecionado: ChatSelecionado | null;
  onSelecionar: (chat: ChatSelecionado) => void;
}

/**
 * Painel central: conversas de todas as instâncias (ou só da selecionada no
 * filtro), unificadas e ordenadas pela mais recente. Não há tempo real —
 * cada conversa é buscada sob demanda (`chats.list` de cada instância).
 */
export function ListaConversas({
  instancias,
  filtroInstanceName,
  selecionado,
  onSelecionar,
}: ListaConversasProps) {
  const [busca, setBusca] = useState('');
  const { data: usuariosMapa } = useUsuariosMapa();

  // Só instâncias vinculadas em `zap_instancias` são utilizáveis: a edge
  // function recusa (403) `chats.list` para qualquer instância sem esse
  // vínculo — inclusive as que existem na Evolution mas pertencem a outro
  // produto da mesma VPS (n8n, lemonlog etc.) ou ainda não foram vinculadas
  // a um vendedor no painel à esquerda.
  const instanciasRelevantes = useMemo(
    () =>
      instancias.filter(
        (inst) =>
          inst.vinculada &&
          inst.ativo &&
          (filtroInstanceName === 'todos' || inst.instanceName === filtroInstanceName)
      ),
    [instancias, filtroInstanceName]
  );

  const existemNaoVinculadas = useMemo(() => instancias.some((inst) => !inst.vinculada), [instancias]);

  // Uma query por instância — usa a MESMA chave/busca de `useZapChats`, então
  // divide o cache com ela; só precisamos de várias ao mesmo tempo aqui.
  const resultados = useQueries({
    queries: instanciasRelevantes.map((inst) => ({
      queryKey: ['zap-chats', inst.instanceName],
      staleTime: 15_000,
      queryFn: async (): Promise<ZapChat[]> => {
        const data = await invokeZap<ZapChat[]>('chats.list', { instanceName: inst.instanceName });
        return data || [];
      },
    })),
  });

  // `carregandoTudo` só é `true` enquanto NENHUMA instância respondeu ainda —
  // é o único caso em que faz sentido esconder a lista atrás do skeleton de
  // tela cheia. Com `some(isLoading)`, uma única instância lenta escondia as
  // conversas das outras que já haviam chegado; agora elas aparecem assim que
  // qualquer resultado existir.
  const carregandoTudo = resultados.length > 0 && resultados.every((r) => r.isLoading);
  const algumCarregando = resultados.some((r) => r.isLoading);
  const algumaFalhou = resultados.some((r) => r.isError);
  const todasFalharam = resultados.length > 0 && resultados.every((r) => r.isError);

  const nomeVendedor = (inst: ZapInstanciaCombinada): string =>
    (inst.usuarioId && usuariosMapa?.get(inst.usuarioId)) || inst.instanceName;

  const conversas: ConversaUnificada[] = useMemo(() => {
    const lista: ConversaUnificada[] = [];
    instanciasRelevantes.forEach((inst, idx) => {
      const chats = resultados[idx]?.data || [];
      chats.forEach((chat) => {
        lista.push({ chat, instanceName: inst.instanceName, vendedor: nomeVendedor(inst) });
      });
    });

    const filtradas = busca.trim()
      ? lista.filter(({ chat }) => {
          const termo = busca.trim().toLowerCase();
          const nome = (chat.pushName || '').toLowerCase();
          const telefone = jidParaTelefone(chat.remoteJid);
          return nome.includes(termo) || telefone.includes(termo.replace(/\D/g, '') || termo);
        })
      : lista;

    return filtradas.sort((a, b) => timestampOrdenacao(b.chat) - timestampOrdenacao(a.chat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanciasRelevantes, resultados.map((r) => r.dataUpdatedAt).join(','), busca, usuariosMapa]);

  const iniciais = (nome: string): string =>
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  return (
    <section className="flex h-full w-96 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-4 pb-2 pt-4">
        <span className="eyebrow">Conversas</span>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {instanciasRelevantes.length === 0 && (
          <div className="mx-4 mt-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {existemNaoVinculadas
              ? 'Existem instâncias do WhatsApp ainda não vinculadas a um vendedor. Vincule uma no painel à esquerda para ver as conversas aqui.'
              : 'Conecte o WhatsApp de um vendedor para ver as conversas.'}
          </div>
        )}

        {instanciasRelevantes.length > 0 && carregandoTudo && (
          <div className="space-y-3 px-4 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        )}

        {instanciasRelevantes.length > 0 && todasFalharam && (
          <div className="mx-4 mt-2 rounded-md border border-destructive-soft bg-destructive-soft p-3 text-sm text-destructive">
            Não foi possível carregar as conversas.
          </div>
        )}

        {algumaFalhou && !todasFalharam && (
          <div className="mx-4 mt-2 rounded-md border border-warning-soft bg-warning-soft p-2 text-xs text-warning">
            Algumas instâncias não responderam; a lista pode estar incompleta.
          </div>
        )}

        {!carregandoTudo && !algumCarregando && instanciasRelevantes.length > 0 && conversas.length === 0 && !todasFalharam && (
          <div className="mx-4 mt-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhuma conversa encontrada.
          </div>
        )}

        {!carregandoTudo &&
          conversas.map(({ chat, instanceName, vendedor }) => {
            const grupo = ehGrupo(chat.remoteJid);
            const nome = chat.pushName || jidParaTelefone(chat.remoteJid) || 'Contato';
            const ativo =
              selecionado?.instanceName === instanceName && selecionado?.remoteJid === chat.remoteJid;

            return (
              <button
                key={`${instanceName}-${chat.remoteJid}`}
                type="button"
                onClick={() =>
                  onSelecionar({
                    instanceName,
                    remoteJid: chat.remoteJid,
                    pushName: chat.pushName,
                    profilePicUrl: chat.profilePicUrl,
                  })
                }
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border/60 px-4 py-2.5 text-left transition-colors hover:bg-muted',
                  ativo && 'bg-primary-soft hover:bg-primary-soft'
                )}
              >
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={chat.profilePicUrl} alt={nome} />
                  <AvatarFallback>{grupo ? <Users className="h-4 w-4" /> : iniciais(nome)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {nome}
                      {grupo && (
                        <Badge variant="secondary" className="ml-1.5 align-middle text-[10px]">
                          Grupo
                        </Badge>
                      )}
                    </p>
                    <span className="num shrink-0 text-[11px] text-muted-foreground">
                      {formatarHora(chat)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{rotuloUltimaMensagem(chat)}</p>
                  <Badge variant="outline" className="mt-1 text-[10px] font-normal text-muted-foreground">
                    {vendedor}
                  </Badge>
                </div>
              </button>
            );
          })}
      </div>
    </section>
  );
}
