import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  mensagemDeErro,
  useCriarInstancia,
  useDefinirVisibilidadeInstancia,
  useDesconectarInstancia,
  useRemoverInstancia,
  useVincularVendedor,
  useZapInstancias,
} from '@/hooks/useZapVendas';
import { ZapInstanciaCombinada } from '@/types/zapvendas';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Link2,
  LogOut,
  MoreVertical,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  UserX,
} from 'lucide-react';
import { DialogQrCode } from './DialogQrCode';

/** Registro mínimo da tabela `usuarios`, só o necessário para esta tela. */
interface UsuarioSimples {
  id: string;
  nome: string;
}

function useUsuariosAtivos() {
  return useQuery({
    queryKey: ['zap-usuarios-ativos'],
    staleTime: 60_000,
    queryFn: async (): Promise<UsuarioSimples[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });
}

function corStatus(status: ZapInstanciaCombinada['connectionStatus']): string {
  if (status === 'open') return 'bg-success';
  if (status === 'connecting') return 'bg-warning';
  return 'bg-muted-foreground';
}

function textoStatus(status: ZapInstanciaCombinada['connectionStatus']): string {
  if (status === 'open') return 'Conectado';
  if (status === 'connecting') return 'Conectando…';
  if (status === 'close') return 'Desconectado';
  return 'Estado desconhecido';
}

interface PainelInstanciasProps {
  filtro: string;
  onFiltroChange: (valor: string) => void;
}

/**
 * Painel esquerdo: vendedores e o estado de conexão de cada instância do
 * WhatsApp. Permite conectar (via QR Code) e cadastrar instâncias novas, e
 * controla o filtro por vendedor que o painel central (conversas) usa.
 */
export function PainelInstancias({ filtro, onFiltroChange }: PainelInstanciasProps) {
  const { data: resultadoInstancias, isLoading, isError, error, refetch, isFetching } = useZapInstancias();
  const instancias = resultadoInstancias?.instancias;
  const evolutionIndisponivel = resultadoInstancias?.evolutionIndisponivel ?? false;
  const { data: usuarios } = useUsuariosAtivos();
  const criarInstancia = useCriarInstancia();
  const vincularVendedor = useVincularVendedor();
  const desconectarInstancia = useDesconectarInstancia();
  const removerInstancia = useRemoverInstancia();
  const definirVisibilidade = useDefinirVisibilidadeInstancia();
  const { toast } = useToast();

  const [instanciaParaConectar, setInstanciaParaConectar] = useState<string | null>(null);
  const [instanciaParaDesconectar, setInstanciaParaDesconectar] = useState<string | null>(null);
  const [instanciaParaRemover, setInstanciaParaRemover] = useState<string | null>(null);
  const [dialogCriarAberto, setDialogCriarAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoUsuarioId, setNovoUsuarioId] = useState<string>('');
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

  // "Oculta" = tem linha em `zap_instancias` mas `ativo: false` — o operador
  // escondeu de propósito (ex.: instância de outro produto que a edge
  // function corretamente recusa apagar, ver `useDefinirVisibilidadeInstancia`).
  // Uma instância nunca vinculada continua visível por padrão (é preciso vê-la
  // para poder vinculá-la); só some da lista default depois de ocultada.
  const instanciasOcultas = (instancias || []).filter((inst) => inst.vinculada && !inst.ativo);
  const instanciasVisiveis = mostrarOcultas
    ? instancias || []
    : (instancias || []).filter((inst) => !inst.vinculada || inst.ativo);

  const nomeVendedor = (inst: ZapInstanciaCombinada): string => {
    const usuario = usuarios?.find((u) => u.id === inst.usuarioId);
    return usuario?.nome || inst.instanceName;
  };

  const iniciais = (nome: string): string =>
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase())
      .join('') || '?';

  const criarNovaInstancia = () => {
    const nomeInstancia = novoNome.trim();
    if (!nomeInstancia) {
      toast({
        title: 'Informe o nome da instância',
        variant: 'destructive',
      });
      return;
    }
    criarInstancia.mutate(
      { instanceName: nomeInstancia, usuarioId: novoUsuarioId || null },
      {
        onSuccess: () => {
          setDialogCriarAberto(false);
          setNovoNome('');
          setNovoUsuarioId('');
        },
      }
    );
  };

  const instanciaEmRemocao = instanciaParaRemover
    ? (instancias || []).find((i) => i.instanceName === instanciaParaRemover)
    : undefined;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <span className="eyebrow">Vendedores</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Atualizar"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div className="px-4 pb-3">
        <Select value={filtro} onValueChange={onFiltroChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Todos os vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os vendedores</SelectItem>
            {(instancias || []).map((inst) => (
              <SelectItem key={inst.instanceName} value={inst.instanceName}>
                {nomeVendedor(inst)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {isLoading && (
          <div className="space-y-3 px-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="mx-2 rounded-md border border-destructive-soft bg-destructive-soft p-3 text-sm text-destructive">
            Não foi possível carregar as instâncias.
            <div className="mt-1 text-xs">{mensagemDeErro(error)}</div>
            <Button variant="outline" size="sm" className="mt-2 h-7" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {!isLoading && !isError && evolutionIndisponivel && (
          <div className="mx-2 mb-2 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-soft p-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Não foi possível falar com o servidor do WhatsApp agora. O status abaixo pode estar
              desatualizado.
            </span>
          </div>
        )}

        {!isLoading && !isError && (instancias || []).length === 0 && (
          <div className="mx-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            Nenhuma instância cadastrada ainda. Crie uma para começar a conectar um vendedor.
          </div>
        )}

        {!isLoading && !isError && (instancias || []).length > 0 && instanciasVisiveis.length === 0 && (
          <div className="mx-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            Todas as instâncias estão ocultas. Use "Mostrar ocultas" no rodapé para revê-las.
          </div>
        )}

        {!isLoading &&
          instanciasVisiveis.map((inst) => (
            <div
              key={inst.instanceName}
              className={cn(
                'mb-1 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted',
                filtro === inst.instanceName && 'bg-primary-soft'
              )}
            >
              <div className="relative shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={inst.profilePicUrl} alt={nomeVendedor(inst)} />
                  <AvatarFallback>{iniciais(nomeVendedor(inst))}</AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card',
                    corStatus(inst.connectionStatus)
                  )}
                  title={textoStatus(inst.connectionStatus)}
                />
              </div>

              <div className="group min-w-0 flex-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      title="Vincular vendedor a esta instância"
                    >
                      <span className="truncate text-sm font-medium text-foreground">
                        {nomeVendedor(inst)}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Vincular vendedor</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        vincularVendedor.mutate({
                          instanceName: inst.instanceName,
                          usuarioId: null,
                        })
                      }
                    >
                      <UserX className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">Sem vendedor</span>
                      {!inst.usuarioId && <Check className="h-4 w-4 text-success" />}
                    </DropdownMenuItem>
                    {(usuarios || []).map((u) => (
                      <DropdownMenuItem
                        key={u.id}
                        onClick={() =>
                          vincularVendedor.mutate({
                            instanceName: inst.instanceName,
                            usuarioId: u.id,
                            numero: inst.numero,
                          })
                        }
                      >
                        <span className="flex-1 truncate">{u.nome}</span>
                        {inst.usuarioId === u.id && <Check className="h-4 w-4 shrink-0 text-success" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="num truncate text-xs text-muted-foreground">
                  {!inst.vinculada
                    ? 'Não vinculada — selecione um vendedor acima para usar'
                    : !inst.ativo
                      ? 'Oculta do ZapVendas — não aparece na lista por padrão'
                      : inst.numero || textoStatus(inst.connectionStatus)}
                </p>
              </div>

              {!inst.vinculada && (
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className="h-7 gap-1 border-warning/30 bg-warning-soft px-2 text-[10px] text-warning"
                    title="Existe na Evolution mas ainda não foi vinculada a um vendedor do ZapVendas — vincule pelo nome acima antes de conectar."
                  >
                    <Link2 className="h-3 w-3" />
                    Não vinculada
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    disabled={definirVisibilidade.isPending}
                    title='Ocultar da lista — só tira do ZapVendas, não apaga nada na Evolution. Pode ser revertido em "Mostrar ocultas".'
                    onClick={() =>
                      definirVisibilidade.mutate({ instanceName: inst.instanceName, ativo: false })
                    }
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {inst.vinculada && !inst.ativo && (
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className="h-7 gap-1 border-border bg-muted px-2 text-[10px] text-muted-foreground"
                    title="Oculta da lista do ZapVendas — nada foi alterado na Evolution."
                  >
                    <EyeOff className="h-3 w-3" />
                    Oculta
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={definirVisibilidade.isPending}
                    onClick={() =>
                      definirVisibilidade.mutate({ instanceName: inst.instanceName, ativo: true })
                    }
                  >
                    <Eye className="h-3 w-3" />
                    Reexibir
                  </Button>
                </div>
              )}

              {inst.ativo && inst.connectionStatus !== 'open' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setInstanciaParaConectar(inst.instanceName)}
                >
                  <Plug className="h-3 w-3" />
                  Conectar
                </Button>
              )}

              {inst.ativo && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      title="Mais ações"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      disabled={inst.connectionStatus !== 'open'}
                      onClick={() => setInstanciaParaDesconectar(inst.instanceName)}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Desconectar</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive-soft focus:text-destructive"
                      onClick={() => setInstanciaParaRemover(inst.instanceName)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remover instância</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {instanciasOcultas.length > 0 && (
          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            size="sm"
            onClick={() => setMostrarOcultas((atual) => !atual)}
          >
            {mostrarOcultas ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {mostrarOcultas ? 'Esconder as ocultas' : `Mostrar ocultas (${instanciasOcultas.length})`}
          </Button>
        )}
        <Button
          variant="secondary"
          className="w-full"
          size="sm"
          onClick={() => setDialogCriarAberto(true)}
        >
          <Plus className="h-4 w-4" />
          Nova instância
        </Button>
      </div>

      <DialogQrCode
        instanceName={instanciaParaConectar}
        aberto={!!instanciaParaConectar}
        onOpenChange={(aberto) => {
          if (!aberto) setInstanciaParaConectar(null);
        }}
      />

      <AlertDialog
        open={!!instanciaParaDesconectar}
        onOpenChange={(aberto) => {
          if (!aberto) setInstanciaParaDesconectar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar este WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              O WhatsApp do vendedor será desconectado agora. Ele precisará abrir o celular e ler o
              QR code de novo para reconectar — as conversas e o histórico não são apagados, só a
              sessão ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectarInstancia.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              disabled={desconectarInstancia.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!instanciaParaDesconectar) return;
                desconectarInstancia.mutate(
                  { instanceName: instanciaParaDesconectar },
                  { onSettled: () => setInstanciaParaDesconectar(null) }
                );
              }}
            >
              {desconectarInstancia.isPending ? 'Desconectando…' : 'Desconectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!instanciaParaRemover}
        onOpenChange={(aberto) => {
          if (!aberto) setInstanciaParaRemover(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {instanciaParaRemover && (
                <>
                  Isso vai desconectar e apagar{' '}
                  <strong className="text-foreground">
                    {instanciaEmRemocao ? nomeVendedor(instanciaEmRemocao) : instanciaParaRemover}
                  </strong>{' '}
                  da Evolution e do ZapVendas. A instância some da lista e{' '}
                  <strong className="text-foreground">
                    todo o histórico de conversas desse número na Evolution é apagado junto
                  </strong>
                  . Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removerInstancia.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              disabled={removerInstancia.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!instanciaParaRemover) return;
                removerInstancia.mutate(
                  { instanceName: instanciaParaRemover },
                  { onSettled: () => setInstanciaParaRemover(null) }
                );
              }}
            >
              {removerInstancia.isPending ? 'Removendo…' : 'Remover instância'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogCriarAberto} onOpenChange={setDialogCriarAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova instância do WhatsApp</DialogTitle>
            <DialogDescription>
              Cria a instância na Evolution e a associa a um vendedor. Depois é só conectar
              escaneando o QR Code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="zap-nome-instancia">Nome da instância</Label>
              <Input
                id="zap-nome-instancia"
                placeholder="ex.: vendedor-joao"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zap-usuario">Vendedor</Label>
              <Select value={novoUsuarioId} onValueChange={setNovoUsuarioId}>
                <SelectTrigger id="zap-usuario">
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {(usuarios || []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogCriarAberto(false)}
              disabled={criarInstancia.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={criarNovaInstancia} disabled={criarInstancia.isPending}>
              {criarInstancia.isPending ? 'Criando…' : 'Criar instância'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
