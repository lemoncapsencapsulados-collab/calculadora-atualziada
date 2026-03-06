import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DistribuicaoConsultorStatus } from '@/types/dashboard';

interface DashboardPipelineProps {
  distribuicaoConsultorStatus: DistribuicaoConsultorStatus[];
}

const STATUS_CONFIG = [
  { key: 'rascunho', label: 'Rascunho', color: '#94a3b8' },
  { key: 'enviado', label: 'Enviado', color: '#f59e0b' },
  { key: 'pago', label: 'Pago', color: '#22c55e' },
  { key: 'recusado', label: 'Recusado', color: '#ef4444' },
] as const;

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: DistribuicaoConsultorStatus;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((acc, p) => acc + p.value, 0);

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: p.color }} />
            <span>{p.name}</span>
          </div>
          <span className="font-medium">
            {p.value} ({total > 0 ? ((p.value / total) * 100).toFixed(0) : 0}%)
          </span>
        </div>
      ))}
      <div className="border-t border-border mt-2 pt-2 flex justify-between font-semibold">
        <span>Total</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

export function DashboardPipeline({ distribuicaoConsultorStatus }: DashboardPipelineProps) {
  const totais = distribuicaoConsultorStatus.reduce(
    (acc, c) => ({
      rascunho: acc.rascunho + c.rascunho,
      enviado: acc.enviado + c.enviado,
      pago: acc.pago + c.pago,
      recusado: acc.recusado + c.recusado,
    }),
    { rascunho: 0, enviado: 0, pago: 0, recusado: 0 }
  );
  const totalGeral = totais.rascunho + totais.enviado + totais.pago + totais.recusado;

  const chartHeight = Math.max(200, distribuicaoConsultorStatus.length * 50 + 40);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
          <BarChart3 className="h-5 w-5 text-primary" />
          Distribuição de Orçamentos por Consultor
          <div className="flex gap-2 ml-auto flex-wrap">
            {STATUS_CONFIG.map(s => (
              <Badge key={s.key} variant="outline" className="text-xs" style={{ borderColor: s.color, color: s.color }}>
                {s.label}: {totais[s.key as keyof typeof totais]}
              </Badge>
            ))}
            <Badge variant="secondary" className="text-xs">
              Total: {totalGeral}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {distribuicaoConsultorStatus.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum orçamento encontrado no período selecionado
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={distribuicaoConsultorStatus}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="consultor"
                width={120}
                tick={{ fontSize: 13 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => <span className="text-sm">{value}</span>}
              />
              {STATUS_CONFIG.map(s => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="status"
                  fill={s.color}
                  radius={0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
