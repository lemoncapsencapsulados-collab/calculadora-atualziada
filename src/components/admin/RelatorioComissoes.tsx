import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Eye, Pencil, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { usePedidos } from '@/hooks/usePedidos';
import { useUsuarios } from '@/hooks/useUsuarios';
import { derivarComissoes, aplicarStatusPago, ItemComissao, StatusParcelaComissao } from '@/lib/comissoes';
import AlterarPagamentoDialog from '@/components/pedidos/AlterarPagamentoDialog';
import { Pedido } from '@/types/formula';
import { arredondarReais } from '@/lib/utils';

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try { return format(new Date(iso + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return iso; }
};

const mesAtualYYYYMM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const statusBadge = (s: StatusParcelaComissao) => {
  if (s === 'pago') return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Pago</Badge>;
  if (s === 'vencido') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Inadimplente</Badge>;
  if (s === 'pendente') return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />A vencer</Badge>;
  return <Badge variant="outline">Sem data</Badge>;
};

type FiltroStatus = 'todos' | 'pago' | 'pendente' | 'vencido';
type FiltroTipo = 'todos' | 'nova_venda' | 'recompra';

export function RelatorioComissoes() {
  const { pedidos, alterarPagamento, toggleParcelaPagaAsync } = usePedidos();
  const { data: usuarios = [] } = useUsuarios(true);

  const [mes, setMes] = useState<string>(mesAtualYYYYMM());
  const [consultorFiltro, setConsultorFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>('todos');
  const [detalhePedido, setDetalhePedido] = useState<Pedido | null>(null);
  const [editarPedido, setEditarPedido] = useState<Pedido | null>(null);

  // Deriva todas as parcelas-comissão
  const todasParcelas = useMemo(() => {
    const out: ItemComissao[] = [];
    pedidos.forEach((p) => {
      out.push(...derivarComissoes(p));
    });
    return out;
  }, [pedidos]);

  // Lista de consultores presentes
  const consultoresDisponiveis = useMemo(() => {
    const s = new Set<string>();
    todasParcelas.forEach((p) => s.add(p.consultor));
    return Array.from(s).sort();
  }, [todasParcelas]);

  // Aplica filtros
  const parcelasFiltradas = useMemo(() => {
    return todasParcelas.filter((p) => {
      if (consultorFiltro !== 'todos' && p.consultor !== consultorFiltro) return false;
      if (tipoFiltro !== 'todos' && p.tipoVenda !== tipoFiltro) return false;
      if (statusFiltro !== 'todos' && p.status !== statusFiltro) return false;
      // Mês: parcela está no mês se data de vencimento OU data de pagamento cai no mês
      const dt = p.dataVencimento;
      if (!dt) return statusFiltro === 'todos';
      return dt.slice(0, 7) === mes;
    });
  }, [todasParcelas, consultorFiltro, tipoFiltro, statusFiltro, mes]);

  // Agrupa por consultor para o resumo
  const resumoPorConsultor = useMemo(() => {
    type R = {
      consultor: string;
      recebidoMes: number;
      comissaoPaga: number;
      comissaoAVencer: number;
      comissaoInadimplente: number;
      comissaoMesDesteFechamento: number; // pedidos fechados no mês
      comissaoMesParcelasAntigas: number;  // pedidos fechados em meses anteriores
    };
    const m = new Map<string, R>();
    parcelasFiltradas.forEach((p) => {
      let r = m.get(p.consultor);
      if (!r) {
        r = {
          consultor: p.consultor,
          recebidoMes: 0, comissaoPaga: 0, comissaoAVencer: 0, comissaoInadimplente: 0,
          comissaoMesDesteFechamento: 0, comissaoMesParcelasAntigas: 0,
        };
        m.set(p.consultor, r);
      }
      if (p.status === 'pago') {
        r.recebidoMes += p.valorBruto;
        r.comissaoPaga += p.comissao;
      } else if (p.status === 'vencido') {
        r.comissaoInadimplente += p.comissao;
      } else if (p.status === 'pendente') {
        r.comissaoAVencer += p.comissao;
      }
      // Origem: se for primeira parcela (indice 0), considera "deste mês de fechamento"
      if (p.parcelaIndice === 0) r.comissaoMesDesteFechamento += p.comissao;
      else r.comissaoMesParcelasAntigas += p.comissao;
    });
    return Array.from(m.values()).sort((a, b) => b.comissaoPaga - a.comissaoPaga);
  }, [parcelasFiltradas]);

  // Agrupa por pedido para a tabela
  const linhasPedido = useMemo(() => {
    type L = {
      pedido: Pedido;
      consultor: string;
      clienteNome: string;
      clienteDoc: string;
      tipoVenda: 'nova_venda' | 'recompra';
      metodo: string;
      valorTotalPedido: number;
      comissaoTotalPedido: number;
      comissaoNoMes: number;
      temInadimplencia: boolean;
    };
    const map = new Map<string, L>();
    // comissão total do pedido a partir de todasParcelas
    const totaisPorPedido = new Map<string, number>();
    const inadPorPedido = new Map<string, boolean>();
    todasParcelas.forEach((p) => {
      totaisPorPedido.set(p.pedidoId, (totaisPorPedido.get(p.pedidoId) || 0) + p.comissao);
      if (p.status === 'vencido') inadPorPedido.set(p.pedidoId, true);
    });
    parcelasFiltradas.forEach((p) => {
      let l = map.get(p.pedidoId);
      if (!l) {
        const pedido = pedidos.find((x) => x.id === p.pedidoId);
        if (!pedido) return;
        const snap: any = pedido.orcamento_snapshot || {};
        l = {
          pedido,
          consultor: p.consultor,
          clienteNome: p.clienteNome,
          clienteDoc: p.clienteDoc,
          tipoVenda: p.tipoVenda,
          metodo: p.metodoPagamento,
          valorTotalPedido: Number(snap.valor_total) || 0,
          comissaoTotalPedido: arredondarReais(totaisPorPedido.get(p.pedidoId) || 0),
          comissaoNoMes: 0,
          temInadimplencia: !!inadPorPedido.get(p.pedidoId),
        };
        map.set(p.pedidoId, l);
      }
      l.comissaoNoMes = arredondarReais(l.comissaoNoMes + p.comissao);
    });
    return Array.from(map.values()).sort((a, b) => b.comissaoNoMes - a.comissaoNoMes);
  }, [parcelasFiltradas, todasParcelas, pedidos]);

  const totalGeralMes = useMemo(() => {
    return parcelasFiltradas.reduce(
      (acc, p) => {
        if (p.status === 'pago') acc.pago += p.comissao;
        else if (p.status === 'vencido') acc.inad += p.comissao;
        else if (p.status === 'pendente') acc.aVencer += p.comissao;
        return acc;
      },
      { pago: 0, aVencer: 0, inad: 0 },
    );
  }, [parcelasFiltradas]);

  const exportarCSV = () => {
    const headers = [
      'Consultor', 'Cliente', 'CPF/CNPJ', 'Pedido', 'Tipo', 'Método',
      'Parcela', 'Vencimento', 'Valor bruto', 'Valor líquido', '%', 'Comissão', 'Status',
    ];
    const rows = parcelasFiltradas.map((p) => [
      p.consultor, p.clienteNome, p.clienteDoc, p.numeroPedido,
      p.tipoVenda === 'recompra' ? 'Recompra' : 'Nova venda',
      p.metodoPagamento, p.descricaoParcela, fmtDate(p.dataVencimento),
      String(p.valorBruto).replace('.', ','),
      String(p.valorLiquido).replace('.', ','),
      `${(p.percentual * 100).toFixed(0)}%`,
      String(p.comissao).replace('.', ','),
      p.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes_${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label>Mês de referência</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Consultor</Label>
            <Select value={consultorFiltro} onValueChange={setConsultorFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {consultoresDisponiveis.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status da parcela</Label>
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as FiltroStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
                <SelectItem value="pendente">A vencer</SelectItem>
                <SelectItem value="vencido">Inadimplentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo de venda</Label>
            <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as FiltroTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="nova_venda">Nova venda (5%)</SelectItem>
                <SelectItem value="recompra">Recompra (1%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" onClick={exportarCSV}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo geral do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Comissão paga no mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{fmtBRL(totalGeralMes.pago)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A vencer no mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(totalGeralMes.aVencer)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Inadimplência</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{fmtBRL(totalGeralMes.inad)}</div></CardContent>
        </Card>
      </div>

      {/* Resumo por consultor */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comissão por consultor — {mes}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Comissão paga</TableHead>
                <TableHead className="text-right">A vencer</TableHead>
                <TableHead className="text-right">Inadimplente</TableHead>
                <TableHead className="text-right">Deste mês</TableHead>
                <TableHead className="text-right">Parcelas antigas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumoPorConsultor.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem movimentação no período</TableCell></TableRow>
              ) : resumoPorConsultor.map((r) => (
                <TableRow key={r.consultor}>
                  <TableCell className="font-medium">{r.consultor}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.recebidoMes)}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-semibold">{fmtBRL(r.comissaoPaga)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.comissaoAVencer)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmtBRL(r.comissaoInadimplente)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.comissaoMesDesteFechamento)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.comissaoMesParcelasAntigas)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pedidos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pedidos no período</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
                <TableHead className="text-right">Comissão pedido</TableHead>
                <TableHead className="text-right">Comissão no mês</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasPedido.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum pedido no período</TableCell></TableRow>
              ) : linhasPedido.map((l) => (
                <TableRow key={l.pedido.id}>
                  <TableCell>{l.consultor}</TableCell>
                  <TableCell className="font-medium">{l.clienteNome}</TableCell>
                  <TableCell className="font-mono text-xs">{l.clienteDoc || '—'}</TableCell>
                  <TableCell>{l.pedido.numero_pedido}</TableCell>
                  <TableCell>
                    {l.tipoVenda === 'recompra'
                      ? <Badge variant="secondary">Recompra · 1%</Badge>
                      : <Badge className="bg-primary">Nova venda · 5%</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{l.metodo}</TableCell>
                  <TableCell className="text-right">{fmtBRL(l.valorTotalPedido)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(l.comissaoTotalPedido)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtBRL(l.comissaoNoMes)}</TableCell>
                  <TableCell>
                    {l.temInadimplencia
                      ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Inadimplente</Badge>
                      : <Badge className="bg-emerald-600 hover:bg-emerald-600">Em dia</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDetalhePedido(l.pedido)}>
                        <Eye className="h-3 w-3 mr-1" />Detalhes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditarPedido(l.pedido)}>
                        <Pencil className="h-3 w-3 mr-1" />Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalhes */}
      <DetalhesPedidoComissaoDialog
        pedido={detalhePedido}
        onClose={() => setDetalhePedido(null)}
        onToggleParcela={async (pedido, indice, marcarPago) => {
          const snap: any = pedido.orcamento_snapshot || {};
          const cond = snap.condicoes_pagamento;
          if (!cond) return;
          const novas = aplicarStatusPago(cond, indice, marcarPago);
          await toggleParcelaPagaAsync({ id: pedido.id, novasCondicoes: novas });
        }}
      />

      {/* Editar pagamento + valor total */}
      {editarPedido && (() => {
        const snap: any = editarPedido.orcamento_snapshot || {};
        return (
          <AlterarPagamentoDialog
            open={!!editarPedido}
            onOpenChange={(o) => { if (!o) setEditarPedido(null); }}
            numeroPedido={editarPedido.numero_pedido}
            valorTotal={Number(snap.valor_total) || 0}
            dataPagamentoAtual={snap.data_pagamento || null}
            condicoesAtuais={snap.condicoes_pagamento || {}}
            permitirEditarValor
            onConfirm={async ({ data_pagamento, condicoes_pagamento, valor_total }) => {
              await alterarPagamento({
                id: editarPedido.id,
                data_pagamento,
                condicoes_pagamento,
                valor_total,
              });
              setEditarPedido(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function DetalhesPedidoComissaoDialog({
  pedido,
  onClose,
  onToggleParcela,
}: {
  pedido: Pedido | null;
  onClose: () => void;
  onToggleParcela: (pedido: Pedido, indice: number, marcarPago: boolean) => Promise<void>;
}) {
  const parcelas = useMemo(() => (pedido ? derivarComissoes(pedido) : []), [pedido]);
  if (!pedido) return null;
  const snap: any = pedido.orcamento_snapshot || {};
  const totais = parcelas.reduce(
    (a, p) => {
      if (p.status === 'pago') a.pago += p.comissao;
      else if (p.status === 'vencido') a.inad += p.comissao;
      else if (p.status === 'pendente') a.aVencer += p.comissao;
      return a;
    },
    { pago: 0, aVencer: 0, inad: 0 },
  );
  const recompra = parcelas[0]?.tipoVenda === 'recompra';

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comissão — {pedido.numero_pedido}</DialogTitle>
          <DialogDescription>
            {parcelas[0]?.clienteNome} · {parcelas[0]?.clienteDoc || 'sem documento'} · Consultor: {parcelas[0]?.consultor}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-muted-foreground">Tipo</div>
            <div className="font-semibold">{recompra ? 'Recompra (1%)' : 'Nova venda (5%)'}</div></div>
          <div><div className="text-muted-foreground">Valor total</div>
            <div className="font-semibold">{fmtBRL(Number(snap.valor_total) || 0)}</div></div>
          <div><div className="text-muted-foreground">Método</div>
            <div className="font-semibold">{parcelas[0]?.metodoPagamento}</div></div>
          <div><div className="text-muted-foreground">Comissão total do pedido</div>
            <div className="font-semibold">{fmtBRL(parcelas.reduce((s, p) => s + p.comissao, 0))}</div></div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Bruto (cliente)</TableHead>
              <TableHead className="text-right">Líquido (base)</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelas.map((p) => (
              <TableRow key={p.parcelaIndice}>
                <TableCell className="text-xs">{p.descricaoParcela}</TableCell>
                <TableCell>{fmtDate(p.dataVencimento)}</TableCell>
                <TableCell className="text-right">{fmtBRL(p.valorBruto)}</TableCell>
                <TableCell className="text-right">{fmtBRL(p.valorLiquido)}</TableCell>
                <TableCell className="text-right">{(p.percentual * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-right font-semibold">{fmtBRL(p.comissao)}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={p.pago}
                    onCheckedChange={(v) => onToggleParcela(pedido, p.parcelaIndice, !!v)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-sm">
          <div className="rounded border p-3"><div className="text-muted-foreground">Comissão paga</div>
            <div className="text-lg font-bold text-emerald-600">{fmtBRL(totais.pago)}</div></div>
          <div className="rounded border p-3"><div className="text-muted-foreground">A vencer</div>
            <div className="text-lg font-bold">{fmtBRL(totais.aVencer)}</div></div>
          <div className="rounded border p-3"><div className="text-muted-foreground">Inadimplente</div>
            <div className="text-lg font-bold text-destructive">{fmtBRL(totais.inad)}</div></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RelatorioComissoes;