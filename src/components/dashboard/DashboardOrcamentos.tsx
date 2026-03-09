import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { OrcamentosPorConsultorStatus } from '@/types/dashboard';

interface DashboardOrcamentosProps {
  dados: OrcamentosPorConsultorStatus[];
}

export function DashboardOrcamentos({ dados }: DashboardOrcamentosProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);

  if (dados.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-blue-500" />
          Orçamentos por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consultor</TableHead>
              <TableHead className="text-center">Rascunho</TableHead>
              <TableHead className="text-center">Enviado</TableHead>
              <TableHead className="text-center">Pago</TableHead>
              <TableHead className="text-center">Recusado</TableHead>
              <TableHead className="text-right">Valor Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map(d => (
              <TableRow key={d.consultor}>
                <TableCell className="font-medium">{d.consultor}</TableCell>
                <TableCell className="text-center">
                  <span className="text-muted-foreground">{d.rascunho}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-blue-600 font-medium">{d.enviado}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-green-600 font-medium">{d.pago}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-red-600 font-medium">{d.recusado}</span>
                </TableCell>
                <TableCell className="text-right font-semibold text-orange-600">
                  {formatCurrency(d.valorRascunho + d.valorEnviado)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DashboardOrcamentosDistribuicao({ dados }: DashboardOrcamentosProps) {
  if (dados.length === 0) return null;

  const chartData = dados.map(d => ({
    consultor: d.consultor.split(' ')[0],
    Rascunho: d.rascunho,
    Enviado: d.enviado,
    Pago: d.pago,
    Recusado: d.recusado,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Distribuição de Orçamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="consultor" type="category" width={80} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Rascunho" stackId="a" fill="hsl(var(--muted-foreground))" opacity={0.5} />
            <Bar dataKey="Enviado" stackId="a" fill="hsl(210, 80%, 55%)" />
            <Bar dataKey="Pago" stackId="a" fill="hsl(142, 70%, 45%)" />
            <Bar dataKey="Recusado" stackId="a" fill="hsl(0, 70%, 55%)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
