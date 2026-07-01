import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Eye, Pencil, AlertTriangle, CheckCircle2, Clock, Trash2, XCircle, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePedidos } from '@/hooks/usePedidos';
import { derivarComissoes, aplicarStatusPago, ItemComissao, StatusParcelaComissao } from '@/lib/comissoes';
import AlterarPagamentoDialog from '@/components/pedidos/AlterarPagamentoDialog';
import { ConfirmarExclusaoPedidoDialog } from '@/components/pedidos/ConfirmarExclusaoPedidoDialog';
import { MonetizzeConsultaCard } from '@/components/admin/MonetizzeConsultaCard';
import { BraipConsultaCard } from '@/components/admin/BraipConsultaCard';
import { AsaasConsultaCard } from '@/components/admin/AsaasConsultaCard';
import { Pedido } from '@/types/formula';
import { arredondarReais } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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

type StatusPedido = 'pago' | 'parcial' | 'atrasado' | 'em_dia';

function calcularStatusPedido(parcelas: ItemComissao[]): StatusPedido {
  if (!parcelas.length) return 'em_dia';
  const temAtraso = parcelas.some((p) => p.status === 'vencido');
  if (temAtraso) return 'atrasado';
  const todasPagas = parcelas.every((p) => p.status === 'pago');
  if (todasPagas) return 'pago';
  const algumaPaga = parcelas.some((p) => p.status === 'pago');
  if (algumaPaga) return 'parcial';
  return 'em_dia';
}

const badgeStatusPedido = (s: StatusPedido) => {
  if (s === 'pago') return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Pago</Badge>;
  if (s === 'atrasado') return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>;
  if (s === 'parcial') return <Badge className="bg-amber-500 hover:bg-amber-500 text-white"><Clock className="h-3 w-3 mr-1" />Parcialmente Pago</Badge>;
  return <Badge variant="outline">Em dia</Badge>;
};

export function RelatorioComissoes() {
  const { pedidos, alterarPagamento, toggleParcelaPagaAsync, deletePedidoAsync, deletandoPedido } = usePedidos();

  const [mes, setMes] = useState<string>(mesAtualYYYYMM());
  const [mesResumoConsultor, setMesResumoConsultor] = useState<string>(mesAtualYYYYMM());
  const [consultorFiltro, setConsultorFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>('todos');
  const [detalhePedido, setDetalhePedido] = useState<Pedido | null>(null);
  const [editarPedido, setEditarPedido] = useState<Pedido | null>(null);
  const [pedidoParaExcluir, setPedidoParaExcluir] = useState<{ id: string; numero: string } | null>(null);
  const [consultorDetalhe, setConsultorDetalhe] = useState<string | null>(null);

  // Monetizze — total a receber por consultor no mês do resumo
  const [monetizzePorConsultor, setMonetizzePorConsultor] = useState<Record<string, { receber: number; qtd: number }>>({});
  const [braipPorConsultor, setBraipPorConsultor] = useState<Record<string, { receber: number; qtd: number }>>({});

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase
        .from('monetizze_consultas_salvas')
        .select('consultor_nome, valor_consultor')
        .eq('mes', mesResumoConsultor);
      if (!ativo) return;
      const map: Record<string, { receber: number; qtd: number }> = {};
      ((data as any[]) || []).forEach((r) => {
        const nome = r.consultor_nome || '';
        if (!nome) return;
        const ent = map[nome] || { receber: 0, qtd: 0 };
        ent.receber += Number(r.valor_consultor) || 0;
        ent.qtd += 1;
        map[nome] = ent;
      });
      setMonetizzePorConsultor(map);
    };
    carregar();
    const channel = supabase
      .channel(`monetizze-resumo-${mesResumoConsultor}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monetizze_consultas_salvas' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row && row.mes === mesResumoConsultor) carregar();
        },
      )
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
  }, [mesResumoConsultor]);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase
        .from('braip_consultas_salvas' as any)
        .select('consultor_nome, valor_consultor')
        .eq('mes', mesResumoConsultor);
      if (!ativo) return;
      const map: Record<string, { receber: number; qtd: number }> = {};
      ((data as any[]) || []).forEach((r) => {
        const nome = r.consultor_nome || '';
        if (!nome) return;
        const ent = map[nome] || { receber: 0, qtd: 0 };
        ent.receber += Number(r.valor_consultor) || 0;
        ent.qtd += 1;
        map[nome] = ent;
      });
      setBraipPorConsultor(map);
    };
    carregar();
    const channel = supabase
      .channel(`braip-resumo-${mesResumoConsultor}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'braip_consultas_salvas' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row && row.mes === mesResumoConsultor) carregar();
        },
      )
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
  }, [mesResumoConsultor]);

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
      // Mês: usa data efetiva de pagamento quando pago; senão a data de vencimento
      const dt = p.pago && p.dataPagamento ? p.dataPagamento : p.dataVencimento;
      if (!dt) return false;
      return dt.slice(0, 7) === mes;
    });
  }, [todasParcelas, consultorFiltro, tipoFiltro, statusFiltro, mes]);

  // Resumo por consultor — usa filtro de mês PRÓPRIO (independente do filtro global)
  const parcelasResumoConsultor = useMemo(() => {
    return todasParcelas.filter((p) => {
      if (consultorFiltro !== 'todos' && p.consultor !== consultorFiltro) return false;
      if (tipoFiltro !== 'todos' && p.tipoVenda !== tipoFiltro) return false;
      const dt = p.pago && p.dataPagamento ? p.dataPagamento : p.dataVencimento;
      if (!dt) return false;
      return dt.slice(0, 7) === mesResumoConsultor;
    });
  }, [todasParcelas, consultorFiltro, tipoFiltro, mesResumoConsultor]);

  const resumoPorConsultor = useMemo(() => {
    type R = {
      consultor: string;
      recebidoMes: number;
      comissaoPaga: number;
      comissaoAVencer: number;
      comissaoInadimplente: number;
      comissaoMesDesteFechamento: number; // pedidos fechados no mês
      comissaoMesParcelasAntigas: number;  // pedidos fechados em meses anteriores
      monetizzeReceber: number;
      monetizzeQtd: number;
      totalReceber: number;
    };
    const m = new Map<string, R>();
    const criar = (consultor: string): R => ({
      consultor,
      recebidoMes: 0, comissaoPaga: 0, comissaoAVencer: 0, comissaoInadimplente: 0,
      comissaoMesDesteFechamento: 0, comissaoMesParcelasAntigas: 0,
      monetizzeReceber: 0, monetizzeQtd: 0, totalReceber: 0,
    });
    parcelasResumoConsultor.forEach((p) => {
      let r = m.get(p.consultor);
      if (!r) {
        r = criar(p.consultor);
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
    // Aplica Monetizze (mesmo criando o consultor se ele só existir via Monetizze)
    Object.entries(monetizzePorConsultor).forEach(([consultor, v]) => {
      if (consultorFiltro !== 'todos' && consultor !== consultorFiltro) return;
      let r = m.get(consultor);
      if (!r) { r = criar(consultor); m.set(consultor, r); }
      r.monetizzeReceber += v.receber;
      r.monetizzeQtd += v.qtd;
    });
    // Aplica Braip (mesma lógica)
    Object.entries(braipPorConsultor).forEach(([consultor, v]) => {
      if (consultorFiltro !== 'todos' && consultor !== consultorFiltro) return;
      let r = m.get(consultor);
      if (!r) { r = criar(consultor); m.set(consultor, r); }
      (r as any).braipReceber = ((r as any).braipReceber || 0) + v.receber;
      (r as any).braipQtd = ((r as any).braipQtd || 0) + v.qtd;
    });
    // Total a receber = comissão paga + Monetizze + Braip
    m.forEach((r) => {
      r.totalReceber = r.comissaoPaga + r.monetizzeReceber + ((r as any).braipReceber || 0);
    });
    return Array.from(m.values()).sort((a, b) => b.totalReceber - a.totalReceber);
  }, [parcelasResumoConsultor, monetizzePorConsultor, braipPorConsultor, consultorFiltro]);

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
    const linhas: (L & { statusPedido: StatusPedido })[] = [];
    // Indexa parcelas por pedido (a partir de todasParcelas, sem filtro)
    const parcelasPorPedido = new Map<string, ItemComissao[]>();
    todasParcelas.forEach((p) => {
      const arr = parcelasPorPedido.get(p.pedidoId) || [];
      arr.push(p);
      parcelasPorPedido.set(p.pedidoId, arr);
    });
    // Itera pedidos e aplica o MESMO critério da página Pedidos:
    // - inclui pedido cujo snap.data_pagamento (fechamento) cai no mês selecionado
    // - filtros de consultor e tipo de venda aplicados ao pedido
    pedidos.forEach((pedido) => {
      const snap: any = pedido.orcamento_snapshot || {};
      const dataFechamento: string | undefined = snap.data_pagamento;
      if (!dataFechamento) return;
      if (dataFechamento.slice(0, 7) !== mes) return;

      const consultor = snap.consultor_responsavel || '—';
      if (consultorFiltro !== 'todos' && consultor !== consultorFiltro) return;

      const parcelas = parcelasPorPedido.get(pedido.id) || [];
      const tipoVenda: 'nova_venda' | 'recompra' =
        parcelas[0]?.tipoVenda
        || (String(snap.tipo_orcamento || '').includes('recompra') ? 'recompra' : 'nova_venda');
      if (tipoFiltro !== 'todos' && tipoVenda !== tipoFiltro) return;

      // Filtro de status da parcela: pedido entra se tiver pelo menos uma parcela no status
      if (statusFiltro !== 'todos' && !parcelas.some((p) => p.status === statusFiltro)) return;

      const comissaoTotalPedido = arredondarReais(
        parcelas.reduce((s, p) => s + p.comissao, 0),
      );
      const comissaoNoMes = arredondarReais(
        parcelas.reduce((s, p) => {
          const dt = p.pago && p.dataPagamento ? p.dataPagamento : p.dataVencimento;
          if (!dt || dt.slice(0, 7) !== mes) return s;
          return s + p.comissao;
        }, 0),
      );

      linhas.push({
        pedido,
        consultor,
        clienteNome: parcelas[0]?.clienteNome || snap.cliente?.nome || snap.cliente_nome || '—',
        clienteDoc: parcelas[0]?.clienteDoc || snap.cliente?.cpf_cnpj || snap.cliente?.documento || '',
        tipoVenda,
        metodo: parcelas[0]?.metodoPagamento || snap.metodo_pagamento || '—',
        valorTotalPedido: Number(snap.valor_total) || 0,
        comissaoTotalPedido,
        comissaoNoMes,
        temInadimplencia: parcelas.some((p) => p.status === 'vencido'),
        statusPedido: calcularStatusPedido(parcelas),
      });
    });
    return linhas.sort((a, b) => b.comissaoNoMes - a.comissaoNoMes);
  }, [pedidos, todasParcelas, mes, consultorFiltro, tipoFiltro, statusFiltro]);

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
      {/* Monetizze — faturamento real */}
      <MonetizzeConsultaCard />

      {/* Braip — faturamento real */}
      <BraipConsultaCard />

      {/* Asaas — cobranças pagas */}
      <AsaasConsultaCard />

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label>Mês (pagamento/vencimento)</Label>
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Comissão por consultor — {mesResumoConsultor}</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Mês</Label>
            <Input
              type="month"
              value={mesResumoConsultor}
              onChange={(e) => setMesResumoConsultor(e.target.value || mesAtualYYYYMM())}
              className="h-8 w-[160px]"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMesResumoConsultor(mesAtualYYYYMM())}
              className="h-8"
            >
              Mês atual
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Comissão paga</TableHead>
                <TableHead className="text-right">Monetizze (mês)</TableHead>
                <TableHead className="text-right">Total a receber</TableHead>
                <TableHead className="text-right">A vencer</TableHead>
                <TableHead className="text-right">Inadimplente</TableHead>
                <TableHead className="text-right">Deste mês</TableHead>
                <TableHead className="text-right">Parcelas antigas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumoPorConsultor.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem movimentação no período</TableCell></TableRow>
              ) : resumoPorConsultor.map((r) => (
                <TableRow
                  key={r.consultor}
                  className="cursor-pointer hover:bg-muted/50"
                  tabIndex={0}
                  onClick={() => setConsultorDetalhe(r.consultor)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setConsultorDetalhe(r.consultor);
                    }
                  }}
                >
                  <TableCell className="font-medium underline-offset-4 hover:underline">{r.consultor}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.recebidoMes)}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-semibold">{fmtBRL(r.comissaoPaga)}</TableCell>
                  <TableCell className="text-right text-sky-600 font-medium">
                    {fmtBRL(r.monetizzeReceber)}
                    {r.monetizzeQtd > 0 && (
                      <div className="text-[10px] text-muted-foreground font-normal">{r.monetizzeQtd} consulta(s)</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">{fmtBRL(r.totalReceber)}</TableCell>
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
        <CardHeader>
          <CardTitle className="text-base">Pedidos no período</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Lista de pedidos fechados no mês (mesmo critério da página Pedidos). A coluna "Comissão no mês" considera apenas parcelas com vencimento/pagamento no mês selecionado.
          </p>
        </CardHeader>
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
                  <TableCell>{badgeStatusPedido(l.statusPedido)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDetalhePedido(l.pedido)}>
                        <Eye className="h-3 w-3 mr-1" />Detalhes
                      </Button>
                      <ConfirmarParcelasPopover
                        pedido={l.pedido}
                        onToggleParcela={async (pedido, indice, marcarPago) => {
                          const snap: any = pedido.orcamento_snapshot || {};
                          const cond = snap.condicoes_pagamento;
                          const novas = aplicarStatusPago(cond, indice, marcarPago);
                          await toggleParcelaPagaAsync({ id: pedido.id, novasCondicoes: novas });
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => setEditarPedido(l.pedido)}>
                        <Pencil className="h-3 w-3 mr-1" />Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setPedidoParaExcluir({ id: l.pedido.id, numero: l.pedido.numero_pedido })}>
                        <Trash2 className="h-3 w-3 mr-1" />Excluir
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

      <ConfirmarExclusaoPedidoDialog
        open={!!pedidoParaExcluir}
        onOpenChange={(o) => { if (!o && !deletandoPedido) setPedidoParaExcluir(null); }}
        numeroPedido={pedidoParaExcluir?.numero ?? ''}
        loading={deletandoPedido}
        onConfirm={async () => {
          if (!pedidoParaExcluir) return;
          try {
            await deletePedidoAsync(pedidoParaExcluir.id);
            if (detalhePedido?.id === pedidoParaExcluir.id) setDetalhePedido(null);
            if (editarPedido?.id === pedidoParaExcluir.id) setEditarPedido(null);
            setPedidoParaExcluir(null);
          } catch {
            return;
          }
        }}
      />

      <DetalheConsultorDialog
        consultor={consultorDetalhe}
        mes={mesResumoConsultor}
        parcelas={consultorDetalhe ? parcelasResumoConsultor.filter((p) => p.consultor === consultorDetalhe) : []}
        onClose={() => setConsultorDetalhe(null)}
        onAbrirPedido={(pedidoId) => {
          const ped = pedidos.find((x) => x.id === pedidoId);
          if (ped) {
            setConsultorDetalhe(null);
            setDetalhePedido(ped);
          }
        }}
      />
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

function DetalheConsultorDialog({
  consultor,
  mes,
  parcelas,
  onClose,
  onAbrirPedido,
}: {
  consultor: string | null;
  mes: string;
  parcelas: ItemComissao[];
  onClose: () => void;
  onAbrirPedido: (pedidoId: string) => void;
}) {
  type MonetizzeRow = {
    id: string;
    filtro_produto_nome: string | null;
    quantidade_vendida: number;
    faturamento_total: number;
    comissao_total: number;
    percentual: number;
    valor_consultor: number;
    observacao: string | null;
    created_at: string;
  };
  const [monetizze, setMonetizze] = useState<MonetizzeRow[]>([]);
  const [braip, setBraip] = useState<MonetizzeRow[]>([]);

  useEffect(() => {
    if (!consultor) { setMonetizze([]); return; }
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase
        .from('monetizze_consultas_salvas')
        .select('id, filtro_produto_nome, quantidade_vendida, faturamento_total, comissao_total, percentual, valor_consultor, observacao, created_at')
        .eq('consultor_nome', consultor)
        .eq('mes', mes)
        .order('created_at', { ascending: false });
      if (ativo) setMonetizze((data || []) as MonetizzeRow[]);
    };
    carregar();

    const channel = supabase
      .channel(`monetizze-detalhe-${consultor}-${mes}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monetizze_consultas_salvas' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row) return;
          if (row.consultor_nome === consultor && row.mes === mes) carregar();
        },
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
  }, [consultor, mes]);

  useEffect(() => {
    if (!consultor) { setBraip([]); return; }
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase
        .from('braip_consultas_salvas' as any)
        .select('id, filtro_produto_nome, quantidade_vendida, faturamento_total, comissao_total, percentual, valor_consultor, observacao, created_at')
        .eq('consultor_nome', consultor)
        .eq('mes', mes)
        .order('created_at', { ascending: false });
      if (ativo) setBraip(((data as any[]) || []) as MonetizzeRow[]);
    };
    carregar();

    const channel = supabase
      .channel(`braip-detalhe-${consultor}-${mes}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'braip_consultas_salvas' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row) return;
          if (row.consultor_nome === consultor && row.mes === mes) carregar();
        },
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(channel);
    };
  }, [consultor, mes]);

  const totMonetizze = useMemo(() => {
    return monetizze.reduce(
      (a, r) => {
        a.faturamento += Number(r.faturamento_total) || 0;
        a.comissao += Number(r.comissao_total) || 0;
        a.receber += Number(r.valor_consultor) || 0;
        return a;
      },
      { faturamento: 0, comissao: 0, receber: 0 },
    );
  }, [monetizze]);

  const totBraip = useMemo(() => {
    return braip.reduce(
      (a, r) => {
        a.faturamento += Number(r.faturamento_total) || 0;
        a.comissao += Number(r.comissao_total) || 0;
        a.receber += Number(r.valor_consultor) || 0;
        return a;
      },
      { faturamento: 0, comissao: 0, receber: 0 },
    );
  }, [braip]);

  const totais = useMemo(() => {
    const base = parcelas.reduce(
      (a, p) => {
        if (p.status === 'pago') { a.pago += p.comissao; a.recebido += p.valorBruto; }
        else if (p.status === 'vencido') a.inad += p.comissao;
        else if (p.status === 'pendente') a.aVencer += p.comissao;
        return a;
      },
      { pago: 0, aVencer: 0, inad: 0, recebido: 0 },
    );
    // Monetizze + Braip contam como recebido/pago no mês
    base.pago += totMonetizze.receber + totBraip.receber;
    base.recebido += totMonetizze.faturamento + totBraip.faturamento;
    return base;
  }, [parcelas, totMonetizze, totBraip]);

  const pagas = parcelas.filter((p) => p.status === 'pago');
  const aVencer = parcelas.filter((p) => p.status === 'pendente');
  const inadimplentes = parcelas.filter((p) => p.status === 'vencido');
  const semData = parcelas.filter((p) => p.status === 'sem_data');

  const exportar = () => {
    if (!consultor) return;
    const headers = [
      'Pedido', 'Cliente', 'CPF/CNPJ', 'Tipo', 'Método',
      'Parcela', 'Vencimento', 'Pagamento', 'Valor bruto', 'Valor líquido', '%', 'Comissão', 'Status',
    ];
    const rows = parcelas.map((p) => [
      p.numeroPedido, p.clienteNome, p.clienteDoc,
      p.tipoVenda === 'recompra' ? 'Recompra' : 'Nova venda',
      p.metodoPagamento, p.descricaoParcela,
      fmtDate(p.dataVencimento), fmtDate(p.dataPagamento),
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
    a.download = `comissao_${consultor}_${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderGrupo = (titulo: string, lista: ItemComissao[], destaque: 'pago' | 'pendente' | 'vencido' | 'neutro') => {
    if (!lista.length) return null;
    const subtotal = lista.reduce((s, p) => s + p.comissao, 0);
    const cor =
      destaque === 'pago' ? 'text-emerald-600'
      : destaque === 'vencido' ? 'text-destructive'
      : destaque === 'pendente' ? 'text-amber-600'
      : '';
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{titulo} <span className="text-muted-foreground font-normal">({lista.length})</span></div>
          <div className={`text-sm font-semibold ${cor}`}>Subtotal: {fmtBRL(subtotal)}</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((p, i) => (
              <TableRow
                key={`${p.pedidoId}-${p.parcelaIndice}-${i}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onAbrirPedido(p.pedidoId)}
              >
                <TableCell className="font-medium">{p.numeroPedido}</TableCell>
                <TableCell className="max-w-[180px] truncate" title={p.clienteNome}>{p.clienteNome}</TableCell>
                <TableCell className="text-xs">{p.tipoVenda === 'recompra' ? 'Recompra (1%)' : 'Nova (5%)'}</TableCell>
                <TableCell className="text-xs">{p.descricaoParcela}</TableCell>
                <TableCell>{fmtDate(p.dataVencimento)}</TableCell>
                <TableCell>{fmtDate(p.dataPagamento)}</TableCell>
                <TableCell className="text-right">{fmtBRL(p.valorBruto)}</TableCell>
                <TableCell className="text-right">{fmtBRL(p.valorLiquido)}</TableCell>
                <TableCell className="text-right">{(p.percentual * 100).toFixed(0)}%</TableCell>
                <TableCell className={`text-right font-semibold ${cor}`}>{fmtBRL(p.comissao)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={!!consultor} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhamento da comissão — {consultor}</DialogTitle>
          <DialogDescription>
            Mês de referência: {mes}. Comissão calculada sobre parcelas efetivamente recebidas — não pelo parcelamento contratado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded border p-3">
            <div className="text-muted-foreground">Recebido (bruto)</div>
            <div className="text-lg font-bold">{fmtBRL(totais.recebido)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-muted-foreground">Comissão paga</div>
            <div className="text-lg font-bold text-emerald-600">{fmtBRL(totais.pago)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-muted-foreground">A vencer</div>
            <div className="text-lg font-bold text-amber-600">{fmtBRL(totais.aVencer)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-muted-foreground">Inadimplente</div>
            <div className="text-lg font-bold text-destructive">{fmtBRL(totais.inad)}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={exportar} disabled={!parcelas.length}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        {parcelas.length === 0 && monetizze.length === 0 && braip.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Sem parcelas no período para este consultor.
          </div>
        ) : (
          <div className="space-y-6">
            {(pagas.length > 0 || monetizze.length > 0 || braip.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    Pagas no mês <span className="text-muted-foreground font-normal">({pagas.length + monetizze.length + braip.length})</span>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">
                    Subtotal: {fmtBRL(pagas.reduce((s, p) => s + p.comissao, 0) + totMonetizze.receber + totBraip.receber)}
                  </div>
                </div>
                {pagas.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagas.map((p, i) => (
                        <TableRow
                          key={`${p.pedidoId}-${p.parcelaIndice}-${i}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onAbrirPedido(p.pedidoId)}
                        >
                          <TableCell className="font-medium">{p.numeroPedido}</TableCell>
                          <TableCell className="max-w-[180px] truncate" title={p.clienteNome}>{p.clienteNome}</TableCell>
                          <TableCell className="text-xs">{p.tipoVenda === 'recompra' ? 'Recompra (1%)' : 'Nova (5%)'}</TableCell>
                          <TableCell className="text-xs">{p.descricaoParcela}</TableCell>
                          <TableCell>{fmtDate(p.dataVencimento)}</TableCell>
                          <TableCell>{fmtDate(p.dataPagamento)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.valorBruto)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.valorLiquido)}</TableCell>
                          <TableCell className="text-right">{(p.percentual * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(p.comissao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {monetizze.length > 0 && (
                  <div className="rounded-md border bg-sky-50/40 dark:bg-sky-950/10 p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                        Monetizze — consultas salvas ({monetizze.length})
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <div><span className="text-muted-foreground">Faturamento: </span><span className="font-semibold">{fmtBRL(totMonetizze.faturamento)}</span></div>
                        <div><span className="text-muted-foreground">Comissão bruta: </span><span className="font-semibold">{fmtBRL(totMonetizze.comissao)}</span></div>
                        <div><span className="text-muted-foreground">A receber: </span><span className="font-semibold text-emerald-600">{fmtBRL(totMonetizze.receber)}</span></div>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Salvo em</TableHead>
                          <TableHead>Produto (filtro)</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Comissão bruta</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">A receber</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monetizze.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                            <TableCell className="text-xs">{r.filtro_produto_nome || 'Todos'}</TableCell>
                            <TableCell className="text-right">{r.quantidade_vendida}</TableCell>
                            <TableCell className="text-right">{fmtBRL(Number(r.faturamento_total))}</TableCell>
                            <TableCell className="text-right">{fmtBRL(Number(r.comissao_total))}</TableCell>
                            <TableCell className="text-right">{Number(r.percentual).toFixed(2)}%</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(Number(r.valor_consultor))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {braip.length > 0 && (
                  <div className="rounded-md border bg-orange-50/40 dark:bg-orange-950/10 p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                        Braip — consultas salvas ({braip.length})
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <div><span className="text-muted-foreground">Faturamento: </span><span className="font-semibold">{fmtBRL(totBraip.faturamento)}</span></div>
                        <div><span className="text-muted-foreground">Comissão bruta: </span><span className="font-semibold">{fmtBRL(totBraip.comissao)}</span></div>
                        <div><span className="text-muted-foreground">A receber: </span><span className="font-semibold text-emerald-600">{fmtBRL(totBraip.receber)}</span></div>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Salvo em</TableHead>
                          <TableHead>Produto (filtro)</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Comissão bruta</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">A receber</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {braip.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                            <TableCell className="text-xs">{r.filtro_produto_nome || 'Todos'}</TableCell>
                            <TableCell className="text-right">{r.quantidade_vendida}</TableCell>
                            <TableCell className="text-right">{fmtBRL(Number(r.faturamento_total))}</TableCell>
                            <TableCell className="text-right">{fmtBRL(Number(r.comissao_total))}</TableCell>
                            <TableCell className="text-right">{Number(r.percentual).toFixed(2)}%</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(Number(r.valor_consultor))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
            {renderGrupo('A vencer no mês', aVencer, 'pendente')}
            {renderGrupo('Inadimplentes no mês', inadimplentes, 'vencido')}
            {renderGrupo('Sem data definida', semData, 'neutro')}
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-2">
          Clique em uma parcela para abrir o detalhamento do pedido e confirmar pagamentos.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarParcelasPopover({
  pedido,
  onToggleParcela,
}: {
  pedido: Pedido;
  onToggleParcela: (pedido: Pedido, indice: number, marcarPago: boolean) => Promise<void>;
}) {
  const parcelas = useMemo(() => derivarComissoes(pedido), [pedido]);
  const totalPagas = parcelas.filter((p) => p.pago).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" title="Confirmar pagamentos">
          <CheckSquare className="h-3 w-3 mr-1" />
          {totalPagas}/{parcelas.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-h-[60vh] overflow-y-auto" align="end">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Confirmar pagamentos — {pedido.numero_pedido}</div>
          <p className="text-xs text-muted-foreground">
            Marque cada parcela conforme o pagamento for confirmado. O status do pedido só vira "Pago" quando todas estiverem marcadas.
          </p>
          <div className="divide-y">
            {parcelas.map((p) => (
              <div key={p.parcelaIndice} className="flex items-center gap-3 py-2">
                <Checkbox
                  checked={p.pago}
                  onCheckedChange={(v) => onToggleParcela(pedido, p.parcelaIndice, !!v)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.descricaoParcela}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Venc: {fmtDate(p.dataVencimento)} · {fmtBRL(p.valorBruto)}
                  </div>
                </div>
                <div className="shrink-0">{statusBadge(p.status)}</div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}