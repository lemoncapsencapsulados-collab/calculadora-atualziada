import { useEffect, useMemo, useState } from 'react';
import { History, Eye, ArrowUp, ArrowDown, Minus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useHistoricoConfiguracao, type HistoricoConfiguracao } from '@/hooks/useHistoricoConfiguracao';
import { formatCurrency } from '@/lib/unitConversion';
import { calcularCustosPorTipo, TIPOS_PRODUTO_KEYS, TIPO_PRODUTO_LABELS, type TipoProdutoKey } from '@/lib/adminCustos';
import { calcularPrecificacaoPorPreco } from '@/lib/precificacaoCalculator';

const LABELS: Record<string, string> = {
  taxa_perca: 'Taxa de Perca (%)',
  folha_producao: 'Folha da Produção',
  folha_administrativa: 'Despesas Administrativas (R$/mês)',
  energia_eletrica: 'Energia Elétrica média (R$/un)',
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

function energiaUnitaria(snap: any, k: TipoProdutoKey): number {
  const ept = (snap?.energia_por_tipo || {}) as Record<string, number>;
  if (Number.isFinite(Number(ept?.[k]))) return Number(ept[k]);
  return Number(snap?.energia_eletrica ?? 0);
}

function calcImpactoMedio(snapshot: any, anterior: any): number {
  // Variação média ponderada do custo total unitário simulado entre os 4 tipos
  const capsNovo = {
    encapsulados: Number(snapshot?.capacidade_encapsulados ?? 0),
    soluvel: Number(snapshot?.capacidade_soluvel ?? 0),
    gummy: Number(snapshot?.capacidade_gummy ?? 0),
    liquido: Number(snapshot?.capacidade_liquido ?? 0),
  };
  const capsAntigo = {
    encapsulados: Number(anterior?.capacidade_encapsulados ?? 0),
    soluvel: Number(anterior?.capacidade_soluvel ?? 0),
    gummy: Number(anterior?.capacidade_gummy ?? 0),
    liquido: Number(anterior?.capacidade_liquido ?? 0),
  };
  const cNovo = calcularCustosPorTipo(Number(snapshot?.folha_producao ?? 0), Number(snapshot?.folha_administrativa ?? 0), capsNovo);
  const cAnt = calcularCustosPorTipo(Number(anterior?.folha_producao ?? 0), Number(anterior?.folha_administrativa ?? 0), capsAntigo);

  let totalCustoNovo = 0;
  let totalCustoAnt = 0;
  let pesoTotal = 0;
  TIPOS_PRODUTO_KEYS.forEach((k) => {
    const peso = capsNovo[k] || capsAntigo[k] || 1;
    const novo = cNovo[k].mod + cNovo[k].admin + energiaUnitaria(snapshot, k) + Number(snapshot?.depreciacao_maquinas ?? 0);
    const ant = cAnt[k].mod + cAnt[k].admin + energiaUnitaria(anterior, k) + Number(anterior?.depreciacao_maquinas ?? 0);
    totalCustoNovo += novo * peso;
    totalCustoAnt += ant * peso;
    pesoTotal += peso;
  });
  if (pesoTotal === 0 || totalCustoAnt === 0) return 0;
  return ((totalCustoNovo - totalCustoAnt) / totalCustoAnt) * 100;
}

function ImpactoBadge({ variacao }: { variacao: number }) {
  if (Math.abs(variacao) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> 0%
      </span>
    );
  }
  const Icon = variacao > 0 ? ArrowUp : ArrowDown;
  const cor = variacao > 0 ? 'text-red-600' : 'text-green-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cor}`}>
      <Icon className="w-3 h-3" />
      {variacao > 0 ? '+' : ''}{variacao.toFixed(2)}%
    </span>
  );
}

function buildConfigSimulada(snapshot: any) {
  // Para usar em calcularPrecificacaoPorPreco precisamos completar com as alíquotas atuais (assumimos zero — comparação relativa).
  return {
    ...snapshot,
    icms_credito_nf: 7, icms_saida: 17, credito_prodeic: 80, fundeb_fundes: 7,
    pis_cofins_saida: 9.25, pis_cofins_credito: 9.25, ipi_saida: 0, irpj_csll: 33,
  } as any;
}

interface Props {
  /** Filtra por intervalo de criação (created_at) — usado pelo link "Ver snapshot" do prazo. */
  filtroDataInicio?: string | null;
  filtroDataFim?: string | null;
  onLimparFiltro?: () => void;
}

export function HistoricoAlteracoes({ filtroDataInicio, filtroDataFim, onLimparFiltro }: Props = {}) {
  const { historico, isLoading } = useHistoricoConfiguracao();
  const [detalhe, setDetalhe] = useState<HistoricoConfiguracao | null>(null);

  const historicoFiltrado = useMemo(() => {
    if (!historico) return [];
    if (!filtroDataInicio && !filtroDataFim) return historico;
    const ini = filtroDataInicio ? new Date(filtroDataInicio).getTime() : -Infinity;
    const fim = filtroDataFim ? new Date(filtroDataFim).getTime() : Infinity;
    return historico.filter((h) => {
      const t = new Date(h.created_at).getTime();
      return t >= ini && t <= fim;
    });
  }, [historico, filtroDataInicio, filtroDataFim]);

  // Abre automaticamente o snapshot principal do intervalo (mais recente)
  useEffect(() => {
    if ((filtroDataInicio || filtroDataFim) && historicoFiltrado.length > 0 && !detalhe) {
      setDetalhe(historicoFiltrado[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDataInicio, filtroDataFim, historicoFiltrado.length]);

  const detalheCalc = useMemo(() => {
    if (!detalhe) return null;
    const snap = detalhe.snapshot || {};
    const ant = detalhe.snapshot_anterior || {};
    const capsNovo: Record<TipoProdutoKey, number> = {
      encapsulados: Number(snap.capacidade_encapsulados ?? 0),
      soluvel: Number(snap.capacidade_soluvel ?? 0),
      gummy: Number(snap.capacidade_gummy ?? 0),
      liquido: Number(snap.capacidade_liquido ?? 0),
    };
    const capsAnt: Record<TipoProdutoKey, number> = {
      encapsulados: Number(ant.capacidade_encapsulados ?? 0),
      soluvel: Number(ant.capacidade_soluvel ?? 0),
      gummy: Number(ant.capacidade_gummy ?? 0),
      liquido: Number(ant.capacidade_liquido ?? 0),
    };
    const custosNovo = calcularCustosPorTipo(Number(snap.folha_producao ?? 0), Number(snap.folha_administrativa ?? 0), capsNovo);
    const custosAnt = calcularCustosPorTipo(Number(ant.folha_producao ?? 0), Number(ant.folha_administrativa ?? 0), capsAnt);

    // Simulação: produto fictício com MP=R$10, Embalagem=R$5
    const cBase = { custoMateriaPrima: 10, custoEmbalagem: 5 };
    const simuladas = TIPOS_PRODUTO_KEYS.map((k) => {
      const ind = (custos: any) => ({
        maoObraDireta: custos[k].mod,
        energia: energiaUnitaria(snap, k),
        depreciacao: Number(snap.depreciacao_maquinas ?? 0),
        administrativo: custos[k].admin,
      });
      const indAnt = {
        maoObraDireta: custosAnt[k].mod,
        energia: energiaUnitaria(ant, k),
        depreciacao: Number(ant.depreciacao_maquinas ?? 0),
        administrativo: custosAnt[k].admin,
      };
      const indNovo = ind(custosNovo);
      const precoFicticio = 50; // referência neutra
      const calcNovo = calcularPrecificacaoPorPreco(cBase, indNovo, precoFicticio, buildConfigSimulada(snap));
      const calcAnt = calcularPrecificacaoPorPreco(cBase, indAnt, precoFicticio, buildConfigSimulada(ant));
      return { k, calcNovo, calcAnt, custosNovo: custosNovo[k], custosAnt: custosAnt[k] };
    });
    return { simuladas, custosNovo, custosAnt };
  }, [detalhe]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5 text-primary" />
          Histórico de Alterações
        </CardTitle>
        {(filtroDataInicio || filtroDataFim) && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary">
              Filtro: {filtroDataInicio ? new Date(filtroDataInicio).toLocaleDateString('pt-BR') : '—'}
              {' → '}
              {filtroDataFim ? new Date(filtroDataFim).toLocaleDateString('pt-BR') : '—'}
            </Badge>
            {onLimparFiltro && (
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onLimparFiltro}>
                <X className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !historicoFiltrado || historicoFiltrado.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Campos alterados</TableHead>
                    <TableHead>Impacto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoFiltrado.map((h) => {
                  const diff = calcularDiff(h.snapshot, h.snapshot_anterior);
                  const mudados = diff.filter((d) => d.mudou);
                    const impacto = calcImpactoMedio(h.snapshot, h.snapshot_anterior);
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
                        <TableCell><ImpactoBadge variacao={impacto} /></TableCell>
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
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Detalhes da alteração
                {detalhe && <span className="ml-2 text-sm font-normal text-muted-foreground">{new Date(detalhe.created_at).toLocaleString('pt-BR')}</span>}
              </DialogTitle>
            </DialogHeader>
            {detalhe && (
              <ScrollArea className="max-h-[70vh] pr-3">
                <h4 className="text-sm font-semibold mb-2">Variáveis estruturais</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variável</TableHead>
                      <TableHead className="text-right">Anterior</TableHead>
                      <TableHead className="text-right">Novo</TableHead>
                      <TableHead className="text-right">Δ R$</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calcularDiff(detalhe.snapshot, detalhe.snapshot_anterior).map((d) => (
                      <TableRow key={d.key} className={d.mudou ? 'bg-amber-500/10' : 'opacity-60'}>
                        <TableCell className="text-sm">{d.label}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(d.key, d.antigo)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmt(d.key, d.novo)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {d.mudou && CAMPOS_MOEDA.has(d.key) ? (
                            <span className={d.novo > d.antigo ? 'text-red-600' : 'text-green-600'}>
                              {d.novo > d.antigo ? '+' : ''}{formatCurrency(d.novo - d.antigo)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {d.mudou ? (
                            <span className={d.novo > d.antigo ? 'text-red-600' : 'text-green-600'}>
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

                {detalheCalc && (
                  <>
                    <Separator className="my-4" />
                    <h4 className="text-sm font-semibold mb-2">Custo unitário derivado por tipo (MOD + Admin)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">MOD antes</TableHead>
                          <TableHead className="text-right">MOD depois</TableHead>
                          <TableHead className="text-right">Admin antes</TableHead>
                          <TableHead className="text-right">Admin depois</TableHead>
                          <TableHead className="text-right">Δ unit.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalheCalc.simuladas.map(({ k, custosAnt, custosNovo }) => {
                          const totalAnt = custosAnt.mod + custosAnt.admin;
                          const totalNovo = custosNovo.mod + custosNovo.admin;
                          const delta = totalNovo - totalAnt;
                          return (
                            <TableRow key={k}>
                              <TableCell className="text-sm">{TIPO_PRODUTO_LABELS[k]}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(custosAnt.mod)}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatCurrency(custosNovo.mod)}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(custosAnt.admin)}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatCurrency(custosNovo.admin)}</TableCell>
                              <TableCell className="text-right text-sm">
                                <span className={Math.abs(delta) < 0.005 ? 'text-muted-foreground' : delta > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <Separator className="my-4" />
                    <h4 className="text-sm font-semibold mb-1">Simulação de impacto no preço final</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      Produto-referência (MP R$ 10,00 + Embalagem R$ 5,00, preço fictício R$ 50,00). Valores ajudam a visualizar como cada tipo é afetado.
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Custo prod. antes</TableHead>
                          <TableHead className="text-right">Custo prod. depois</TableHead>
                          <TableHead className="text-right">Δ Custo</TableHead>
                          <TableHead className="text-right">Δ Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalheCalc.simuladas.map(({ k, calcAnt, calcNovo }) => {
                          const dCusto = calcNovo.totalCustosProducao - calcAnt.totalCustosProducao;
                          const dMargem = calcNovo.margemLucroPercentual - calcAnt.margemLucroPercentual;
                          return (
                            <TableRow key={k}>
                              <TableCell className="text-sm">{TIPO_PRODUTO_LABELS[k]}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(calcAnt.totalCustosProducao)}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatCurrency(calcNovo.totalCustosProducao)}</TableCell>
                              <TableCell className="text-right text-sm">
                                <span className={Math.abs(dCusto) < 0.005 ? 'text-muted-foreground' : dCusto > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {dCusto > 0 ? '+' : ''}{formatCurrency(dCusto)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                <span className={Math.abs(dMargem) < 0.05 ? 'text-muted-foreground' : dMargem > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {dMargem > 0 ? '+' : ''}{dMargem.toFixed(2)} pp
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
