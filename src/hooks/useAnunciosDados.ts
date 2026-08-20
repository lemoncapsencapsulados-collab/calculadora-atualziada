import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdInvestments, AdInvestment } from '@/hooks/useAdInvestments';
import { calcularCPL, diasEntre, MODELOS_AQUISICAO, MODELOS_AQUISICAO_ANUNCIO } from '@/lib/anuncios';
import { detectarVendedorNaCampanha, chaveConsultor } from '@/lib/vendedoresCampanha';

export interface FiltrosAnuncios {
  inicio: Date;
  fim: Date;
  canal: string; // 'todos' | id do canal | 'meta_api'
  consultor: string; // 'todos' | nome
  campanha?: string; // 'todos' | nome exato da campanha (produto)
}

export interface LinhaConsultorAnuncio {
  nome: string;
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

export interface PontoTimeline {
  data: string; // yyyy-MM-dd
  label: string;
  invest: number;
  leads: number;
  orcamentos: number;
  vendas: number;
}

export interface RegistroTabela {
  id: string;
  origem: 'manual' | 'meta';
  dataLabel: string;
  canal: string;
  campanha: string;
  invest: number;
  leads: number;
  cpl: number;
  registro?: AdInvestment;
}

export interface KpisAnuncios {
  invest: number;
  leads: number;
  orcamentos: number;
  vendas: number;
  cpl: number;
  cac: number;
  custoOrc: number;
  taxaLO: number;
  taxaOV: number;
  taxaLV: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Vendedor da linha Meta: valor salvo ou reconhecido pelo nome da campanha. */
const vendedorDaLinha = (m: any): string =>
  (m.consultor_nome || detectarVendedorNaCampanha(m.campaign_name || '') || '').trim();

export interface LinhaModeloAquisicao {
  modelo: string;
  label: string;
  orcamentos: number;
  vendas: number;
  valorVendido: number;
  taxaConversao: number;
}

function kpisDe(base: { invest: number; leads: number; orcamentos: number; vendas: number }): KpisAnuncios {
  const { invest, leads, orcamentos, vendas } = base;
  return {
    invest,
    leads,
    orcamentos,
    vendas,
    cpl: calcularCPL(invest, leads),
    cac: vendas > 0 ? invest / vendas : 0,
    custoOrc: orcamentos > 0 ? invest / orcamentos : 0,
    taxaLO: leads > 0 ? (orcamentos / leads) * 100 : 0,
    taxaOV: orcamentos > 0 ? (vendas / orcamentos) * 100 : 0,
    taxaLV: leads > 0 ? (vendas / leads) * 100 : 0,
  };
}

function intersecta(ini: string, fim: string, di: Date, df: Date): boolean {
  const a = new Date(ini + 'T00:00:00');
  const b = new Date(fim + 'T23:59:59');
  return a <= df && b >= di;
}

export function useAnunciosDados(filtros: FiltrosAnuncios) {
  const { data: registros = [], isLoading: loadingRegistros, excluir } = useAdInvestments();

  const alvo = filtros.consultor === 'todos' ? null : chaveConsultor(filtros.consultor);
  const di = filtros.inicio;
  const df = filtros.fim;
  const durMs = Math.max(1, df.getTime() - di.getTime());
  const prevIni = new Date(di.getTime() - durMs - 1);
  const prevFim = new Date(di.getTime() - 1);

  // Meta insights (integração)
  const { data: metaRows = [], isLoading: loadingMeta } = useQuery({
    queryKey: ['meta-insights', iso(di), iso(df)],
    queryFn: async () => {
      const { data } = await supabase
        .from('meta_insights' as any)
        .select('data, campaign_id, campaign_name, spend, leads, consultor_nome, ad_account_id')
        .gte('data', iso(prevIni))
        .lte('data', iso(df));
      return (data as any[]) || [];
    },
  });

  const { data: contasMeta = [], isLoading: loadingContas } = useQuery({
    queryKey: ['meta-ad-accounts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('meta_ad_accounts' as any)
        .select('id, ad_account_id, nome, ativo, last_sync_at, last_sync_status, last_sync_error')
        .order('nome', { ascending: true });
      return (data as any[]) || [];
    },
  });

  // Só considera insights das contas marcadas como ativas
  const contasAtivasIds = useMemo(
    () => (contasMeta as any[]).filter((c) => c.ativo).map((c) => c.ad_account_id),
    [contasMeta]
  );
  const metaRowsContas = useMemo(() => {
    if (!contasAtivasIds.length) return [] as any[];
    const set = new Set(contasAtivasIds);
    return (metaRows as any[]).filter((m) => set.has(m.ad_account_id));
  }, [metaRows, contasAtivasIds]);

  // Lista de campanhas (produtos) disponíveis para filtro
  const campanhasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    metaRowsContas.forEach((m: any) => {
      if (m.campaign_name) set.add(m.campaign_name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [metaRowsContas]);

  const campanhaAlvo = !filtros.campanha || filtros.campanha === 'todos' ? null : filtros.campanha;
  const metaRowsAtivas = useMemo(
    () => (campanhaAlvo ? metaRowsContas.filter((m: any) => m.campaign_name === campanhaAlvo) : metaRowsContas),
    [metaRowsContas, campanhaAlvo]
  );


  // Orçamentos e pedidos (atual + anterior, para deltas e timeline)
  const { data: comercial, isLoading: loadingComercial } = useQuery({
    queryKey: ['anuncios-comercial', prevIni.toISOString(), df.toISOString()],
    queryFn: async () => {
      const [orcRes, pedRes] = await Promise.all([
        supabase
          .from('orcamentos')
          .select('id, consultor_responsavel, created_at, valor_total, modelo_aquisicao')
          .gte('created_at', prevIni.toISOString())
          .lte('created_at', df.toISOString()),
        supabase
          .from('pedidos')
          .select('orcamento_id, orcamento_snapshot, data_pedido')
          .gte('data_pedido', prevIni.toISOString())
          .lte('data_pedido', df.toISOString()),
      ]);
      const orcamentos = (orcRes.data || []).map((o: any) => ({
        id: o.id as string,
        nome: (o.consultor_responsavel || '').trim(),
        data: String(o.created_at).slice(0, 10),
        valor: Number(o.valor_total) || 0,
        modelo: (o.modelo_aquisicao as string | null) || null,
      }));
      const porId = new Map(orcamentos.map((o) => [o.id, o]));
      const vendas = (pedRes.data || []).map((p: any) => ({
        nome: (p.orcamento_snapshot?.consultor_responsavel || '').trim(),
        data: String(p.data_pedido).slice(0, 10),
        valor: Number(p.orcamento_snapshot?.valor_total) || 0,
        modelo:
          (porId.get(p.orcamento_id)?.modelo as string | null) ||
          (p.orcamento_snapshot?.modelo_aquisicao as string | null) ||
          null,
      }));
      return { orcamentos, vendas };
    },
  });

  const dados = useMemo(() => {
    const canalFiltro = filtros.canal;
    const usaManual = canalFiltro === 'todos' || canalFiltro !== 'meta_api';
    const usaMeta = canalFiltro === 'todos' || canalFiltro === 'meta_api';

    // ---- Registros manuais no período
    const registrosPeriodo = registros.filter((r) => {
      if (!usaManual) return false;
      if (canalFiltro !== 'todos' && canalFiltro !== 'meta_api' && r.canal !== canalFiltro) return false;
      if (!intersecta(r.data_inicio, r.data_fim, di, df)) return false;
      if (alvo && !r.consultores.some((c) => chaveConsultor(c.consultor_nome_snapshot) === alvo)) return false;
      return true;
    });

    // ---- Agregação leads/investimento por consultor
    const porConsultor = new Map<string, { nome: string; leads: number; invest: number }>();
    const add = (nome: string, leads: number, invest: number) => {
      const n = (nome || '').trim();
      if (!n) return;
      const key = chaveConsultor(n);
      if (alvo && key !== alvo) return;

      const cur = porConsultor.get(key) || { nome: n, leads: 0, invest: 0 };
      cur.leads += leads;
      cur.invest += invest;
      porConsultor.set(key, cur);
    };

    registrosPeriodo.forEach((r) => {
      r.consultores.forEach((c) => add(c.consultor_nome_snapshot, c.leads_recebidos, c.investimento_direcionado));
    });

    const metaNoPeriodo = (metaRowsAtivas as any[]).filter(
      (m) => usaMeta && m.data >= iso(di) && m.data <= iso(df)
    );
    metaNoPeriodo.forEach((m) => {
      const v = vendedorDaLinha(m);
      if (v) add(v, Number(m.leads) || 0, Number(m.spend) || 0);
    });

    const investManual = alvo
      ? registrosPeriodo.reduce(
          (s, r) =>
            s +
            r.consultores
              .filter((c) => chaveConsultor(c.consultor_nome_snapshot) === alvo)
              .reduce((x, c) => x + c.investimento_direcionado, 0),
          0
        )
      : registrosPeriodo.reduce((s, r) => s + r.investimento_total, 0);
    const leadsManual = registrosPeriodo.reduce(
      (s, r) =>
        s +
        r.consultores
          .filter((c) => !alvo || chaveConsultor(c.consultor_nome_snapshot) === alvo)
          .reduce((x, c) => x + c.leads_recebidos, 0),
      0
    );
    const investMeta = metaNoPeriodo
      .filter((m) => !alvo || chaveConsultor(vendedorDaLinha(m)) === alvo)
      .reduce((s, m) => s + (Number(m.spend) || 0), 0);
    const leadsMeta = metaNoPeriodo
      .filter((m) => !alvo || chaveConsultor(vendedorDaLinha(m)) === alvo)
      .reduce((s, m) => s + (Number(m.leads) || 0), 0);

    const investTotal = investManual + investMeta;
    const leadsTotal = leadsManual + leadsMeta;

    // ---- Comercial
    const dentro = (d: string, a: Date, b: Date) => d >= iso(a) && d <= iso(b);
    const orcAtual = (comercial?.orcamentos || []).filter(
      (o) => o.nome && dentro(o.data, di, df) && (!alvo || chaveConsultor(o.nome) === alvo)
    );
    const venAtual = (comercial?.vendas || []).filter(
      (v) => v.nome && dentro(v.data, di, df) && (!alvo || chaveConsultor(v.nome) === alvo)
    );

    const orcPorNome = new Map<string, number>();
    orcAtual.forEach((o) => orcPorNome.set(chaveConsultor(o.nome), (orcPorNome.get(chaveConsultor(o.nome)) || 0) + 1));
    const venPorNome = new Map<string, number>();
    venAtual.forEach((v) => venPorNome.set(chaveConsultor(v.nome), (venPorNome.get(chaveConsultor(v.nome)) || 0) + 1));

    const nomes = new Set<string>([...porConsultor.keys(), ...orcPorNome.keys(), ...venPorNome.keys()]);
    const consultores: LinhaConsultorAnuncio[] = Array.from(nomes)
      .map((key) => {
        const base = porConsultor.get(key);
        const nome =
          base?.nome ||
          orcAtual.find((o) => chaveConsultor(o.nome) === key)?.nome ||
          venAtual.find((v) => chaveConsultor(v.nome) === key)?.nome ||
          key;
        const leads = base?.leads || 0;
        const invest = base?.invest || 0;
        const orcamentos = orcPorNome.get(key) || 0;
        const vendas = venPorNome.get(key) || 0;
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
      .filter((c) => c.leads > 0 || c.orcamentos > 0 || c.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas || b.orcamentos - a.orcamentos || b.leads - a.leads);

    const kpis = kpisDe({
      invest: investTotal,
      leads: leadsTotal,
      orcamentos: orcAtual.length,
      vendas: venAtual.length,
    });

    // ---- Período anterior
    const registrosPrev = registros.filter((r) => {
      if (!usaManual) return false;
      if (canalFiltro !== 'todos' && canalFiltro !== 'meta_api' && r.canal !== canalFiltro) return false;
      if (!intersecta(r.data_inicio, r.data_fim, prevIni, prevFim)) return false;
      return true;
    });
    const linhasPrev = registrosPrev.flatMap((r) =>
      r.consultores.filter((c) => !alvo || chaveConsultor(c.consultor_nome_snapshot) === alvo)
    );
    const metaPrev = (metaRowsAtivas as any[]).filter(
      (m) =>
        usaMeta &&
        m.data >= iso(prevIni) &&
        m.data <= iso(prevFim) &&
        (!alvo || chaveConsultor(vendedorDaLinha(m)) === alvo)
    );
    const anterior = kpisDe({
      invest:
        (alvo
          ? linhasPrev.reduce((s, c) => s + c.investimento_direcionado, 0)
          : registrosPrev.reduce((s, r) => s + r.investimento_total, 0)) +
        metaPrev.reduce((s, m) => s + (Number(m.spend) || 0), 0),
      leads:
        linhasPrev.reduce((s, c) => s + c.leads_recebidos, 0) +
        metaPrev.reduce((s, m) => s + (Number(m.leads) || 0), 0),
      orcamentos: (comercial?.orcamentos || []).filter(
        (o) => o.nome && dentro(o.data, prevIni, prevFim) && (!alvo || chaveConsultor(o.nome) === alvo)
      ).length,
      vendas: (comercial?.vendas || []).filter(
        (v) => v.nome && dentro(v.data, prevIni, prevFim) && (!alvo || chaveConsultor(v.nome) === alvo)
      ).length,
    });

    // ---- Timeline diária
    const dias: string[] = [];
    for (let d = new Date(di); d <= df; d.setDate(d.getDate() + 1)) dias.push(iso(new Date(d)));
    const mapa = new Map<string, PontoTimeline>();
    dias.forEach((d) =>
      mapa.set(d, {
        data: d,
        label: d.slice(8, 10) + '/' + d.slice(5, 7),
        invest: 0,
        leads: 0,
        orcamentos: 0,
        vendas: 0,
      })
    );
    registrosPeriodo.forEach((r) => {
      const total = diasEntre(r.data_inicio, r.data_fim);
      const linhas = r.consultores.filter((c) => !alvo || chaveConsultor(c.consultor_nome_snapshot) === alvo);
      const invest = alvo ? linhas.reduce((s, c) => s + c.investimento_direcionado, 0) : r.investimento_total;
      const leads = linhas.reduce((s, c) => s + c.leads_recebidos, 0);
      dias.forEach((d) => {
        if (d >= r.data_inicio && d <= r.data_fim) {
          const p = mapa.get(d)!;
          p.invest += invest / total;
          p.leads += leads / total;
        }
      });
    });
    metaNoPeriodo
      .filter((m) => !alvo || chaveConsultor(vendedorDaLinha(m)) === alvo)
      .forEach((m) => {
        const p = mapa.get(m.data);
        if (p) {
          p.invest += Number(m.spend) || 0;
          p.leads += Number(m.leads) || 0;
        }
      });
    orcAtual.forEach((o) => {
      const p = mapa.get(o.data);
      if (p) p.orcamentos += 1;
    });
    venAtual.forEach((v) => {
      const p = mapa.get(v.data);
      if (p) p.vendas += 1;
    });
    const timeline = Array.from(mapa.values()).map((p) => ({
      ...p,
      invest: Math.round(p.invest * 100) / 100,
      leads: Math.round(p.leads),
    }));

    // ---- Tabela de registros
    const tabela: RegistroTabela[] = [
      ...registrosPeriodo.map((r) => {
        const linhas = r.consultores.filter((c) => !alvo || chaveConsultor(c.consultor_nome_snapshot) === alvo);
        const invest = alvo ? linhas.reduce((s, c) => s + c.investimento_direcionado, 0) : r.investimento_total;
        const leads = linhas.reduce((s, c) => s + c.leads_recebidos, 0);
        return {
          id: r.id,
          origem: 'manual' as const,
          dataLabel: `${r.data_inicio.split('-').reverse().join('/')} — ${r.data_fim.split('-').reverse().join('/')}`,
          canal: r.canal,
          campanha: r.nome_campanha || '—',
          invest,
          leads,
          cpl: calcularCPL(invest, leads),
          registro: r,
        };
      }),
      ...(() => {
        const agrup = new Map<string, RegistroTabela>();
        metaNoPeriodo
          .filter((m) => !alvo || chaveConsultor(vendedorDaLinha(m)) === alvo)
          .forEach((m) => {
            const key = String(m.campaign_id);
            const cur =
              agrup.get(key) ||
              ({
                id: `meta-${key}`,
                origem: 'meta' as const,
                dataLabel: `${di.toLocaleDateString('pt-BR')} — ${df.toLocaleDateString('pt-BR')}`,
                canal: 'meta_api',
                campanha: m.campaign_name || key,
                invest: 0,
                leads: 0,
                cpl: 0,
              } as RegistroTabela);
            cur.invest += Number(m.spend) || 0;
            cur.leads += Number(m.leads) || 0;
            cur.cpl = calcularCPL(cur.invest, cur.leads);
            agrup.set(key, cur);
          });
        return Array.from(agrup.values());
      })(),
    ].sort((a, b) => b.invest - a.invest);

    // ---- Funil por modelo de aquisição
    const modelosDef = [...MODELOS_AQUISICAO.map((m) => ({ id: m.id as string, label: m.label as string })), { id: 'nao_informado', label: 'Não informado' }];
    const porModeloAquisicao: LinhaModeloAquisicao[] = modelosDef.map((m) => {
      const orcs = orcAtual.filter((o: any) => (o.modelo || 'nao_informado') === m.id);
      const vens = venAtual.filter((v: any) => (v.modelo || 'nao_informado') === m.id);
      const valorVendido = vens.reduce((s2: number, v: any) => s2 + (Number(v.valor) || 0), 0);
      return {
        modelo: m.id,
        label: m.label,
        orcamentos: orcs.length,
        vendas: vens.length,
        valorVendido,
        taxaConversao: orcs.length > 0 ? (vens.length / orcs.length) * 100 : 0,
      };
    });

    // ---- Campanhas gerais (sem nome de vendedor)
    const metaGeral = metaNoPeriodo.filter((m: any) => !vendedorDaLinha(m));
    const investGeral = metaGeral.reduce((s2: number, m: any) => s2 + (Number(m.spend) || 0), 0);
    const leadsGeral = metaGeral.reduce((s2: number, m: any) => s2 + (Number(m.leads) || 0), 0);
    const orcGeral = orcAtual.filter((o: any) => MODELOS_AQUISICAO_ANUNCIO.includes(o.modelo || ''));
    const venGeral = venAtual.filter((v: any) => MODELOS_AQUISICAO_ANUNCIO.includes(v.modelo || ''));
    const valorGeral = venGeral.reduce((s2: number, v: any) => s2 + (Number(v.valor) || 0), 0);
    const geral = {
      invest: investGeral,
      leads: leadsGeral,
      orcamentos: orcGeral.length,
      vendas: venGeral.length,
      valorVendido: valorGeral,
      cpl: calcularCPL(investGeral, leadsGeral),
      custoVenda: venGeral.length > 0 ? investGeral / venGeral.length : 0,
      taxaOV: orcGeral.length > 0 ? (venGeral.length / orcGeral.length) * 100 : 0,
      campanhas: Array.from(new Set(metaGeral.map((m: any) => m.campaign_name).filter(Boolean))) as string[],
    };

    return { kpis, anterior, consultores, timeline, tabela, registrosPeriodo, porModeloAquisicao, geral };
  }, [registros, metaRowsAtivas, comercial, filtros.canal, alvo, di, df, prevIni, prevFim]);

  return {
    ...dados,
    contasMeta,
    campanhasDisponiveis,
    excluir,
    isLoading: loadingRegistros || loadingComercial || loadingMeta || loadingContas,
    periodo: { inicio: di, fim: df, anteriorInicio: prevIni, anteriorFim: prevFim },
  };
}
