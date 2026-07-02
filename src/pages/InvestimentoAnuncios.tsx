import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Megaphone, ChevronDown, ChevronRight, FileSpreadsheet, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAdInvestments, AdInvestment } from '@/hooks/useAdInvestments';
import { useUsuarios } from '@/hooks/useUsuarios';
import RegistroInvestimentoDialog from '@/components/anuncios/RegistroInvestimentoDialog';
import { CANAIS_VENDAS, calcularCPL, formatBRL, labelCanal, labelObjetivo } from '@/lib/anuncios';

function intersectaPeriodo(ini: string, fim: string, di: Date, df: Date): boolean {
  const a = new Date(ini + 'T00:00:00');
  const b = new Date(fim + 'T23:59:59');
  return a <= df && b >= di;
}

export default function InvestimentoAnuncios() {
  const [mesStr, setMesStr] = useState(() => format(new Date(), 'yyyy-MM'));
  const [canalFiltro, setCanalFiltro] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<AdInvestment | null>(null);
  const [funilAberto, setFunilAberto] = useState(true);

  const [ano, mes] = mesStr.split('-').map(Number);
  const periodoIni = startOfMonth(new Date(ano, mes - 1, 1));
  const periodoFim = endOfMonth(new Date(ano, mes - 1, 1));

  const { data: registros = [], excluir, isLoading } = useAdInvestments();
  const { data: consultores = [] } = useUsuarios(true);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (canalFiltro !== 'todos' && r.canal !== canalFiltro) return false;
      return intersectaPeriodo(r.data_inicio, r.data_fim, periodoIni, periodoFim);
    });
  }, [registros, canalFiltro, periodoIni, periodoFim]);

  // Agregado por consultor no período filtrado
  const leadsInvestPorConsultor = useMemo(() => {
    const map = new Map<string, { leads: number; invest: number; nome: string }>();
    for (const r of registrosFiltrados) {
      for (const c of r.consultores) {
        const key = (c.consultor_id || `snap:${c.consultor_nome_snapshot}`).toLowerCase();
        const cur = map.get(key) || { leads: 0, invest: 0, nome: c.consultor_nome_snapshot };
        cur.leads += c.leads_recebidos;
        cur.invest += c.investimento_direcionado;
        map.set(key, cur);
      }
    }
    return map;
  }, [registrosFiltrados]);

  const totalInvestido = registrosFiltrados.reduce((s, r) => s + r.investimento_total, 0);
  const totalLeads = Array.from(leadsInvestPorConsultor.values()).reduce((s, v) => s + v.leads, 0);
  const cplMedio = calcularCPL(totalInvestido, totalLeads);

  // Orçamentos e Vendas no período
  const { data: metricasVendas } = useQuery({
    queryKey: ['anuncios-metricas', mesStr],
    queryFn: async () => {
      const ini = periodoIni.toISOString();
      const fim = periodoFim.toISOString();
      const [orcRes, pedRes] = await Promise.all([
        supabase.from('orcamentos').select('consultor_responsavel').gte('created_at', ini).lte('created_at', fim),
        supabase.from('pedidos').select('orcamento_snapshot, data_pedido').gte('data_pedido', ini).lte('data_pedido', fim),
      ]);
      const orc = new Map<string, number>();
      (orcRes.data || []).forEach((o: any) => {
        const n = (o.consultor_responsavel || '').trim();
        if (!n) return;
        orc.set(n.toLowerCase(), (orc.get(n.toLowerCase()) || 0) + 1);
      });
      const ven = new Map<string, number>();
      (pedRes.data || []).forEach((p: any) => {
        const n = (p.orcamento_snapshot?.consultor_responsavel || '').trim();
        if (!n) return;
        ven.set(n.toLowerCase(), (ven.get(n.toLowerCase()) || 0) + 1);
      });
      return { orc, ven };
    },
  });

  const totalVendas = metricasVendas
    ? Array.from(metricasVendas.ven.values()).reduce((s, n) => s + n, 0)
    : 0;
  const cac = totalVendas > 0 ? totalInvestido / totalVendas : 0;

  const funil = useMemo(() => {
    const nomes = new Set<string>();
    consultores.forEach((c) => nomes.add(c.nome));
    leadsInvestPorConsultor.forEach((v) => nomes.add(v.nome));
    return Array.from(nomes)
      .map((nome) => {
        const key = nome.toLowerCase();
        const entradaLeads = Array.from(leadsInvestPorConsultor.entries()).find(
          ([, v]) => v.nome.toLowerCase() === key
        );
        const leads = entradaLeads?.[1].leads || 0;
        const invest = entradaLeads?.[1].invest || 0;
        const orcamentos = metricasVendas?.orc.get(key) || 0;
        const vendas = metricasVendas?.ven.get(key) || 0;
        return {
          nome,
          leads,
          invest,
          orcamentos,
          vendas,
          cpl: calcularCPL(invest, leads),
          custoOrc: orcamentos > 0 ? invest / orcamentos : 0,
          custoVenda: vendas > 0 ? invest / vendas : 0,
          taxaLO: leads > 0 ? (orcamentos / leads) * 100 : 0,
          taxaOV: orcamentos > 0 ? (vendas / orcamentos) * 100 : 0,
          taxaLV: leads > 0 ? (vendas / leads) * 100 : 0,
        };
      })
      .filter((f) => f.leads > 0 || f.orcamentos > 0 || f.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas || b.orcamentos - a.orcamentos || b.leads - a.leads);
  }, [consultores, leadsInvestPorConsultor, metricasVendas]);

  // Exportação
  const periodoLabel = `${format(periodoIni, 'dd/MM/yyyy')} a ${format(periodoFim, 'dd/MM/yyyy')}`;
  const consultoresPeriodo = useMemo(() => {
    return Array.from(leadsInvestPorConsultor.values())
      .sort((a, b) => b.invest - a.invest);
  }, [leadsInvestPorConsultor]);

  const exportarCSV = () => {
    const linhas: string[] = [];
    const esc = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    linhas.push(`Investimento em Anúncios — Período: ${periodoLabel}`);
    linhas.push('');
    linhas.push('KPIs Gerais');
    linhas.push(['Total Investido', 'Total de Leads', 'CPL Médio', 'CAC (Custo por Venda)', 'Total de Vendas'].join(','));
    linhas.push([formatBRL(totalInvestido), totalLeads, formatBRL(cplMedio), formatBRL(cac), totalVendas].map(esc).join(','));
    linhas.push('');
    linhas.push('Painel Geral por Consultor');
    linhas.push(['Consultor', 'Leads', 'Investimento', 'CPL'].join(','));
    consultoresPeriodo.forEach((c) => {
      linhas.push([c.nome, c.leads, formatBRL(c.invest), formatBRL(calcularCPL(c.invest, c.leads))].map(esc).join(','));
    });
    linhas.push(['TOTAL', totalLeads, formatBRL(totalInvestido), formatBRL(cplMedio)].map(esc).join(','));
    linhas.push('');
    linhas.push('Registros de Campanha');
    linhas.push(['Período', 'Campanha', 'Canal', 'Objetivo', 'Investido', 'Leads', 'CPL', 'Consultores'].join(','));
    registrosFiltrados.forEach((r) => {
      const leads = r.consultores.reduce((s, c) => s + c.leads_recebidos, 0);
      const detalhe = r.consultores
        .map((c) => `${c.consultor_nome_snapshot}: ${c.leads_recebidos}L / ${formatBRL(c.investimento_direcionado)}`)
        .join(' | ');
      linhas.push([
        `${r.data_inicio.split('-').reverse().join('/')} - ${r.data_fim.split('-').reverse().join('/')}`,
        r.nome_campanha || '—',
        labelCanal(r.canal),
        labelObjetivo(r.objetivo_campanha),
        formatBRL(r.investimento_total),
        leads,
        formatBRL(calcularCPL(r.investimento_total, leads)),
        detalhe,
      ].map(esc).join(','));
    });
    const blob = new Blob([`\uFEFF${linhas.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investimento-anuncios-${mesStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Investimento em Anúncios', 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${periodoLabel}`, 14, 25);
    doc.text(`Canal: ${canalFiltro === 'todos' ? 'Todos' : labelCanal(canalFiltro)}`, 14, 30);

    autoTable(doc, {
      startY: 36,
      head: [['KPIs', 'Valor']],
      body: [
        ['Total Investido', formatBRL(totalInvestido)],
        ['Total de Leads', String(totalLeads)],
        ['CPL Médio', formatBRL(cplMedio)],
        ['Total de Vendas', String(totalVendas)],
        ['CAC (Custo por Venda)', formatBRL(cac)],
      ],
    });

    autoTable(doc, {
      head: [['Consultor', 'Leads', 'Investimento', 'CPL']],
      body: [
        ...consultoresPeriodo.map((c) => [
          c.nome,
          String(c.leads),
          formatBRL(c.invest),
          formatBRL(calcularCPL(c.invest, c.leads)),
        ]),
        ['TOTAL GERAL', String(totalLeads), formatBRL(totalInvestido), formatBRL(cplMedio)],
      ],
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === consultoresPeriodo.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 230, 230];
        }
      },
    });

    autoTable(doc, {
      head: [['Período', 'Campanha', 'Canal', 'Invest.', 'Leads', 'CPL']],
      body: registrosFiltrados.map((r) => {
        const leads = r.consultores.reduce((s, c) => s + c.leads_recebidos, 0);
        return [
          `${r.data_inicio.split('-').reverse().join('/')}-${r.data_fim.split('-').reverse().join('/')}`,
          r.nome_campanha || '—',
          labelCanal(r.canal),
          formatBRL(r.investimento_total),
          String(leads),
          formatBRL(calcularCPL(r.investimento_total, leads)),
        ];
      }),
      styles: { fontSize: 8 },
    });

    doc.setFontSize(8);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.save(`investimento-anuncios-${mesStr}.pdf`);
  };

  const abrirNovo = () => {
    setEditando(null);
    setDialogOpen(true);
  };
  const abrirEditar = (r: AdInvestment) => {
    setEditando(r);
    setDialogOpen(true);
  };
  const onExcluir = (r: AdInvestment) => {
    if (confirm(`Excluir registro ${labelCanal(r.canal)} (${r.data_inicio} - ${r.data_fim})?`)) {
      excluir.mutate(r.id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Investimento em Anúncios</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="month"
            value={mesStr}
            onChange={(e) => setMesStr(e.target.value)}
            className="w-[180px]"
          />
          <Select value={canalFiltro} onValueChange={setCanalFiltro}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os canais</SelectItem>
              {CANAIS_VENDAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-1" /> Novo Registro</Button>
          <Button variant="outline" onClick={exportarCSV} disabled={registrosFiltrados.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" onClick={exportarPDF} disabled={registrosFiltrados.length === 0}>
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Investido" value={formatBRL(totalInvestido)} />
        <KpiCard label="Total de Leads" value={String(totalLeads)} />
        <KpiCard label="CPL Médio" value={formatBRL(cplMedio)} />
        <KpiCard label="CAC (Custo por Venda)" value={formatBRL(cac)} />
      </div>

      {/* Funil por consultor */}
      <Card>
        <CardHeader
          className="cursor-pointer flex-row items-center justify-between space-y-0"
          onClick={() => setFunilAberto((v) => !v)}
        >
          <CardTitle className="text-base flex items-center gap-2">
            {funilAberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Funil Completo por Consultor
          </CardTitle>
        </CardHeader>
        {funilAberto && (
          <CardContent>
            {funil.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem dados no período selecionado. Cadastre um registro de investimento para começar.
              </p>
            ) : (
              <div className="space-y-4">
                {funil.map((f) => {
                  const max = Math.max(f.leads, f.orcamentos, f.vendas, 1);
                  return (
                    <div key={f.nome} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{f.nome}</h3>
                        <div className="text-xs text-muted-foreground">
                          Invest.: {formatBRL(f.invest)}
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <FunilBar label="Leads" value={f.leads} max={max} color="bg-blue-500" />
                        <FunilBar label="Orçamentos" value={f.orcamentos} max={max} color="bg-amber-500" />
                        <FunilBar label="Vendas" value={f.vendas} max={max} color="bg-emerald-500" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <MiniStat label="Lead→Orç" value={`${f.taxaLO.toFixed(1)}%`} />
                        <MiniStat label="Orç→Venda" value={`${f.taxaOV.toFixed(1)}%`} />
                        <MiniStat label="Lead→Venda" value={`${f.taxaLV.toFixed(1)}%`} />
                        <MiniStat label="CPL" value={formatBRL(f.cpl)} />
                        <MiniStat label="Custo/Venda" value={formatBRL(f.custoVenda)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Tabela de registros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registros de Investimento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : registrosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro no período/canal selecionado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Investido</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>CPL</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrosFiltrados.map((r) => {
                  const leads = r.consultores.reduce((s, c) => s + c.leads_recebidos, 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {r.data_inicio.split('-').reverse().join('/')} - {r.data_fim.split('-').reverse().join('/')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.nome_campanha || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{labelCanal(r.canal)}</Badge></TableCell>
                      <TableCell className="text-sm">{labelObjetivo(r.objetivo_campanha)}</TableCell>
                      <TableCell>{formatBRL(r.investimento_total)}</TableCell>
                      <TableCell>{leads}</TableCell>
                      <TableCell>{formatBRL(calcularCPL(r.investimento_total, leads))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(r)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => onExcluir(r)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RegistroInvestimentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        registro={editando}
        registrosPeriodo={registrosFiltrados}
        periodoLabel={format(periodoIni, 'MM/yyyy')}
      />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded px-2 py-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function FunilBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-xs text-muted-foreground">{label}</div>
      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
        <div
          className={`h-full ${color} flex items-center justify-end px-2 text-[11px] text-white font-semibold transition-all`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
