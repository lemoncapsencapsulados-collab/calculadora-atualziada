import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PipelineConsultor } from '@/types/dashboard';

interface DashboardPipelineProps {
  pipelineConsultores: PipelineConsultor[];
}

export function DashboardPipeline({ pipelineConsultores }: DashboardPipelineProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const totalPipeline = pipelineConsultores.reduce((acc, c) => acc + c.valorTotal, 0);
  const totalPropostas = pipelineConsultores.reduce((acc, c) => acc + c.propostas, 0);

  const getDiasBadgeVariant = (dias: number) => {
    if (dias > 7) return 'destructive';
    if (dias > 3) return 'secondary';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-orange-500" />
          Pipeline por Consultor
          <Badge variant="outline" className="ml-auto">
            {totalPropostas} proposta{totalPropostas !== 1 ? 's' : ''} em aberto
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pipelineConsultores.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma proposta em negociação no momento
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-center">Propostas</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-center">Dias Aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipelineConsultores.map((consultor) => (
                <TableRow key={consultor.consultor}>
                  <TableCell className="font-medium">{consultor.consultor}</TableCell>
                  <TableCell className="text-center">{consultor.propostas}</TableCell>
                  <TableCell className="text-right font-semibold text-orange-600">
                    {formatCurrency(consultor.valorTotal)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(consultor.ticketMedio)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getDiasBadgeVariant(consultor.diasMedioAberto)}>
                      {consultor.diasMedioAberto > 7 && (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {consultor.diasMedioAberto} dia{consultor.diasMedioAberto !== 1 ? 's' : ''}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {pipelineConsultores.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL PIPELINE</TableCell>
                  <TableCell className="text-center">{totalPropostas}</TableCell>
                  <TableCell className="text-right text-orange-600">
                    {formatCurrency(totalPipeline)}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
