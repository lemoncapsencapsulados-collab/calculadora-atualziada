import { useState } from 'react';
import { History, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHistoricoConfiguracao, type HistoricoConfiguracao } from '@/hooks/useHistoricoConfiguracao';
import { formatCurrency } from '@/lib/unitConversion';

const LABELS: Record<string, string> = {
  taxa_perca: 'Taxa de Perca (%)',
  folha_producao: 'Folha da Produção',
  folha_administrativa: 'Folha Administrativa',
  energia_eletrica: 'Energia Elétrica (R$/un)',
  depreciacao_maquinas: 'Depreciação de Máquinas (R$/un)',
  capacidade_encapsulados: 'Capacidade Encapsulados (un/mês)',
  capacidade_soluvel: 'Capacidade Solúvel (un/mês)',
  capacidade_gummy: 'Capacidade Gummy (un/mês)',
  capacidade_liquido: 'Capacidade Líquido (un/mês)',
  mao_obra_direta: 'MOD média legada (R$/un)',
  despesas_administrativas: 'Admin média legada (R$/un)',
};

const CAMPOS_MOEDA = new Set(['folha_producao','folha_administrativa','energia_eletrica','depreciacao_maquinas','mao_obra_direta','despesas_administrativas']);

function fmt(key: string, v: any): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (CAMPOS_MOEDA.has(key)) return formatCurrency(v);
    return String(v);
  }
  return String(v);
}

function calcularDiff(snapshot: any, anterior: any) {
  const keys = Object.keys(LABELS);
  return keys.map((k) => {
    const novo = Number(snapshot?.[k] ?? 0);
    const antigo = Number(anterior?.[k] ?? 0);
    const mudou = novo !== antigo;
    const variacao = antigo !== 0 ? ((novo - antigo) / antigo) * 100 : 0;
    return { key: k, label: LABELS[k], novo, antigo, mudou, variacao };
  });
}

export function HistoricoAlteracoes() {
  const { historico, isLoading } = useHistoricoConfiguracao();
  const [detalhe, setDetalhe] = useState<HistoricoConfiguracao | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5 text-primary" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !historico || historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Campos alterados</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => {
                  const diff = calcularDiff(h.snapshot, h.snapshot_anterior);
                  const mudados = diff.filter((d) => d.mudou);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm">{new Date(h.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-sm">{h.usuario_email || '—'}</TableCell>
                      <TableCell>
                        {mudados.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Nenhuma diferença</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {mudados.slice(0, 4).map((d) => (
                              <Badge key={d.key} variant="secondary" className="text-xs">{d.label}</Badge>
                            ))}
                            {mudados.length > 4 && (
                              <Badge variant="outline" className="text-xs">+{mudados.length - 4}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetalhe(h)}>
                          <Eye className="w-4 h-4 mr-1" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Detalhes da alteração
                {detalhe && <span className="ml-2 text-sm font-normal text-muted-foreground">{new Date(detalhe.created_at).toLocaleString('pt-BR')}</span>}
              </DialogTitle>
            </DialogHeader>
            {detalhe && (
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variável</TableHead>
                      <TableHead className="text-right">Anterior</TableHead>
                      <TableHead className="text-right">Novo</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calcularDiff(detalhe.snapshot, detalhe.snapshot_anterior).map((d) => (
                      <TableRow key={d.key} className={d.mudou ? 'bg-primary/5' : ''}>
                        <TableCell className="text-sm">{d.label}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(d.key, d.antigo)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmt(d.key, d.novo)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {d.mudou ? (
                            <span className={d.novo > d.antigo ? 'text-green-600' : 'text-red-600'}>
                              {d.antigo === 0 ? '—' : `${d.variacao > 0 ? '+' : ''}${d.variacao.toFixed(1)}%`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
