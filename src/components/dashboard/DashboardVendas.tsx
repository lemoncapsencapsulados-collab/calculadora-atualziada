import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Users, TrendingUp, Package, AlertCircle, Warehouse, Zap } from 'lucide-react';
import type { MetricaConsultor, ProdutoVendido, MixVendas } from '@/types/dashboard';
import { formatCurrency } from '@/lib/unitConversion';
import { Progress } from '@/components/ui/progress';

interface VendaPorTipo {
  consultor: string;
  novo_produtor: { qtd: number; valor: number };
  recompra: { qtd: number; valor: number };
}

interface ClientePorModelo {
  consultor: string;
  estoque: { qtd: number; valor: number };
  pod: { qtd: number; valor: number };
}

interface DashboardVendasProps {
  rankingConsultores: MetricaConsultor[];
  produtosMaisVendidos: ProdutoVendido[];
  mixVendas: MixVendas;
  consultoresUnicos: string[];
  vendasPorTipo?: VendaPorTipo[];
  clientesPorModelo?: ClientePorModelo[];
}

export function DashboardVendas({ rankingConsultores, produtosMaisVendidos, mixVendas, consultoresUnicos, vendasPorTipo = [], clientesPorModelo = [] }: DashboardVendasProps) {

  // Merge ranking with all consultants, adding zeros for those without sales
  const rankingCompleto = (() => {
    const comVendas = [...rankingConsultores].sort((a, b) => b.faturamento - a.faturamento);
    const nomesComVendas = new Set(comVendas.map(c => c.consultor));
    const semVendas: MetricaConsultor[] = consultoresUnicos
      .filter(nome => !nomesComVendas.has(nome))
      .map(nome => ({ consultor: nome, vendas: 0, faturamento: 0, ticketMedio: 0, clientesUnicos: 0 }));
    return [...comVendas, ...semVendas];
  })();

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
          {rankingCompleto.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum consultor encontrado
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
                {rankingCompleto.map((consultor, index) => (
                  <TableRow key={consultor.consultor} className={consultor.vendas === 0 ? 'opacity-60' : ''}>
                    <TableCell className="font-bold">
                      {consultor.vendas > 0 && index === 0 && <span className="text-yellow-500">🥇</span>}
                      {consultor.vendas > 0 && index === 1 && <span className="text-gray-400">🥈</span>}
                      {consultor.vendas > 0 && index === 2 && <span className="text-amber-600">🥉</span>}
                      {consultor.vendas > 0 && index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                      {consultor.vendas === 0 && <AlertCircle className="h-4 w-4 text-orange-500" />}
                    </TableCell>
                    <TableCell className="font-medium">{consultor.consultor}</TableCell>
                    <TableCell className="text-center">{consultor.vendas}</TableCell>
                    <TableCell className={`text-right font-semibold ${consultor.vendas > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {formatCurrency(consultor.faturamento)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {consultor.vendas > 0 ? formatCurrency(consultor.ticketMedio) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {totalVendas > 0 && (
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

      {/* Mix de Vendas, Tipo e Produtos */}
      <div className="space-y-6">
        {/* Vendas por Tipo (Novo Produtor vs Recompra) */}
        {vendasPorTipo.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-indigo-500" />
                Novo Produtor vs Recompra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-center text-blue-600">Novo Produtor</TableHead>
                    <TableHead className="text-center text-orange-600">Recompra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasPorTipo.map(v => (
                    <TableRow key={v.consultor}>
                      <TableCell className="font-medium">{v.consultor}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{v.novo_produtor.qtd} vendas</span>
                        <br />
                        <span className="text-xs font-semibold text-blue-600">{formatCurrency(v.novo_produtor.valor)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{v.recompra.qtd} vendas</span>
                        <br />
                        <span className="text-xs font-semibold text-orange-600">{formatCurrency(v.recompra.valor)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vendasPorTipo.length > 1 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{vendasPorTipo.reduce((a, v) => a + v.novo_produtor.qtd, 0)} vendas</span>
                        <br />
                        <span className="text-xs font-semibold text-blue-600">{formatCurrency(vendasPorTipo.reduce((a, v) => a + v.novo_produtor.valor, 0))}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{vendasPorTipo.reduce((a, v) => a + v.recompra.qtd, 0)} vendas</span>
                        <br />
                        <span className="text-xs font-semibold text-orange-600">{formatCurrency(vendasPorTipo.reduce((a, v) => a + v.recompra.valor, 0))}</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Clientes com Estoque vs Print On Demand */}
        {clientesPorModelo.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Warehouse className="h-5 w-5 text-emerald-500" />
                Estoque vs Print On Demand
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-center text-emerald-600">
                      <div className="flex items-center justify-center gap-1"><Warehouse className="h-3 w-3" /> Estoque</div>
                    </TableHead>
                    <TableHead className="text-center text-purple-600">
                      <div className="flex items-center justify-center gap-1"><Zap className="h-3 w-3" /> POD</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesPorModelo.map(c => (
                    <TableRow key={c.consultor}>
                      <TableCell className="font-medium">{c.consultor}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{c.estoque.qtd} clientes</span>
                        <br />
                        <span className="text-xs font-semibold text-emerald-600">{formatCurrency(c.estoque.valor)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{c.pod.qtd} clientes</span>
                        <br />
                        <span className="text-xs font-semibold text-purple-600">{formatCurrency(c.pod.valor)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clientesPorModelo.length > 1 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{clientesPorModelo.reduce((a, c) => a + c.estoque.qtd, 0)} clientes</span>
                        <br />
                        <span className="text-xs font-semibold text-emerald-600">{formatCurrency(clientesPorModelo.reduce((a, c) => a + c.estoque.valor, 0))}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{clientesPorModelo.reduce((a, c) => a + c.pod.qtd, 0)} clientes</span>
                        <br />
                        <span className="text-xs font-semibold text-purple-600">{formatCurrency(clientesPorModelo.reduce((a, c) => a + c.pod.valor, 0))}</span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

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
