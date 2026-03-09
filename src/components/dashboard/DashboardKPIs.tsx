import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ShoppingCart, Clock, DollarSign, Target, FileX, FileText } from 'lucide-react';
import type { KPIsGerais } from '@/types/dashboard';

interface DashboardKPIsProps {
  kpis: KPIsGerais;
  isLoading?: boolean;
}

export function DashboardKPIs({ kpis, isLoading }: DashboardKPIsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const cards = [
    {
      title: 'Faturamento Total',
      value: formatCurrency(kpis.faturamentoTotal),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    {
      title: 'Vendas Fechadas',
      value: kpis.novasVendas.toString(),
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      title: 'Em Orçamento',
      value: formatCurrency(kpis.pipelineNegociacao),
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    },
    {
      title: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    {
      title: 'Taxa Conversão',
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      icon: Target,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30'
    },
    {
      title: 'Recusados',
      value: kpis.totalRecusados.toString(),
      icon: FileX,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {card.title}
                  </p>
                  <p className="text-xl font-bold mt-1 text-foreground">
                    {card.value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
