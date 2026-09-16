import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, Clock, CalendarClock, AlertCircle, Wallet, TrendingUp, Bell, Settings2, ChevronRight } from 'lucide-react';
import { Pedido } from '@/types/formula';
import { derivarRecebimentos, Recebimento, StatusRecebimento } from '@/lib/recebimentos';
import ClienteRecebimentosDialog from './ClienteRecebimentosDialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  loadNotifSettings, saveNotifSettings, RecebimentoNotifSettings,
} from '@/hooks/useRecebimentoNotificacoes';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso;
  }
};

const statusMeta: Record<StatusRecebimento, { label: string; className: string }> = {
  pago:     { label: 'Recebido',  className: 'bg-green-100 text-green-800 border-green-300' },
  pendente: { label: 'Pendente',  className: 'bg-amber-100 text-amber-800 border-amber-300' },
  futuro:   { label: 'A receber', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  sem_data: { label: 'Sem data',  className: 'bg-muted text-muted-foreground border-border' },
};

interface Props {
  pedidos: Pedido[];
}

type SubTab = 'pago' | 'pendente' | 'futuro' | 'todos';

export default function RecebimentosLista({ pedidos }: Props) {
  const [aba, setAba] = useState<SubTab>('todos');
  const [busca, setBusca] = useState('');
  const [clienteAberto, setClienteAberto] = useState<{ nome: string; pedidos: Pedido[] } | null>(null);
  const [notif, setNotif] = useState<RecebimentoNotifSettings>(() => loadNotifSettings());
  const updateNotif = (patch: Partial<RecebimentoNotifSettings>) => {
    const next = { ...notif, ...patch };
    setNotif(next);
    saveNotifSettings(next);
  };

  const todos = useMemo(
    () => pedidos.flatMap((p) => derivarRecebimentos(p)),
    [pedidos],
  );

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return todos.filter((r) => {
      if (aba !== 'todos' && r.status !== aba) return false;
      if (!q) return true;
      return (
        r.clienteNome.toLowerCase().includes(q) ||
        r.clienteDoc.toLowerCase().includes(q) ||
        r.numeroPedido.toLowerCase().includes(q) ||
        (r.consultor || '').toLowerCase().includes(q)
      );
    });
  }, [todos, aba, busca]);

  const ordenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      // pendente primeiro, depois futuro mais próximo, pago mais recente
      const order: Record<StatusRecebimento, number> = { pendente: 0, futuro: 1, sem_data: 2, pago: 3 };
      const so = order[a.status] - order[b.status];
      if (so !== 0) return so;
      const ad = a.data || '9999';
      const bd = b.data || '9999';
      if (a.status === 'pago') return bd.localeCompare(ad);
      return ad.localeCompare(bd);
    });
  }, [filtrados]);

  const totalRecebido = useMemo(
    () => todos.filter((r) => r.status === 'pago').reduce((s, r) => s + r.valor, 0),
    [todos],
  );
  const totalPendente = useMemo(
    () => todos.filter((r) => r.status === 'pendente').reduce((s, r) => s + r.valor, 0),
    [todos],
  );
  const totalFuturo = useMemo(
    () => todos.filter((r) => r.status === 'futuro').reduce((s, r) => s + r.valor, 0),
    [todos],
  );
  const proximo = useMemo(() => {
    const futuros = todos.filter((r) => r.status === 'futuro' && r.data);
    futuros.sort((a, b) => (a.data! < b.data! ? -1 : 1));
    return futuros[0] || null;
  }, [todos]);

  const grupos = useMemo(() => {
    const m = new Map<string, Recebimento[]>();
    ordenados.forEach((r) => {
      const key = `${r.clienteNome}__${r.clienteDoc}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return Array.from(m.entries()).map(([key, items]) => ({
      key,
      cliente: items[0].clienteNome,
      doc: items[0].clienteDoc,
      consultor: items[0].consultor,
      items,
      subtotal: items.reduce((s, r) => s + r.valor, 0),
    }));
  }, [ordenados]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Total recebido
            </div>
            <div className="text-xl font-bold text-green-700">{fmtBRL(totalRecebido)}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-transparent">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Pendentes
            </div>
            <div className="text-xl font-bold text-amber-700">{fmtBRL(totalPendente)}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Futuros recebimentos
            </div>
            <div className="text-xl font-bold text-blue-700">{fmtBRL(totalFuturo)}</div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-primary" /> Próximo recebimento
            </div>
            {proximo ? (
              <>
                <div className="text-xl font-bold">{fmtBRL(proximo.valor)}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {fmtData(proximo.data)} · {proximo.clienteNome}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum agendado</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, CNPJ/CPF, nº pedido ou consultor..."
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Bell className="h-4 w-4" /> Alertas
              <Settings2 className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-ativo" className="text-sm">Ativar notificações</Label>
              <Switch
                id="notif-ativo"
                checked={notif.ativo}
                onCheckedChange={(v) => updateNotif({ ativo: v })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notif-prox" className="text-xs">
                Avisar quando faltarem ≤ N dias para o vencimento
              </Label>
              <Input
                id="notif-prox"
                type="number"
                min={0}
                value={notif.diasAntesVencimento}
                onChange={(e) => updateNotif({ diasAntesVencimento: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notif-atraso" className="text-xs">
                Alertar pendentes há mais de N dias
              </Label>
              <Input
                id="notif-atraso"
                type="number"
                min={0}
                value={notif.diasPendenteAlerta}
                onChange={(e) => updateNotif({ diasPendenteAlerta: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cada alerta é emitido apenas uma vez por parcela neste navegador.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Sub-abas */}
      <Tabs value={aba} onValueChange={(v) => setAba(v as SubTab)}>
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="pago">Realizados</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="futuro">Futuros</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={aba} className="mt-3">
          <Card className="border-border/60 overflow-hidden">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_1.4fr_0.9fr_2fr_1fr_1fr_0.9fr] gap-3 px-4 py-2 bg-gradient-to-r from-muted/60 to-muted/20 border-b text-[11px] uppercase font-semibold tracking-wide text-muted-foreground">
              <div>Cliente</div>
              <div>CNPJ / CPF</div>
              <div>Pedido</div>
              <div>Descrição</div>
              <div>Vencimento</div>
              <div className="text-right">Valor</div>
              <div className="text-center">Status</div>
            </div>

            {grupos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum recebimento encontrado.
              </div>
            ) : (
              <div className="divide-y">
                {grupos.map((g) => (
                  <div key={g.key} className="bg-background">
                    <button
                      type="button"
                      onClick={() => {
                        const ids = new Set(g.items.map((i) => i.pedidoId));
                        setClienteAberto({
                          nome: g.cliente,
                          pedidos: pedidos.filter((p) => ids.has(p.id)),
                        });
                      }}
                      className="w-full px-4 py-2 bg-muted/30 hover:bg-muted/50 flex items-center justify-between transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{g.cliente}</span>
                        {g.doc && (
                          <span className="text-[11px] text-muted-foreground">· {g.doc}</span>
                        )}
                        {g.consultor && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {g.consultor}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs flex items-center gap-2">
                        <span>Subtotal: <strong>{fmtBRL(g.subtotal)}</strong></span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                    {g.items.map((r, i) => {
                      const meta = statusMeta[r.status];
                      return (
                        <div
                          key={`${r.pedidoId}-${r.indice}-${i}`}
                          className="grid grid-cols-2 md:grid-cols-[2fr_1.4fr_0.9fr_2fr_1fr_1fr_0.9fr] gap-2 md:gap-3 px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors items-center"
                        >
                          <div className="md:hidden col-span-2 flex justify-between">
                            <span className="font-medium">{r.descricao}</span>
                            <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                              {meta.label}
                            </Badge>
                          </div>
                          <div className="hidden md:block truncate">{r.clienteNome}</div>
                          <div className="hidden md:block text-xs text-muted-foreground truncate">
                            {r.clienteDoc || '—'}
                          </div>
                          <div className="hidden md:block text-xs font-mono">{r.numeroPedido}</div>
                          <div className="hidden md:block text-xs text-muted-foreground truncate">
                            {r.descricao} <span className="opacity-60">· {r.metodo}</span>
                          </div>
                          <div className="text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground md:hidden" />
                            {fmtData(r.data)}
                          </div>
                          <div className="text-right font-semibold">{fmtBRL(r.valor)}</div>
                          <div className="hidden md:flex justify-center">
                            <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                              {meta.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ClienteRecebimentosDialog
        open={!!clienteAberto}
        onClose={() => setClienteAberto(null)}
        cliente={clienteAberto?.nome || ''}
        pedidos={clienteAberto?.pedidos || []}
      />
    </div>
  );
}
