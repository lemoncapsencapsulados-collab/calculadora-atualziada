import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wallet, FileText, CheckCircle2, Clock, CalendarClock, AlertCircle, History } from 'lucide-react';
import { Pedido } from '@/types/formula';
import { derivarRecebimentos, Recebimento, StatusRecebimento } from '@/lib/recebimentos';
import HistoricoVhsysLista from '@/components/pedidos/HistoricoVhsysLista';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso: string | null) => {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return iso; }
};

const statusMeta: Record<StatusRecebimento, { label: string; className: string; Icon: any }> = {
  pago:     { label: 'Recebido',  className: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle2 },
  pendente: { label: 'Pendente',  className: 'bg-amber-100 text-amber-800 border-amber-300', Icon: AlertCircle },
  futuro:   { label: 'A receber', className: 'bg-blue-100 text-blue-800 border-blue-300', Icon: CalendarClock },
  sem_data: { label: 'Sem data',  className: 'bg-muted text-muted-foreground border-border', Icon: Clock },
};

interface Props {
  open: boolean;
  onClose: () => void;
  cliente: string;
  pedidos: Pedido[]; // pedidos do cliente
}

export default function ClienteRecebimentosDialog({ open, onClose, cliente, pedidos }: Props) {
  const recebimentosPorPedido = useMemo(() => {
    return pedidos.map((p) => ({
      pedido: p,
      recebimentos: derivarRecebimentos(p),
    }));
  }, [pedidos]);

  const todos = useMemo(
    () => recebimentosPorPedido.flatMap((r) => r.recebimentos),
    [recebimentosPorPedido],
  );

  const totais = useMemo(() => {
    const sum = (s: StatusRecebimento) =>
      todos.filter((r) => r.status === s).reduce((acc, r) => acc + r.valor, 0);
    return {
      pago: sum('pago'),
      pendente: sum('pendente'),
      futuro: sum('futuro'),
      total: todos.reduce((s, r) => s + r.valor, 0),
    };
  }, [todos]);

  const docCliente = (() => {
    const snap: any = pedidos[0]?.orcamento_snapshot || {};
    const dc = snap.dados_cliente || {};
    return dc.cnpj || dc.cpf || '';
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span>{cliente}</span>
            {docCliente && (
              <span className="text-xs font-normal text-muted-foreground">· {docCliente}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-2.5">
              <div className="text-[11px] text-muted-foreground">Recebido</div>
              <div className="text-base font-bold text-green-700">{fmtBRL(totais.pago)}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-2.5">
              <div className="text-[11px] text-muted-foreground">Pendente</div>
              <div className="text-base font-bold text-amber-700">{fmtBRL(totais.pendente)}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-2.5">
              <div className="text-[11px] text-muted-foreground">Futuro</div>
              <div className="text-base font-bold text-blue-700">{fmtBRL(totais.futuro)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5">
              <div className="text-[11px] text-muted-foreground">Total contratado</div>
              <div className="text-base font-bold">{fmtBRL(totais.total)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="parcelas" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2 w-full md:w-auto">
            <TabsTrigger value="parcelas" className="gap-2">
              <FileText className="h-4 w-4" /> Parcelas e pedidos
            </TabsTrigger>
            <TabsTrigger value="vhsys" className="gap-2">
              <History className="h-4 w-4" /> Histórico VhSys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parcelas" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-[55vh] pr-3">
              <div className="space-y-3">
                {recebimentosPorPedido.map(({ pedido, recebimentos }) => {
                  const subtotal = recebimentos.reduce((s, r) => s + r.valor, 0);
                  return (
                    <div key={pedido.id} className="border rounded-lg overflow-hidden bg-background">
                      <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{pedido.numero_pedido}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {pedido.status}
                          </Badge>
                        </div>
                        <div className="text-xs">
                          Total pedido: <strong>{fmtBRL(subtotal)}</strong>
                        </div>
                      </div>
                      {recebimentos.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground italic">
                          Sem condições de pagamento estruturadas.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {recebimentos.map((r, i) => {
                            const meta = statusMeta[r.status];
                            return (
                              <div
                                key={`${r.pedidoId}-${r.indice}-${i}`}
                                className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 text-sm hover:bg-muted/20"
                              >
                                <div className="min-w-0">
                                  <div className="truncate">{r.descricao}</div>
                                  <div className="text-[11px] text-muted-foreground">{r.metodo}</div>
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                  {fmtData(r.data)}
                                </div>
                                <div className="font-semibold text-right whitespace-nowrap">
                                  {fmtBRL(r.valor)}
                                </div>
                                <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                                  <meta.Icon className="h-3 w-3 mr-1" />
                                  {meta.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="vhsys" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-[55vh] pr-3">
              <div className="space-y-3">
                {pedidos.map((p) => (
                  <div key={p.id} className="border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40 flex items-center gap-2">
                      <span className="font-mono text-xs">{p.numero_pedido}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {(p.historico_vhsys || []).length} registro(s)
                      </span>
                    </div>
                    <div className="p-3">
                      <HistoricoVhsysLista entradas={p.historico_vhsys} />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}