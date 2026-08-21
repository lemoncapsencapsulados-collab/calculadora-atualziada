import { useMemo, useState } from 'react';
import { PainelInstancias } from '@/components/zapvendas/PainelInstancias';
import { ListaConversas, type ChatSelecionado } from '@/components/zapvendas/ListaConversas';
import { JanelaConversa } from '@/components/zapvendas/JanelaConversa';
import { useZapInstancias, jidParaTelefone, normalizarTelefone } from '@/hooks/useZapVendas';
import { useTemPapel } from '@/hooks/useTemPapel';
import { useClientes, type Cliente } from '@/hooks/useClientes';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePedidos } from '@/hooks/usePedidos';
import { formatCurrency } from '@/lib/unitConversion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertTriangle, Receipt, ClipboardList, User, ShieldAlert } from 'lucide-react';
import { Orcamento } from '@/types/orcamento';
import { Pedido, StatusPedido } from '@/types/formula';

/** Resultado do casamento entre um contato do WhatsApp e um cliente do CRM. */
interface ClienteEncontrado {
  cliente: Cliente;
  /** `true` quando o casamento foi só pelos últimos 8 dígitos (não é certeza). */
  provavel: boolean;
}

/**
 * Casa o `remoteJid` da conversa selecionada com um cliente cadastrado.
 * Os telefones do banco vêm em formatos misturados (com/sem 9º dígito, com
 * máscara, com/sem +55); por isso normalizamos os dois lados e, se não houver
 * casamento exato, caímos para comparar só os últimos 8 dígitos — senão
 * perdemos os clientes salvos sem o nono dígito.
 */
function encontrarClientePorJid(
  remoteJid: string | undefined | null,
  clientes: Cliente[]
): ClienteEncontrado | null {
  const telefoneJid = normalizarTelefone(jidParaTelefone(remoteJid));
  if (!telefoneJid) return null;

  const exato = clientes.find((c) => normalizarTelefone(c.telefone) === telefoneJid);
  if (exato) return { cliente: exato, provavel: false };

  if (telefoneJid.length >= 8) {
    const sufixo = telefoneJid.slice(-8);
    const porSufixo = clientes.find((c) => {
      const norm = normalizarTelefone(c.telefone);
      return norm.length >= 8 && norm.slice(-8) === sufixo;
    });
    if (porSufixo) return { cliente: porSufixo, provavel: true };
  }

  return null;
}

const ROTULO_STATUS_ORCAMENTO: Record<Orcamento['status'], string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  pago: 'Pago',
  recusado: 'Recusado',
};

function classeStatusOrcamento(status: Orcamento['status']): string {
  if (status === 'pago') return 'border-success/30 bg-success-soft text-success';
  if (status === 'enviado') return 'border-primary/30 bg-primary-soft text-primary';
  if (status === 'recusado') return 'border-destructive/30 bg-destructive-soft text-destructive';
  return 'border-border bg-muted text-muted-foreground';
}

const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  aguardando_producao: 'Aguardando produção',
  no_estoque: 'No estoque',
  enviado: 'Enviado',
  concluido: 'Concluído',
};

function classeStatusPedido(status: StatusPedido): string {
  if (status === 'concluido') return 'border-success/30 bg-success-soft text-success';
  if (status === 'enviado') return 'border-primary/30 bg-primary-soft text-primary';
  return 'border-border bg-muted text-muted-foreground';
}

/**
 * Painel lateral direito: casamento com o CRM. Ao selecionar uma conversa,
 * mostra o cliente dono do número (se houver) e os orçamentos/pedidos dele.
 */
function PainelCliente({ chat }: { chat: ChatSelecionado | null }) {
  const { clientes, isLoading: carregandoClientes } = useClientes();

  const encontrado = useMemo(
    () => (chat ? encontrarClientePorJid(chat.remoteJid, clientes) : null),
    [chat, clientes]
  );

  const clienteId = encontrado?.cliente.id;

  const { orcamentos, isLoading: carregandoOrcamentos } = useOrcamentos({ enabled: !!clienteId });
  const { pedidos, loading: carregandoPedidos } = usePedidos({ enabled: !!clienteId });

  const orcamentosDoCliente = useMemo(
    () => (clienteId ? orcamentos.filter((o) => o.cliente_id === clienteId) : []),
    [orcamentos, clienteId]
  );

  const idsOrcamentos = useMemo(
    () => new Set(orcamentosDoCliente.map((o) => o.id)),
    [orcamentosDoCliente]
  );

  const pedidosDoCliente = useMemo(
    () => (clienteId ? pedidos.filter((p) => p.orcamento_id && idsOrcamentos.has(p.orcamento_id)) : []),
    [pedidos, clienteId, idsOrcamentos]
  );

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="px-4 pb-2 pt-4">
        <span className="eyebrow">Cliente</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!chat && (
          <div className="mt-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Selecione uma conversa para ver os dados do cliente no CRM.
          </div>
        )}

        {chat && carregandoClientes && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {chat && !carregandoClientes && !encontrado && (
          <div className="mt-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum cliente encontrado para o número{' '}
            <span className="num">{jidParaTelefone(chat.remoteJid)}</span>. Cadastre o cliente no
            CRM para ver os orçamentos e pedidos aqui automaticamente.
          </div>
        )}

        {chat && !carregandoClientes && encontrado && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {encontrado.cliente.nome}
                </p>
                <p className="num truncate text-xs text-muted-foreground">
                  {encontrado.cliente.telefone}
                </p>
                {encontrado.provavel && (
                  <Badge
                    variant="outline"
                    className="mt-1 gap-1 border-warning/30 bg-warning-soft text-[10px] text-warning"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Casamento provável (só pelos últimos dígitos)
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" />
                Orçamentos
              </div>
              {carregandoOrcamentos && (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
              {!carregandoOrcamentos && orcamentosDoCliente.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum orçamento para este cliente.</p>
              )}
              {!carregandoOrcamentos && orcamentosDoCliente.length > 0 && (
                <ul className="space-y-1.5">
                  {orcamentosDoCliente.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-md border border-border px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="num font-medium text-foreground">{o.numero_orcamento}</span>
                        <Badge variant="outline" className={cn('text-[10px]', classeStatusOrcamento(o.status))}>
                          {ROTULO_STATUS_ORCAMENTO[o.status]}
                        </Badge>
                      </div>
                      <span className="num mt-1 block text-muted-foreground">
                        {formatCurrency(o.valor_total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" />
                Pedidos
              </div>
              {carregandoPedidos && (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
              {!carregandoPedidos && pedidosDoCliente.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum pedido para este cliente.</p>
              )}
              {!carregandoPedidos && pedidosDoCliente.length > 0 && (
                <ul className="space-y-1.5">
                  {pedidosDoCliente.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-md border border-border px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="num font-medium text-foreground">{p.numero_pedido}</span>
                        <Badge variant="outline" className={cn('text-[10px]', classeStatusPedido(p.status))}>
                          {ROTULO_STATUS_PEDIDO[p.status]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Tela `/zapvendas`: caixa de entrada unificada de WhatsApp dos vendedores.
 * Três painéis (instâncias, conversas, conversa aberta) com estado
 * compartilhado, mais um painel de casamento com o CRM. Sem tempo real —
 * tudo é buscado sob demanda, seguindo as restrições do projeto.
 */
export default function ZapVendas() {
  const { temPapel, carregando } = useTemPapel('zapvendas');

  const [filtroVendedor, setFiltroVendedor] = useState('todos');
  const [chatSelecionado, setChatSelecionado] = useState<ChatSelecionado | null>(null);

  const { data: instancias } = useZapInstancias();

  const statusInstancia = useMemo(
    () =>
      chatSelecionado
        ? (instancias || []).find((i) => i.instanceName === chatSelecionado.instanceName)?.connectionStatus
        : undefined,
    [instancias, chatSelecionado]
  );

  if (carregando) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center gap-4 p-6">
        <Skeleton className="h-full w-72" />
        <Skeleton className="h-full w-96" />
        <Skeleton className="h-full flex-1" />
      </div>
    );
  }

  if (!temPapel) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">
            Você não tem o papel necessário para ver o ZapVendas. Fale com um administrador se
            acredita que deveria ter acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <PainelInstancias filtro={filtroVendedor} onFiltroChange={setFiltroVendedor} />
      <ListaConversas
        instancias={instancias || []}
        filtroInstanceName={filtroVendedor}
        selecionado={chatSelecionado}
        onSelecionar={setChatSelecionado}
      />
      <JanelaConversa chat={chatSelecionado} statusInstancia={statusInstancia} />
      <PainelCliente chat={chatSelecionado} />
    </div>
  );
}
