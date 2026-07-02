import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { calcularCPL, formatBRL } from '@/lib/anuncios';
import type {
  DashboardFiltros,
  MetricaConsultor,
  OrcamentosPorConsultorStatus,
} from '@/types/dashboard';

interface Props {
  filtros: DashboardFiltros;
  rankingConsultores: MetricaConsultor[];
  orcamentosPorConsultorStatus: OrcamentosPorConsultorStatus[];
}

interface LinhaFunil {
  consultor: string;
  leads: number;
  invest: number;
  orcamentos: number;
  vendas: number;
  cpl: number;
  custoOrc: number;
  custoVenda: number;
  taxaLO: number;
  taxaOV: number;
  taxaLV: number;
}

export function DashboardFunilAnuncios({ filtros, rankingConsultores, orcamentosPorConsultorStatus }: Props) {
  const di = filtros.dataInicio.toISOString().slice(0, 10);
  const df = filtros.dataFim.toISOString().slice(0, 10);

  // Período anterior: mesma duração deslocada para trás.
  const durMs = Math.max(1, filtros.dataFim.getTime() - filtros.dataInicio.getTime());
  const prevInicio = new Date(filtros.dataInicio.getTime() - durMs - 1);
  const prevFim = new Date(filtros.dataInicio.getTime() - 1);
  const pdi = prevInicio.toISOString().slice(0, 10);
  const pdf = prevFim.toISOString().slice(0, 10);

  const { data: anuncios } = useQuery({
    queryKey: ['dashboard-anuncios', di, df, filtros.consultor],
    queryFn: async () => {
      const { data: invs } = await supabase
        .from('ad_investments' as any)
        .select('id, data_inicio, data_fim')
        .lte('data_inicio', df)
        .gte('data_fim', di);
      const ids = ((invs as any[]) || []).map((i) => i.id);
      if (ids.length === 0) return [] as { nome: string; leads: number; invest: number }[];
      const { data: rows } = await supabase
        .from('ad_investment_consultores' as any)
        .select('leads_recebidos, investimento_direcionado, consultor_nome_snapshot')
        .in('ad_investment_id', ids);
      const map = new Map<string, { nome: string; leads: number; invest: number }>();
      for (const r of (rows as any[]) || []) {
        const nome = String(r.consultor_nome_snapshot || '').trim();
        if (!nome) continue;
        const key = nome.toLowerCase();
        const cur = map.get(key) || { nome, leads: 0, invest: 0 };
        cur.leads += Number(r.leads_recebidos) || 0;
        cur.invest += Number(r.investimento_direcionado) || 0;
        map.set(key, cur);
      }
      return Array.from(map.values());
    },
  });

  // Comparativo do período anterior — leads/invest + orçamentos + vendas
  const { data: anteriores } = useQuery({
    queryKey: ['dashboard-anuncios-prev', pdi, pdf, filtros.consultor],
    queryFn: async () => {
      const consultorAlvo = filtros.consultor?.trim().toLowerCase() || null;
      // 1) Anúncios período anterior
      const { data: invs } = await supabase
        .from('ad_investments' as any)
        .select('id, data_inicio, data_fim')
        .lte('data_inicio', pdf)
        .gte('data_fim', pdi);
      const ids = ((invs as any[]) || []).map((i) => i.id);
      let leads = 0;
      let invest = 0;
      if (ids.length > 0) {
        const { data: rows } = await supabase
          .from('ad_investment_consultores' as any)
          .select('leads_recebidos, investimento_direcionado, consultor_nome_snapshot')
          .in('ad_investment_id', ids);
        for (const r of (rows as any[]) || []) {
          const nome = String(r.consultor_nome_snapshot || '').trim().toLowerCase();
          if (consultorAlvo && nome !== consultorAlvo) continue;
          leads += Number(r.leads_recebidos) || 0;
          invest += Number(r.investimento_direcionado) || 0;
        }
      }
      // 2) Orçamentos + Vendas período anterior
      const [orcRes, pedRes] = await Promise.all([
        supabase.from('orcamentos').select('consultor_responsavel').gte('created_at', prevInicio.toISOString()).lte('created_at', prevFim.toISOString()),
        supabase.from('pedidos').select('orcamento_snapshot, data_pedido').gte('data_pedido', prevInicio.toISOString()).lte('data_pedido', prevFim.toISOString()),
      ]);
      let orcamentos = 0;
      (orcRes.data || []).forEach((o: any) => {
        const n = (o.consultor_responsavel || '').trim().toLowerCase();
        if (!n) return;
        if (consultorAlvo && n !== consultorAlvo) return;
        orcamentos += 1;
      });
      let vendas = 0;
      (pedRes.data || []).forEach((p: any) => {
        const n = (p.orcamento_snapshot?.consultor_responsavel || '').trim().toLowerCase();
        if (!n) return;
        if (consultorAlvo && n !== consultorAlvo) return;
        vendas += 1;
      });
      return {
        leads,
        invest,
        orcamentos,
        vendas,
        cpl: calcularCPL(invest, leads),
        custoOrc: orcamentos > 0 ? invest / orcamentos : 0,
        taxaOV: orcamentos > 0 ? (vendas / orcamentos) * 100 : 0,
      };
    },
  });

  const linhas: LinhaFunil[] = useMemo(() => {
    const dados = new Map<string, LinhaFunil>();
    const upsert = (nome: string): LinhaFunil => {
      const key = nome.trim().toLowerCase();
      let cur = dados.get(key);
      if (!cur) {
        cur = { consultor: nome, leads: 0, invest: 0, orcamentos: 0, vendas: 0, cpl: 0, custoOrc: 0, custoVenda: 0, taxaLO: 0, taxaOV: 0, taxaLV: 0 };
        dados.set(key, cur);
      }
      return cur;
    };

    (anuncios || []).forEach((a) => {
      const l = upsert(a.nome);
      l.leads += a.leads;
      l.invest += a.invest;
    });
    orcamentosPorConsultorStatus.forEach((o) => {
      if (o.consultor === 'Sem Consultor') return;
      const l = upsert(o.consultor);
      l.orcamentos += o.total;
    });
    rankingConsultores.forEach((r) => {
      if (r.consultor === 'Sem Consultor') return;
      const l = upsert(r.consultor);
      l.vendas += r.vendas;
    });

    let out = Array.from(dados.values());
    if (filtros.consultor) {
      const alvo = filtros.consultor.trim().toLowerCase();
      out = out.filter((l) => l.consultor.trim().toLowerCase() === alvo);
    }
    return out
      .map((l) => ({
        ...l,
        cpl: calcularCPL(l.invest, l.leads),
        custoOrc: l.orcamentos > 0 ? l.invest / l.orcamentos : 0,
        custoVenda: l.vendas > 0 ? l.invest / l.vendas : 0,
        taxaLO: l.leads > 0 ? (l.orcamentos / l.leads) * 100 : 0,
        taxaOV: l.orcamentos > 0 ? (l.vendas / l.orcamentos) * 100 : 0,
        taxaLV: l.leads > 0 ? (l.vendas / l.leads) * 100 : 0,
      }))
      .filter((l) => l.leads > 0 || l.orcamentos > 0 || l.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas || b.orcamentos - a.orcamentos || b.leads - a.leads);
  }, [anuncios, orcamentosPorConsultorStatus, rankingConsultores, filtros.consultor]);

  const geral = useMemo(() => {
    const g = linhas.reduce(
      (s, l) => {
        s.leads += l.leads;
        s.invest += l.invest;
        s.orcamentos += l.orcamentos;
        s.vendas += l.vendas;
        return s;
      },
      { leads: 0, invest: 0, orcamentos: 0, vendas: 0 }
    );
    return {
      ...g,
      cpl: calcularCPL(g.invest, g.leads),
      custoOrc: g.orcamentos > 0 ? g.invest / g.orcamentos : 0,
      custoVenda: g.vendas > 0 ? g.invest / g.vendas : 0,
      taxaLO: g.leads > 0 ? (g.orcamentos / g.leads) * 100 : 0,
      taxaOV: g.orcamentos > 0 ? (g.vendas / g.orcamentos) * 100 : 0,
      taxaLV: g.leads > 0 ? (g.vendas / g.leads) * 100 : 0,
    };
  }, [linhas]);

  const periodoAtualLabel = `${filtros.dataInicio.toLocaleDateString('pt-BR')} a ${filtros.dataFim.toLocaleDateString('pt-BR')}`;
  const periodoAnteriorLabel = `${prevInicio.toLocaleDateString('pt-BR')} a ${prevFim.toLocaleDateString('pt-BR')}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Funil de Anúncios — Captação até Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparativo período atual vs anterior */}
        <div className="border rounded-md p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-semibold text-sm">Comparativo — período anterior</h3>
            <div className="text-[11px] text-muted-foreground">
              Atual: {periodoAtualLabel} · Anterior: {periodoAnteriorLabel}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CompareStat
              label="CPL"
              atual={geral.cpl}
              anterior={anteriores?.cpl ?? 0}
              format={formatBRL}
              menorMelhor
            />
            <CompareStat
              label="Custo por Orçamento"
              atual={geral.custoOrc}
              anterior={anteriores?.custoOrc ?? 0}
              format={formatBRL}
              menorMelhor
            />
            <CompareStat
              label="Taxa de Conversão (Orç→Venda)"
              atual={geral.taxaOV}
              anterior={anteriores?.taxaOV ?? 0}
              format={(v) => `${v.toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Geral */}
        <div className="border rounded-md p-3 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Geral do Período</h3>
            <div className="text-xs text-muted-foreground">Invest.: {formatBRL(geral.invest)}</div>
          </div>
          <FunilBars leads={geral.leads} orcamentos={geral.orcamentos} vendas={geral.vendas} />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mt-2">
            <MiniStat label="Lead→Orç" value={`${geral.taxaLO.toFixed(1)}%`} />
            <MiniStat label="Orç→Venda" value={`${geral.taxaOV.toFixed(1)}%`} />
            <MiniStat label="Lead→Venda" value={`${geral.taxaLV.toFixed(1)}%`} />
            <MiniStat label="CPL" value={formatBRL(geral.cpl)} />
            <MiniStat label="Custo/Orç" value={formatBRL(geral.custoOrc)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mt-2">
            <MiniStat label="Custo/Venda (CAC)" value={formatBRL(geral.custoVenda)} />
            <MiniStat label="Total de Leads" value={String(geral.leads)} />
            <MiniStat label="Total de Vendas" value={String(geral.vendas)} />
          </div>
        </div>

        {/* Por consultor */}
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado de anúncio ou vendas no período/filtro atual. Cadastre em Investimento em Anúncios para ver o funil.
          </p>
        ) : (
          <div className="space-y-3">
            {linhas.map((f) => (
              <div key={f.consultor} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{f.consultor}</h3>
                  <div className="text-xs text-muted-foreground">Invest.: {formatBRL(f.invest)}</div>
                </div>
                <FunilBars leads={f.leads} orcamentos={f.orcamentos} vendas={f.vendas} />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mt-2">
                  <MiniStat label="Lead→Orç" value={`${f.taxaLO.toFixed(1)}%`} />
                  <MiniStat label="Orç→Venda" value={`${f.taxaOV.toFixed(1)}%`} />
                  <MiniStat label="Lead→Venda" value={`${f.taxaLV.toFixed(1)}%`} />
                  <MiniStat label="CPL" value={formatBRL(f.cpl)} />
                  <MiniStat label="Custo/Orç" value={formatBRL(f.custoOrc)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunilBars({ leads, orcamentos, vendas }: { leads: number; orcamentos: number; vendas: number }) {
  const max = Math.max(leads, orcamentos, vendas, 1);
  const bar = (label: string, value: number, color: string) => (
    <div className="flex items-center gap-2">
      <div className="w-24 text-xs text-muted-foreground">{label}</div>
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
  return (
    <div className="space-y-1.5">
      {bar('Leads', leads, 'bg-blue-500')}
      {bar('Orçamentos', orcamentos, 'bg-amber-500')}
      {bar('Vendas', vendas, 'bg-emerald-500')}
    </div>
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