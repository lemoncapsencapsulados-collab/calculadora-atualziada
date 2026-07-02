import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Loader2, UserSearch, ChevronLeft, Info, RefreshCw, FileSpreadsheet, AlertTriangle, ChevronDown, ChevronRight, TrendingUp, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUsuarios } from '@/hooks/useUsuarios';
import { carregarAnaliseVendedor, carregarAnaliseTimeVendas, formatBRL, gerarCSVAnalise, TIME_VENDAS_ID, TIME_VENDAS_LABEL, type AnaliseVendedor } from '@/lib/analiseVendedor';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { calcularCPL } from '@/lib/anuncios';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AnaliseVendedorDialog({ open, onOpenChange }: Props) {
  const { data: usuarios = [] } = useUsuarios(true);
  const [vendedor, setVendedor] = useState<string | null>(null);
  const [mesStr, setMesStr] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [analise, setAnalise] = useState<AnaliseVendedor | null>(null);
  const [setupExpandido, setSetupExpandido] = useState<string | null>(null);

  const mesData = useMemo(() => {
    const [y, m] = mesStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1);
  }, [mesStr]);

  const consultores = useMemo(
    () => usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [usuarios]
  );

  // Leads pagos + investimento em anúncios do vendedor no mês (funil topo)
  const { data: anuncios } = useQuery({
    queryKey: ['analise-anuncios', vendedor, mesStr],
    enabled: !!vendedor,
    queryFn: async () => {
      const di = startOfMonth(mesData).toISOString().slice(0, 10);
      const df = endOfMonth(mesData).toISOString().slice(0, 10);
      const { data: invs } = await supabase
        .from('ad_investments' as any)
        .select('id, data_inicio, data_fim')
        .lte('data_inicio', df)
        .gte('data_fim', di);
      const ids = ((invs as any[]) || []).map((i) => i.id);
      if (ids.length === 0) return { leads: 0, invest: 0 };
      const { data: rows } = await supabase
        .from('ad_investment_consultores' as any)
        .select('leads_recebidos, investimento_direcionado, consultor_nome_snapshot')
        .in('ad_investment_id', ids);
      let leads = 0;
      let invest = 0;
      const alvo = vendedor === TIME_VENDAS_ID
        ? new Set(consultores.map((c) => c.nome.trim().toLowerCase()))
        : new Set([String(vendedor || '').trim().toLowerCase()]);
      for (const r of (rows as any[]) || []) {
        const nome = String(r.consultor_nome_snapshot || '').trim().toLowerCase();
        if (!alvo.has(nome)) continue;
        leads += Number(r.leads_recebidos) || 0;
        invest += Number(r.investimento_direcionado) || 0;
      }
      return { leads, invest };
    },
  });

  useEffect(() => {
    if (!open) {
      setVendedor(null);
      setAnalise(null);
    }
  }, [open]);

  const recalcular = (silent = false) => {
    if (!vendedor) return;
    setLoading(true);
    setSetupExpandido(null);
    const promise =
      vendedor === TIME_VENDAS_ID
        ? carregarAnaliseTimeVendas(mesData, consultores.map((c) => c.nome))
        : carregarAnaliseVendedor(vendedor, mesData);
    promise
      .then((a) => {
        setAnalise(a);
        if (!silent) toast.success('Análise atualizada');
      })
      .catch((e) => {
        console.error(e);
        toast.error('Erro ao carregar análise');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!vendedor) return;
    recalcular(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedor, mesData]);

  // Realtime: refaz a análise quando uma consulta Monetizze deste consultor é
  // salva/alterada/excluída no mês em exibição.
  useEffect(() => {
    if (!vendedor) return;
    const mesStr = format(mesData, 'yyyy-MM');
    const channel = supabase
      .channel(`monetizze-consultas-${vendedor}-${mesStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monetizze_consultas_salvas',
          ...(vendedor === TIME_VENDAS_ID ? {} : { filter: `consultor_nome=eq.${vendedor}` }),
        },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row || row.mes === mesStr) recalcular(true);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedor, mesData]);

  // Realtime: refaz a análise quando uma consulta Braip deste consultor é
  // salva/alterada/excluída no mês em exibição.
  useEffect(() => {
    if (!vendedor) return;
    const mesStrLocal = format(mesData, 'yyyy-MM');
    const channel = supabase
      .channel(`braip-consultas-${vendedor}-${mesStrLocal}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'braip_consultas_salvas',
          ...(vendedor === TIME_VENDAS_ID ? {} : { filter: `consultor_nome=eq.${vendedor}` }),
        },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row || row.mes === mesStrLocal) recalcular(true);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedor, mesData]);

  const exportarCSV = () => {
    if (!analise) return;
    const csv = gerarCSVAnalise(analise);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analise-${analise.vendedor.replace(/\s+/g, '_')}-${format(analise.mes, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    if (!analise) return;
    const doc = new jsPDF();
    const mesLabel = format(analise.mes, "MMMM 'de' yyyy", { locale: ptBR });
    doc.setFontSize(16);
    doc.text('Análise Apurada do Vendedor', 14, 18);
    doc.setFontSize(11);
    doc.text(`Vendedor: ${analise.vendedor}`, 14, 26);
    doc.text(`Período: ${mesLabel}`, 14, 32);

    autoTable(doc, {
      startY: 38,
      head: [['Métrica', 'Valor']],
      body: [
        ['Vendas realizadas', String(analise.qtdVendas)],
        ['Orçamentos gerados', String(analise.qtdOrcamentos)],
        ['Taxa de conversão', `${(analise.taxaConversao * 100).toFixed(1)}%`],
        ['Receita total (vendas)', formatBRL(analise.receitaTotal)],
        ['Ticket médio', formatBRL(analise.ticketMedio)],
        ['Valor em negociação', formatBRL(analise.valorEmNegociacao)],
        ['Total de potes vendidos', String(analise.totalPotes)],
        ['Maior volume em uma venda', `${analise.maiorVolumePotesVenda} potes`],
      ],
    });

    autoTable(doc, {
      head: [['Tipo de produto', 'Potes vendidos']],
      body: Object.entries(analise.potesPorTipo).map(([t, q]) => [t, String(q)]),
    });

    autoTable(doc, {
      head: [['Produto', 'Nº de vendas', 'Potes', 'Receita']],
      body: analise.produtosVendidos.map((p) => [
        p.nome,
        String(p.vezes),
        String(p.qtdPotes),
        formatBRL(p.receita),
      ]),
    });

    autoTable(doc, {
      head: [['Setup', 'Qtd vendida', 'Valor total']],
      body: analise.setupsVendidos.map((s) => [
        s.nome,
        String(s.quantidade),
        formatBRL(s.valorTotal),
      ]),
    });

    autoTable(doc, {
      head: [['Setup — Resumo', 'Valor']],
      body: [
        ['Setup mais vendido', analise.setupMaisVendido || '—'],
        ['Valor médio do setup', formatBRL(analise.valorMedioSetup)],
        ['Maior valor de setup vendido', formatBRL(analise.maiorValorSetup)],
      ],
    });

    doc.setFontSize(8);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.save(`analise-${analise.vendedor.replace(/\s+/g, '_')}-${format(analise.mes, 'yyyy-MM')}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {vendedor === TIME_VENDAS_ID ? <Users className="w-5 h-5" /> : <UserSearch className="w-5 h-5" />}
            {vendedor
              ? `Análise Apurada — ${vendedor === TIME_VENDAS_ID ? TIME_VENDAS_LABEL : vendedor}`
              : 'Escolha o vendedor para análise'}
          </DialogTitle>
        </DialogHeader>

        {!vendedor ? (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {consultores.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Nenhum consultor ativo cadastrado.
                </p>
              )}
              {consultores.map((u) => (
                <Button
                  key={u.id}
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => setVendedor(u.nome)}
                >
                  <div className="text-left">
                    <div className="font-medium">{u.nome}</div>
                    <div className="text-xs text-muted-foreground">{u.cargo}</div>
                  </div>
                </Button>
              ))}
            </div>
            {consultores.length > 0 && (
              <Button
                className="mt-4 w-full h-auto py-3 gap-2"
                onClick={() => setVendedor(TIME_VENDAS_ID)}
              >
                <Users className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium">Time de Vendas — Análise Geral do Mês</div>
                  <div className="text-xs opacity-80">
                    Soma de todos os {consultores.length} consultores ativos
                  </div>
                </div>
              </Button>
            )}
          </ScrollArea>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setVendedor(null)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Trocar vendedor
                </Button>
                <Input
                  type="month"
                  value={mesStr}
                  onChange={(e) => setMesStr(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => recalcular(false)} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Recalcular
                </Button>
                <Button size="sm" variant="outline" onClick={exportarCSV} disabled={!analise || loading}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
                </Button>
                <Button size="sm" onClick={exportarPDF} disabled={!analise || loading}>
                  <Download className="w-4 h-4 mr-1" /> PDF
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 pr-2">
              {loading || !analise ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando análise...
                </div>
              ) : (
                <div className="space-y-4 pb-6">
                  {analise.avisosServicosMarca.length > 0 && (
                    <Card className="border-yellow-500/40 bg-yellow-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                          <AlertTriangle className="w-4 h-4" />
                          Avisos de Serviços de Marca ({analise.avisosServicosMarca.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-2">
                          Pedidos cujo snapshot não persistiu os serviços de marca — usados dados atuais do orçamento como fallback. Reabra e salve o pedido para corrigir o snapshot.
                        </p>
                        <ul className="text-sm space-y-1 max-h-32 overflow-auto">
                          {analise.avisosServicosMarca.map((w) => (
                            <li key={w.pedidoId}>
                              <span className="font-medium">#{w.numeroPedido ?? w.pedidoId.slice(0, 8)}</span> — {w.cliente}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Funil Completo: Leads → Orçamentos → Vendas */}
                  {(() => {
                    const leads = anuncios?.leads || 0;
                    const invest = anuncios?.invest || 0;
                    const orc = analise.qtdOrcamentos;
                    const vend = analise.qtdVendas;
                    const max = Math.max(leads, orc, vend, 1);
                    const bar = (label: string, value: number, color: string) => (
                      <div className="flex items-center gap-2">
                        <div className="w-28 text-xs text-muted-foreground">{label}</div>
                        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                          <div
                            className={`h-full ${color} flex items-center justify-end px-2 text-[11px] text-white font-semibold`}
                            style={{ width: `${Math.max((value / max) * 100, 4)}%` }}
                          >
                            {value}
                          </div>
                        </div>
                      </div>
                    );
                    const tLO = leads > 0 ? (orc / leads) * 100 : 0;
                    const tOV = orc > 0 ? (vend / orc) * 100 : 0;
                    const tLV = leads > 0 ? (vend / leads) * 100 : 0;
                    return (
                      <Card className="border-primary/40 bg-primary/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Funil Completo — Captação até Conversão
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {leads === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Sem leads registrados em Investimento em Anúncios para este vendedor no mês. Cadastre em Investimento em Anúncios para ver o funil completo.
                            </p>
                          )}
                          <div className="space-y-1.5">
                            {bar('Leads', leads, 'bg-blue-500')}
                            {bar('Orçamentos', orc, 'bg-amber-500')}
                            {bar('Vendas', vend, 'bg-emerald-500')}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            <MetricCard label="Lead→Orç" value={`${tLO.toFixed(1)}%`} />
                            <MetricCard label="Orç→Venda" value={`${tOV.toFixed(1)}%`} />
                            <MetricCard label="Lead→Venda" value={`${tLV.toFixed(1)}%`} />
                            <MetricCard label="Custo/Orçamento" value={formatBRL(orc > 0 ? invest / orc : 0)} />
                            <MetricCard label="Custo/Venda (CAC)" value={formatBRL(vend > 0 ? invest / vend : 0)} />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            <MetricCard label="Investimento em Anúncios" value={formatBRL(invest)} />
                            <MetricCard label="Leads Pagos" value={leads} />
                            <MetricCard label="CPL" value={formatBRL(calcularCPL(invest, leads))} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard label="Vendas" value={analise.qtdVendas} />
                    <MetricCard label="Orçamentos" value={analise.qtdOrcamentos} />
                    <MetricCard
                      label="Conversão"
                      value={`${(analise.taxaConversao * 100).toFixed(1)}%`}
                    />
                    <MetricCard label="Receita" value={formatBRL(analise.receitaTotal)} />
                    <MetricCard label="Ticket médio" value={formatBRL(analise.ticketMedio)} />
                    <MetricCard label="Em negociação" value={formatBRL(analise.valorEmNegociacao)} />
                    <MetricCard label="Total de potes" value={analise.totalPotes} />
                    <MetricCard
                      label="Maior venda (potes)"
                      value={analise.maiorVolumePotesVenda}
                    />
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Potes por tipo de produto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(analise.potesPorTipo).map(([tipo, qtd]) => (
                          <Badge key={tipo} variant="secondary" className="text-sm">
                            {tipo}: <span className="ml-1 font-bold">{qtd}</span>
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        Produtos vendidos ({analise.produtosVendidos.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analise.produtosVendidos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum produto vendido no período.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr className="text-left">
                                <th className="py-1 pr-2">Produto</th>
                                <th className="py-1 pr-2">
                                  <span className="inline-flex items-center gap-1">
                                    Nº de vendas
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Quantas vendas diferentes incluíram este produto
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </span>
                                </th>
                                <th className="py-1 pr-2">Potes</th>
                                <th className="py-1">Receita</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analise.produtosVendidos.map((p) => (
                                <tr key={p.nome} className="border-b last:border-0">
                                  <td className="py-1 pr-2">{p.nome}</td>
                                  <td className="py-1 pr-2">{p.vezes}</td>
                                  <td className="py-1 pr-2">{p.qtdPotes}</td>
                                  <td className="py-1">{formatBRL(p.receita)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Setups vendidos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Mais vendido</p>
                          <p className="font-semibold">{analise.setupMaisVendido || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor médio</p>
                          <p className="font-semibold">{formatBRL(analise.valorMedioSetup)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Maior valor vendido</p>
                          <p className="font-semibold">{formatBRL(analise.maiorValorSetup)}</p>
                        </div>
                      </div>
                      {analise.setupsVendidos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum setup vendido.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr className="text-left">
                                <th className="py-1 pr-2 w-6"></th>
                                <th className="py-1 pr-2">Setup</th>
                                <th className="py-1 pr-2">Qtd</th>
                                <th className="py-1">Valor total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analise.setupsVendidos.map((s) => (
                                <Fragment key={s.nome}>
                                  <tr
                                    className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                                    onClick={() => setSetupExpandido(setupExpandido === s.nome ? null : s.nome)}
                                  >
                                    <td className="py-1 pr-2">
                                      {setupExpandido === s.nome ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </td>
                                    <td className="py-1 pr-2">{s.nome}</td>
                                    <td className="py-1 pr-2">{s.quantidade}</td>
                                    <td className="py-1">{formatBRL(s.valorTotal)}</td>
                                  </tr>
                                  {setupExpandido === s.nome && (
                                    <tr className="bg-muted/20">
                                      <td></td>
                                      <td colSpan={3} className="py-2 pr-2">
                                        <div className="text-xs font-medium text-muted-foreground mb-1">
                                          Pedidos com este setup:
                                        </div>
                                        <ul className="text-xs space-y-1">
                                          {(analise.vendasPorSetup[s.nome] || []).map((v, i) => (
                                            <li key={`${v.pedidoId}-${i}`} className="flex justify-between gap-3">
                                              <span>
                                                <span className="font-mono">#{v.numeroPedido ?? v.pedidoId.slice(0, 8)}</span>
                                                {' — '}
                                                {v.cliente}
                                                {v.data && (
                                                  <span className="text-muted-foreground">
                                                    {' · '}{format(new Date(v.data), 'dd/MM/yyyy')}
                                                  </span>
                                                )}
                                              </span>
                                              <span className="font-medium">{formatBRL(v.valor)}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-500/40 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        Comissão Monetizze (consultas salvas)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analise.monetizzeConsultas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma consulta Monetizze salva para este consultor no mês. Vá em Painel Administrador → Comissionamento → Consultar Monetizze e salve vinculado a {analise.vendedor}.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Consultas salvas</p>
                              <p className="font-semibold">{analise.monetizzeConsultas.length}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Comissão real (bruta)</p>
                              <p className="font-semibold">{formatBRL(analise.monetizzeComissaoBruta)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total a receber</p>
                              <p className="font-bold text-emerald-600">{formatBRL(analise.monetizzeTotalReceber)}</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b">
                                <tr className="text-left">
                                  <th className="py-1 pr-2">Data</th>
                                  <th className="py-1 pr-2">Filtro</th>
                                  <th className="py-1 pr-2">Vendas</th>
                                  <th className="py-1 pr-2">Comissão real</th>
                                  <th className="py-1 pr-2">%</th>
                                  <th className="py-1">A receber</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analise.monetizzeConsultas.map((c) => (
                                  <tr key={c.id} className="border-b last:border-0">
                                    <td className="py-1 pr-2">{format(new Date(c.createdAt), 'dd/MM/yyyy')}</td>
                                    <td className="py-1 pr-2">{c.filtroProduto || '—'}</td>
                                    <td className="py-1 pr-2">{c.quantidadeVendida}</td>
                                    <td className="py-1 pr-2">{formatBRL(c.comissaoTotal)}</td>
                                    <td className="py-1 pr-2">{c.percentual}%</td>
                                    <td className="py-1 font-semibold text-emerald-600">{formatBRL(c.valorConsultor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-orange-500/40 bg-orange-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                        Comissão Braip (consultas salvas)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analise.braipConsultas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma consulta Braip salva para este consultor no mês. Vá em Painel Administrador → Comissionamento → Consultar Braip e salve vinculado a {analise.vendedor}.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Consultas salvas</p>
                              <p className="font-semibold">{analise.braipConsultas.length}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Comissão real (bruta)</p>
                              <p className="font-semibold">{formatBRL(analise.braipComissaoBruta)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total a receber</p>
                              <p className="font-bold text-orange-600">{formatBRL(analise.braipTotalReceber)}</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b">
                                <tr className="text-left">
                                  <th className="py-1 pr-2">Data</th>
                                  <th className="py-1 pr-2">Filtro</th>
                                  <th className="py-1 pr-2">Vendas</th>
                                  <th className="py-1 pr-2">Comissão real</th>
                                  <th className="py-1 pr-2">%</th>
                                  <th className="py-1">A receber</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analise.braipConsultas.map((c) => (
                                  <tr key={c.id} className="border-b last:border-0">
                                    <td className="py-1 pr-2">{format(new Date(c.createdAt), 'dd/MM/yyyy')}</td>
                                    <td className="py-1 pr-2">{c.filtroProduto || '—'}</td>
                                    <td className="py-1 pr-2">{c.quantidadeVendida}</td>
                                    <td className="py-1 pr-2">{formatBRL(c.comissaoTotal)}</td>
                                    <td className="py-1 pr-2">{c.percentual}%</td>
                                    <td className="py-1 font-semibold text-orange-600">{formatBRL(c.valorConsultor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}