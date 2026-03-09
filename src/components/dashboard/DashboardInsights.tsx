import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, AlertTriangle, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
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

export function DashboardInsights({ insights }: DashboardInsightsProps) {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroConsultor, setFiltroConsultor] = useState('todos');

  const consultoresUnicos = useMemo(() => {
    const set = new Set<string>();
    insights.forEach(i => {
      if (i.consultor) set.add(i.consultor);
    });
    return Array.from(set).sort();
  }, [insights]);

  const insightsFiltrados = useMemo(() => {
    return insights.filter(i => {
      if (filtroTipo !== 'todos' && i.tipo !== filtroTipo) return false;
      if (filtroConsultor !== 'todos' && i.consultor !== filtroConsultor) return false;
      return true;
    });
  }, [insights, filtroTipo, filtroConsultor]);

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
          <div className="flex items-center gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {consultoresUnicos.length > 0 && (
              <Select value={filtroConsultor} onValueChange={setFiltroConsultor}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os consultores</SelectItem>
                  {consultoresUnicos.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {insightsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum insight encontrado com os filtros selecionados.
          </p>
        ) : (
          <div className="space-y-3">
            {insightsFiltrados.map((insight, index) => (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
