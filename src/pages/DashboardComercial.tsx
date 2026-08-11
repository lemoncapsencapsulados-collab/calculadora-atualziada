import { useState } from 'react';
import { LayoutDashboard, UserSearch } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useDashboardComercial } from '@/hooks/useDashboardComercial';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardFiltrosComponent } from '@/components/dashboard/DashboardFiltros';
import { DashboardVendas } from '@/components/dashboard/DashboardVendas';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';
import { DashboardOrcamentos, DashboardOrcamentosDistribuicao } from '@/components/dashboard/DashboardOrcamentos';
import { DashboardAlteracoesPagamento } from '@/components/dashboard/DashboardAlteracoesPagamento';
import { AnaliseVendedorDialog } from '@/components/dashboard/AnaliseVendedorDialog';
import { DashboardComissoesExternas } from '@/components/dashboard/DashboardComissoesExternas';
import { DashboardFunilAnuncios } from '@/components/dashboard/DashboardFunilAnuncios';
import { Button } from '@/components/ui/button';
import type { DashboardFiltros } from '@/types/dashboard';

export default function DashboardComercial() {
  const hoje = new Date();
  
  const [filtros, setFiltros] = useState<DashboardFiltros>({
    consultor: null,
    periodoTipo: 'mensal',
    dataInicio: startOfMonth(hoje),
    dataFim: endOfMonth(hoje)
  });
  const [analiseOpen, setAnaliseOpen] = useState(false);

  const {
    consultoresUnicos,
    kpis,
    rankingConsultores,
    pipelineConsultores,
    produtosMaisVendidos,
    mixVendas,
    insights,
    vendasPorTipo,
    clientesPorModelo,
    orcamentosPorConsultorStatus,
    alteracoesPagamento,
    isLoading
  } = useDashboardComercial(filtros);

  const todosConsultores = consultoresUnicos;

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
        <Button onClick={() => setAnaliseOpen(true)} className="gap-2">
          <UserSearch className="w-4 h-4" />
          Análise Apurada do Vendedor
        </Button>
      </div>

      <AnaliseVendedorDialog open={analiseOpen} onOpenChange={setAnaliseOpen} />

      {/* Filtros */}
      <DashboardFiltrosComponent
        filtros={filtros}
        onFiltrosChange={setFiltros}
        consultoresDisponiveis={todosConsultores}
      />

      {/* KPIs */}
      <DashboardKPIs kpis={kpis} isLoading={isLoading} />

      {/* Comissões Externas (Monetizze + Braip) */}
      <DashboardComissoesExternas filtros={filtros} />

      {/* Funil de Anúncios (Leads → Orçamentos → Vendas) */}
      <DashboardFunilAnuncios
        filtros={filtros}
        rankingConsultores={rankingConsultores}
        orcamentosPorConsultorStatus={orcamentosPorConsultorStatus}
      />

      {/* Vendas e Ranking */}
      <DashboardVendas
        rankingConsultores={rankingConsultores}
        produtosMaisVendidos={produtosMaisVendidos}
        mixVendas={mixVendas}
        consultoresUnicos={todosConsultores}
        vendasPorTipo={vendasPorTipo}
        clientesPorModelo={clientesPorModelo}
      />

      {/* Alterações de Pagamento */}
      <DashboardAlteracoesPagamento dados={alteracoesPagamento} />

      {/* Orçamentos por Vendedor */}
      <DashboardOrcamentos dados={orcamentosPorConsultorStatus} />

      {/* Distribuição de Orçamentos */}
      <DashboardOrcamentosDistribuicao dados={orcamentosPorConsultorStatus} />

      {/* Insights */}
      <DashboardInsights insights={insights} />
    </div>
  );
}
