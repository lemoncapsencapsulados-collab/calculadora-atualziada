import { useState, useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useDashboardComercial } from '@/hooks/useDashboardComercial';
import { useRecompras } from '@/hooks/useRecompras';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardFiltrosComponent } from '@/components/dashboard/DashboardFiltros';
import { DashboardVendas } from '@/components/dashboard/DashboardVendas';
import { DashboardPipeline } from '@/components/dashboard/DashboardPipeline';
import { DashboardRecorrencia } from '@/components/dashboard/DashboardRecorrencia';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';
import { DashboardGraficos } from '@/components/dashboard/DashboardGraficos';
import { NovaRecompraDialog } from '@/components/dashboard/NovaRecompraDialog';
import type { DashboardFiltros } from '@/types/dashboard';

export default function DashboardComercial() {
  const hoje = new Date();
  
  const [filtros, setFiltros] = useState<DashboardFiltros>({
    consultor: null,
    periodoTipo: 'semestral',
    dataInicio: startOfMonth(subMonths(hoje, 5)),
    dataFim: endOfMonth(hoje)
  });

  const [novaRecompraOpen, setNovaRecompraOpen] = useState(false);

  const {
    consultoresUnicos,
    kpis,
    rankingConsultores,
    pipelineConsultores,
    distribuicaoConsultorStatus,
    produtosMaisVendidos,
    mixVendas,
    insights,
    evolucaoTemporal,
    distribuicaoCanais,
    isLoading
  } = useDashboardComercial(filtros);

  const {
    recompras,
    adicionarRecompra,
    excluirRecompra,
    calcularMetricas,
    clientesUnicos: clientesRecompras,
    consultoresUnicos: consultoresRecompras
  } = useRecompras();

  const metricasRecorrencia = useMemo(() => {
    return calcularMetricas(kpis.faturamentoTotal);
  }, [calcularMetricas, kpis.faturamentoTotal]);

  // Combinar consultores de orçamentos e recompras
  const todosConsultores = useMemo(() => {
    const set = new Set([...consultoresUnicos, ...consultoresRecompras]);
    return Array.from(set).sort();
  }, [consultoresUnicos, consultoresRecompras]);

  // Combinar clientes de orçamentos e recompras para autocomplete
  const todosClientes = useMemo(() => {
    const clientesOrcamentos = rankingConsultores.flatMap(c => 
      Array(c.clientesUnicos).fill(null).map((_, i) => `Cliente ${i + 1}`)
    );
    const set = new Set([...clientesRecompras, ...clientesOrcamentos]);
    return Array.from(set).sort();
  }, [rankingConsultores, clientesRecompras]);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
            <LayoutDashboard className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Comercial</h1>
            <p className="text-sm text-muted-foreground">Visão 360° das vendas e pipeline</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <DashboardFiltrosComponent
        filtros={filtros}
        onFiltrosChange={setFiltros}
        consultoresDisponiveis={todosConsultores}
      />

      {/* KPIs */}
      <DashboardKPIs kpis={kpis} isLoading={isLoading} />

      {/* Vendas e Ranking */}
      <DashboardVendas
        rankingConsultores={rankingConsultores}
        produtosMaisVendidos={produtosMaisVendidos}
        mixVendas={mixVendas}
      />

      {/* Pipeline */}
      <DashboardPipeline distribuicaoConsultorStatus={distribuicaoConsultorStatus} />

      {/* Gráficos */}
      <DashboardGraficos
        evolucaoTemporal={evolucaoTemporal}
        distribuicaoCanais={distribuicaoCanais}
      />

      {/* Recorrência */}
      <DashboardRecorrencia
        recompras={recompras}
        metricas={metricasRecorrencia}
        onNovaRecompra={() => setNovaRecompraOpen(true)}
        onExcluirRecompra={(id) => excluirRecompra.mutate(id)}
      />

      {/* Insights */}
      <DashboardInsights insights={insights} />

      {/* Dialog Nova Recompra */}
      <NovaRecompraDialog
        open={novaRecompraOpen}
        onOpenChange={setNovaRecompraOpen}
        onSalvar={(dados) => adicionarRecompra.mutate(dados)}
        consultoresDisponiveis={todosConsultores}
        clientesDisponiveis={todosClientes}
      />
    </div>
  );
}
