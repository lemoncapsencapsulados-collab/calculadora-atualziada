import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, AlertTriangle, AlertCircle, CheckCircle, TrendingUp, ExternalLink, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import type { InsightDashboard } from '@/types/dashboard';

interface DashboardInsightsProps {
  insights: InsightDashboard[];
}

const TIPO_OPTIONS = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'alerta', label: '🔴 Alerta' },
  { value: 'atencao', label: '🟡 Atenção' },
  { value: 'positivo', label: '🟢 Positivo' },
  { value: 'oportunidade', label: '📊 Oportunidade' },
];

const ITEMS_PER_PAGE = 15;

export function DashboardInsights({ insights }: DashboardInsightsProps) {
  const navigate = useNavigate();
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [paginaAtual, setPaginaAtual] = useState(1);

  const insightsFiltrados = useMemo(() => {
    return insights.filter(i => {
      if (filtroTipo !== 'todos' && i.tipo !== filtroTipo) return false;
      return true;
    });
  }, [insights, filtroTipo]);

  const totalPaginas = Math.ceil(insightsFiltrados.length / ITEMS_PER_PAGE);

  const insightsPaginados = useMemo(() => {
    const start = (paginaAtual - 1) * ITEMS_PER_PAGE;
    return insightsFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [insightsFiltrados, paginaAtual]);

  const handleFiltroTipoChange = (value: string) => {
    setFiltroTipo(value);
    setPaginaAtual(1);
  };

  const getInsightIcon = (tipo: InsightDashboard['tipo']) => {
    switch (tipo) {
      case 'alerta':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'atencao':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'positivo':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'oportunidade':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightBgColor = (tipo: InsightDashboard['tipo']) => {
    switch (tipo) {
      case 'alerta':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'atencao':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'positivo':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'oportunidade':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getInsightLabel = (tipo: InsightDashboard['tipo']) => {
    switch (tipo) {
      case 'alerta':
        return '🔴 ALERTA';
      case 'atencao':
        return '🟡 ATENÇÃO';
      case 'positivo':
        return '🟢 POSITIVO';
      case 'oportunidade':
        return '📊 OPORTUNIDADE';
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 5;

    if (totalPaginas <= maxVisible) {
      for (let i = 1; i <= totalPaginas; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={paginaAtual === i}
              onClick={() => setPaginaAtual(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink isActive={paginaAtual === 1} onClick={() => setPaginaAtual(1)} className="cursor-pointer">1</PaginationLink>
        </PaginationItem>
      );
      if (paginaAtual > 3) {
        items.push(<PaginationItem key="start-ellipsis"><PaginationEllipsis /></PaginationItem>);
      }
      const start = Math.max(2, paginaAtual - 1);
      const end = Math.min(totalPaginas - 1, paginaAtual + 1);
      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink isActive={paginaAtual === i} onClick={() => setPaginaAtual(i)} className="cursor-pointer">{i}</PaginationLink>
          </PaginationItem>
        );
      }
      if (paginaAtual < totalPaginas - 2) {
        items.push(<PaginationItem key="end-ellipsis"><PaginationEllipsis /></PaginationItem>);
      }
      items.push(
        <PaginationItem key={totalPaginas}>
          <PaginationLink isActive={paginaAtual === totalPaginas} onClick={() => setPaginaAtual(totalPaginas)} className="cursor-pointer">{totalPaginas}</PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Insights e Alertas
            {insightsFiltrados.length !== insights.length && (
              <span className="text-sm font-normal text-muted-foreground">
                ({insightsFiltrados.length} de {insights.length})
              </span>
            )}
          </CardTitle>
          <Select value={filtroTipo} onValueChange={handleFiltroTipoChange}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {insightsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum insight encontrado com os filtros selecionados.
          </p>
        ) : (
          <div className="space-y-3">
            {insightsPaginados.map((insight, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border ${getInsightBgColor(insight.tipo)}`}
              >
                <div className="mt-0.5">{getInsightIcon(insight.tipo)}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold mr-2">
                    {getInsightLabel(insight.tipo)}
                  </span>
                  {insight.consultor && (
                    <span className="text-xs text-muted-foreground mr-2">
                      [{insight.consultor}]
                    </span>
                  )}
                  <span className="text-sm">{insight.mensagem}</span>
                  {insight.observacao && (
                    <div className="mt-2 flex items-start gap-2 text-xs italic text-muted-foreground bg-background/60 rounded p-2 border border-border/50">
                      <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="whitespace-pre-wrap break-words">{insight.observacao}</span>
                    </div>
                  )}
                  {insight.orcamento_id && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/orcamentos?focus=${insight.orcamento_id}`)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Ver Orçamento{insight.numero_orcamento ? ` ${insight.numero_orcamento}` : ''}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {totalPaginas > 1 && (
              <div className="pt-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                        className={`cursor-pointer ${paginaAtual === 1 ? 'pointer-events-none opacity-50' : ''}`}
                      />
                    </PaginationItem>
                    {renderPaginationItems()}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                        className={`cursor-pointer ${paginaAtual === totalPaginas ? 'pointer-events-none opacity-50' : ''}`}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Página {paginaAtual} de {totalPaginas} ({insightsFiltrados.length} insights)
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
