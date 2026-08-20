import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBRL } from '@/lib/anuncios';
import type { PontoTimeline } from '@/hooks/useAnunciosDados';

export default function TimelineAnuncios({ dados }: { dados: PontoTimeline[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `R$ ${Math.round(Number(v))}`}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover) / 0.9)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              backdropFilter: 'blur(8px)',
              color: 'hsl(var(--foreground))',
            }}
            formatter={(value: any, name: any) =>
              name === 'Investimento' ? [formatBRL(Number(value)), name] : [value, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="leads" name="Leads" fill="hsl(var(--primary) / 0.65)" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="orcamentos" name="Orçamentos" fill="hsl(var(--secondary) / 0.7)" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="vendas" name="Vendas" fill="hsl(var(--success) / 0.85)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="invest" name="Investimento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
