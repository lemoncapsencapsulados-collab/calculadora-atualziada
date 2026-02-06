import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Recompra, MetricasRecorrencia } from '@/types/dashboard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DashboardRecorrenciaProps {
  recompras: Recompra[];
  metricas: MetricasRecorrencia;
  onNovaRecompra: () => void;
  onExcluirRecompra: (id: string) => void;
}

export function DashboardRecorrencia({ 
  recompras, 
  metricas, 
  onNovaRecompra, 
  onExcluirRecompra 
}: DashboardRecorrenciaProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-purple-500" />
            Vendas Recorrentes (Recompras)
          </CardTitle>
          <Button size="sm" onClick={onNovaRecompra}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Recompra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Métricas de Recorrência */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Total Recompras</p>
            <p className="text-lg font-bold text-purple-600">{formatCurrency(metricas.totalRecompras)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">% Recorrente</p>
            <p className="text-lg font-bold">{metricas.percentualRecorrente.toFixed(1)}%</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Clientes Recorrentes</p>
            <p className="text-lg font-bold">{metricas.clientesRecorrentes}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase">Ticket Médio</p>
            <p className="text-lg font-bold">{formatCurrency(metricas.ticketMedioRecompra)}</p>
          </div>
        </div>

        {/* Lista de Recompras */}
        {recompras.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma recompra registrada ainda</p>
            <p className="text-sm">Clique em "Nova Recompra" para adicionar</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recompras.slice(0, 10).map((recompra) => (
                <TableRow key={recompra.id}>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(recompra.data_recompra), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">{recompra.nome_cliente}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{recompra.consultor_responsavel}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{recompra.quantidade_total}</TableCell>
                  <TableCell className="text-right font-semibold text-purple-600">
                    {formatCurrency(Number(recompra.valor_total))}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir recompra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A recompra de {recompra.nome_cliente} será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onExcluirRecompra(recompra.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
