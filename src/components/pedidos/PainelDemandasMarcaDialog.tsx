import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, FileDown, Tag, Image, LayoutTemplate, CreditCard, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDemandasMarca } from '@/hooks/useDemandasMarca';
import {
  DemandaMarca, DemandaStatus, DemandaTipo,
  DEMANDA_STATUS_LABELS, DEMANDA_TIPO_LABELS, DEMANDA_TIPO_SETOR,
} from '@/types/demandaMarca';
import { gerarBriefingConsolidadoPDF, gerarBriefingDemandasPDF, GrupoBriefing } from '@/lib/demandasMarcaPdf';
import { extrairProdutosPedido, produtosPedidoIguais } from '@/lib/produtosPedidoDemanda';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedidos: any[];
}

const TIPO_ICONS: Record<DemandaTipo, React.ElementType> = {
  rotulo: Tag,
  criativos: Image,
  banner: LayoutTemplate,
  monetizze: CreditCard,
};

const STATUS_CLASSES: Record<DemandaStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  em_andamento: 'bg-blue-100 text-blue-800 border-blue-300',
  concluida: 'bg-green-100 text-green-800 border-green-300',
};

const PainelDemandasMarcaDialog = ({ open, onOpenChange, pedidos }: Props) => {
  const { demandas, atualizarDemanda, atualizarDemandaSilencioso, isLoading } = useDemandasMarca();
  const [filtroStatus, setFiltroStatus] = useState<'todos' | DemandaStatus>('todos');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | DemandaTipo>('todos');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [ordem, setOrdem] = useState<'desc' | 'asc'>('desc');

  const numeroPorPedido = useMemo(() => {
    const m = new Map<string, string>();
    pedidos.forEach((p) => m.set(p.id, p.numero_pedido || ''));
    return m;
  }, [pedidos]);

  // Sincronização automática dos produtos de cada demanda com o pedido atual
  const produtosPorPedido = useMemo(() => {
    const m = new Map<string, ReturnType<typeof extrairProdutosPedido>>();
    pedidos.forEach((p) => m.set(p.id, extrairProdutosPedido(p.orcamento_snapshot)));
    return m;
  }, [pedidos]);

  const sincronizando = useRef(false);
  useEffect(() => {
    if (!open || sincronizando.current || !demandas.length) return;
    const pendentes = demandas.filter((d) => {
      const atuais = produtosPorPedido.get(d.pedido_id);
      return !!atuais?.length && !produtosPedidoIguais(d.dados?.produtos_pedido || [], atuais);
    });
    if (!pendentes.length) return;
    sincronizando.current = true;
    (async () => {
      for (const d of pendentes) {
        await atualizarDemandaSilencioso(d.id, {
          dados: { ...(d.dados || {}), produtos_pedido: produtosPorPedido.get(d.pedido_id) },
        });
      }
      sincronizando.current = false;
    })();
  }, [open, demandas, produtosPorPedido, atualizarDemandaSilencioso]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;
    const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : null;
    return demandas
      .filter((d) => (filtroStatus === 'todos' ? true : d.status === filtroStatus))
      .filter((d) => (filtroTipo === 'todos' ? true : d.tipo === filtroTipo))
      .filter((d) => {
        if (!termo) return true;
        const numero = numeroPorPedido.get(d.pedido_id) || '';
        return (
          d.cliente_nome?.toLowerCase().includes(termo) ||
          d.vendedor_nome?.toLowerCase().includes(termo) ||
          numero.toLowerCase().includes(termo)
        );
      })
      .filter((d) => {
        const criada = new Date(d.created_at);
        if (inicio && criada < inicio) return false;
        if (fim && criada > fim) return false;
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return ordem === 'asc' ? diff : -diff;
      });
  }, [demandas, filtroStatus, filtroTipo, busca, dataInicio, dataFim, ordem, numeroPorPedido]);

  const contagem = useMemo(() => {
    const base: Record<string, number> = { pendente: 0, em_andamento: 0, concluida: 0 };
    filtradas.forEach((d) => { base[d.status] = (base[d.status] || 0) + 1; });
    return base;
  }, [filtradas]);

  const grupos: GrupoBriefing[] = useMemo(() => {
    const map = new Map<string, GrupoBriefing>();
    filtradas.forEach((d) => {
      const key = d.pedido_id;
      if (!map.has(key)) {
        map.set(key, {
          ctx: {
            numeroPedido: numeroPorPedido.get(d.pedido_id) || '—',
            clienteNome: d.cliente_nome || '—',
            vendedorNome: d.vendedor_nome || '—',
          },
          demandas: [],
        });
      }
      map.get(key)!.demandas.push(d);
    });
    return Array.from(map.values());
  }, [filtradas, numeroPorPedido]);

  const descricaoFiltros = () => {
    const f: string[] = [];
    if (filtroStatus !== 'todos') f.push(`Status: ${DEMANDA_STATUS_LABELS[filtroStatus]}`);
    if (filtroTipo !== 'todos') f.push(`Tipo: ${DEMANDA_TIPO_LABELS[filtroTipo]}`);
    if (busca.trim()) f.push(`Busca: ${busca.trim()}`);
    if (dataInicio || dataFim) {
      f.push(`Período: ${dataInicio ? format(new Date(`${dataInicio}T00:00:00`), 'dd/MM/yyyy') : '...'} a ${dataFim ? format(new Date(`${dataFim}T00:00:00`), 'dd/MM/yyyy') : '...'}`);
    }
    return f;
  };

  const ctxDe = (d: DemandaMarca) => ({
    numeroPedido: numeroPorPedido.get(d.pedido_id) || '—',
    clienteNome: d.cliente_nome || '—',
    vendedorNome: d.vendedor_nome || '—',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Acompanhamento — Demandas de Marca
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">Cliente / vendedor / pedido</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(DEMANDA_STATUS_LABELS) as DemandaStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{DEMANDA_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(DEMANDA_TIPO_LABELS) as DemandaTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>{DEMANDA_TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Criada de</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Criada até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Badge variant="outline">{filtradas.length} demanda(s)</Badge>
          <Badge variant="outline" className={STATUS_CLASSES.pendente}>{contagem.pendente} pendente(s)</Badge>
          <Badge variant="outline" className={STATUS_CLASSES.em_andamento}>{contagem.em_andamento} em andamento</Badge>
          <Badge variant="outline" className={STATUS_CLASSES.concluida}>{contagem.concluida} concluída(s)</Badge>
          <Button variant="ghost" size="sm" onClick={() => setOrdem((o) => (o === 'desc' ? 'asc' : 'desc'))}>
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            Data {ordem === 'desc' ? '(mais recentes)' : '(mais antigas)'}
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => { setBusca(''); setFiltroStatus('todos'); setFiltroTipo('todos'); setDataInicio(''); setDataFim(''); }}
          >
            Limpar filtros
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            disabled={filtradas.length === 0}
            onClick={() => gerarBriefingConsolidadoPDF(grupos, descricaoFiltros())}
          >
            <FileDown className="h-4 w-4 mr-1" /> Baixar briefing único (PDF)
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando demandas...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma demanda encontrada com os filtros atuais.</p>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => (
              <div key={g.ctx.numeroPedido + g.ctx.clienteNome} className="border rounded-lg">
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 border-b">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{g.ctx.clienteNome}</p>
                    <p className="text-xs text-muted-foreground">
                      Pedido {g.ctx.numeroPedido} • Vendedor: {g.ctx.vendedorNome}
                    </p>
                  </div>
                  <Button
                    variant="outline" size="sm" className="ml-auto"
                    onClick={() => gerarBriefingDemandasPDF(g.demandas, g.ctx, `demandas-${g.ctx.numeroPedido}`)}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF do pedido
                  </Button>
                </div>
                <div className="divide-y">
                  {g.demandas.map((d) => {
                    const Icon = TIPO_ICONS[d.tipo];
                    return (
                      <div key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {DEMANDA_TIPO_LABELS[d.tipo]}
                            <span className="text-xs text-muted-foreground font-normal ml-2">{DEMANDA_TIPO_SETOR[d.tipo]}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criada em {format(new Date(d.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Select
                          value={d.status}
                          onValueChange={(v) => atualizarDemanda({ id: d.id, status: v as DemandaStatus })}
                        >
                          <SelectTrigger className={`h-8 w-[150px] text-xs ${STATUS_CLASSES[d.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(DEMANDA_STATUS_LABELS) as DemandaStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>{DEMANDA_STATUS_LABELS[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost" size="sm" title="Baixar briefing (PDF)"
                          onClick={() => gerarBriefingDemandasPDF([d], ctxDe(d), `${d.tipo}-${ctxDe(d).numeroPedido}`)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PainelDemandasMarcaDialog;
