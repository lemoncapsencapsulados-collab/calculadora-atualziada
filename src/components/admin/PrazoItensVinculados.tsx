import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDown, ArrowUp, Minus, ListChecks } from 'lucide-react';
import { usePrazosAtivos, calcDiasRestantes } from '@/hooks/usePrazoPrecoAtivo';
import { usePrazoItens } from '@/hooks/usePrazoItens';
import { formatCurrency } from '@/lib/unitConversion';

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  em_negociacao: 'Em Negociação',
  aprovado: 'Aprovado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

function statusVariant(s: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (s === 'aprovado' || s === 'pago') return 'default';
  if (s === 'cancelado') return 'destructive';
  if (s === 'em_negociacao') return 'secondary';
  return 'outline';
}

function DeltaPreco({ atual, anterior }: { atual: number; anterior: number | null }) {
  if (anterior == null) {
    return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="w-3 h-3" /> sem recálculo</span>;
  }
  const delta = atual - anterior;
  if (Math.abs(delta) < 0.005) {
    return <span className="text-xs text-muted-foreground">igual</span>;
  }
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  const cor = delta > 0 ? 'text-red-600' : 'text-green-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cor}`}>
      <Icon className="w-3 h-3" />
      {delta > 0 ? '+' : ''}{formatCurrency(delta)}
    </span>
  );
}

export function PrazoItensVinculados() {
  const { data: prazos } = usePrazosAtivos();
  const ativos = (prazos || []).filter((p) => calcDiasRestantes(p.data_fim) > 0);
  // Pega o mais próximo de vencer
  const principal = useMemo(
    () => [...ativos].sort((a, b) => calcDiasRestantes(a.data_fim) - calcDiasRestantes(b.data_fim))[0],
    [ativos],
  );
  const { data: itens, isLoading } = usePrazoItens(principal?.id);
  const [busca, setBusca] = useState('');

  if (!principal) return null;

  const termo = busca.trim().toLowerCase();
  const orcs = (itens?.orcamentos || []).filter(
    (o) => !termo || o.numero_orcamento.toLowerCase().includes(termo) || o.nome_cliente.toLowerCase().includes(termo) || (STATUS_LABELS[o.status] || o.status).toLowerCase().includes(termo),
  );
  const forms = (itens?.formulas || []).filter(
    (f) => !termo || f.nome_formula.toLowerCase().includes(termo) || f.cliente.toLowerCase().includes(termo),
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="w-4 h-4 text-primary" />
          Itens dentro do Prazo de Preços
          <Badge variant="outline" className="ml-2 text-xs">
            {(itens?.orcamentos.length || 0)} orçamento(s) • {(itens?.formulas.length || 0)} fórmula(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Buscar por nº, cliente, status ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="mb-3 max-w-md"
        />
        <Tabs defaultValue="orcamentos">
          <TabsList>
            <TabsTrigger value="orcamentos">Orçamentos ({orcs.length})</TabsTrigger>
            <TabsTrigger value="formulas">Fórmulas ({forms.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="orcamentos">
            <ScrollArea className="h-[280px]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4">Carregando...</p>
              ) : orcs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhum orçamento encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor atual</TableHead>
                      <TableHead className="text-right">Anterior</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orcs.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm font-medium">{o.numero_orcamento}</TableCell>
                        <TableCell className="text-sm">{o.nome_cliente}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(o.status)} className="text-xs">{STATUS_LABELS[o.status] || o.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(o.valor_total) || 0)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {o.preco_anterior_recalculo != null ? formatCurrency(Number(o.preco_anterior_recalculo)) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeltaPreco atual={Number(o.valor_total) || 0} anterior={o.preco_anterior_recalculo != null ? Number(o.preco_anterior_recalculo) : null} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="formulas">
            <ScrollArea className="h-[280px]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4">Carregando...</p>
              ) : forms.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma fórmula encontrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fórmula</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Custo total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm font-medium">{f.nome_formula}</TableCell>
                        <TableCell className="text-sm">{f.cliente}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="text-xs">{f.tipo_produto}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(f.custo_total) || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
