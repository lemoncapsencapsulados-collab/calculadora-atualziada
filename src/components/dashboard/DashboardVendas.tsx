import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Users, TrendingUp, Package } from 'lucide-react';
import type { MetricaConsultor, ProdutoVendido, MixVendas } from '@/types/dashboard';
import { Progress } from '@/components/ui/progress';

interface DashboardVendasProps {
  rankingConsultores: MetricaConsultor[];
  produtosMaisVendidos: ProdutoVendido[];
  mixVendas: MixVendas;
}

export function DashboardVendas({ rankingConsultores, produtosMaisVendidos, mixVendas }: DashboardVendasProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const totalFaturamento = rankingConsultores.reduce((acc, c) => acc + c.faturamento, 0);
  const totalVendas = rankingConsultores.reduce((acc, c) => acc + c.vendas, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ranking de Consultores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking de Consultores - Vendas Fechadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankingConsultores.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma venda aprovada no período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingConsultores.map((consultor, index) => (
                  <TableRow key={consultor.consultor}>
                    <TableCell className="font-bold">
                      {index === 0 && <span className="text-yellow-500">🥇</span>}
                      {index === 1 && <span className="text-gray-400">🥈</span>}
                      {index === 2 && <span className="text-amber-600">🥉</span>}
                      {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{consultor.consultor}</TableCell>
                    <TableCell className="text-center">{consultor.vendas}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(consultor.faturamento)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(consultor.ticketMedio)}
                    </TableCell>
                  </TableRow>
                ))}
                {rankingConsultores.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell></TableCell>
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-center">{totalVendas}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(totalFaturamento)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mix de Vendas e Produtos */}
      <div className="space-y-6">
        {/* Mix de Vendas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Mix de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Produção</span>
                  <span className="font-medium">
                    {formatCurrency(mixVendas.producao.valor)} ({mixVendas.producao.percentual.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={mixVendas.producao.percentual} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Serviços</span>
                  <span className="font-medium">
                    {formatCurrency(mixVendas.servicos.valor)} ({mixVendas.servicos.percentual.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={mixVendas.servicos.percentual} className="h-2 [&>div]:bg-purple-500" />
              </div>
              {!mixVendas.equilibrado && (mixVendas.producao.valor + mixVendas.servicos.valor) > 0 && (
                <p className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                  ⚠️ Mix desbalanceado - considere diversificar a oferta
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Produtos Mais Vendidos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-emerald-500" />
              Produtos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {produtosMaisVendidos.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum produto vendido no período
              </p>
            ) : (
              <div className="space-y-3">
                {produtosMaisVendidos.slice(0, 5).map((produto, index) => (
                  <div key={produto.nome} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground w-5">
                        {index + 1}.
                      </span>
                      <span className="truncate text-sm">{produto.nome}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-xs text-muted-foreground">
                        {produto.quantidade} un
                      </span>
                      <span className="text-sm font-medium text-green-600 w-24">
                        {formatCurrency(produto.faturamento)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
