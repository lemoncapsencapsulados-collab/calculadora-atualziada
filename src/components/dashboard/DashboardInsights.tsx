import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, AlertTriangle, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import type { InsightDashboard } from '@/types/dashboard';

interface DashboardInsightsProps {
  insights: InsightDashboard[];
}

export function DashboardInsights({ insights }: DashboardInsightsProps) {
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
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Insights e Alertas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getInsightBgColor(insight.tipo)}`}
            >
              <div className="mt-0.5">{getInsightIcon(insight.tipo)}</div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold mr-2">
                  {getInsightLabel(insight.tipo)}
                </span>
                <span className="text-sm">{insight.mensagem}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
