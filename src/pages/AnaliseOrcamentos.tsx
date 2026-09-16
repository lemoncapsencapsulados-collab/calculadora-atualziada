import { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2, ChevronDown, CircleDashed, Lightbulb, MessageSquarePlus,
  Sparkles, TrendingUp, UserSearch, XCircle,
} from 'lucide-react';
import { useDashboardComercial } from '@/hooks/useDashboardComercial';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import RegistrarCheckupDialog, { type CheckupRegistro } from '@/components/analise/RegistrarCheckupDialog';
import {
  OBJECAO_LABEL, RESULTADO_ESTILO, RESULTADO_LABEL,
  checadoHoje, contarResultados, diasDesdeCheckup, estiloDoHistorico,
  rankingObjecoes, ultimoCheckup,
} from '@/lib/checkupOrcamento';
import type { DashboardFiltros, OrcamentoDetalhado, StatusOrcamentoDetalhado } from '@/types/dashboard';
import type { ContatoOrcamento, ResultadoCheckup } from '@/types/orcamento';

const STATUS_LABEL: Record<StatusOrcamentoDetalhado, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  pago: 'Pago',
  recusado: 'Recusado',
  outro: 'Outro',
};

const ICONE_RESULTADO: Record<ResultadoCheckup, typeof CheckCircle2> = {
  positiva: CheckCircle2,
  negativa: XCircle,
  neutra: CircleDashed,
};

type FiltroCheckup = 'todos' | 'pendentes' | 'positiva' | 'negativa' | 'neutra';

const FILTRO_CHECKUP_LABEL: Record<FiltroCheckup, string> = {
  todos: 'Todos',
  pendentes: 'Nunca checados',
  positiva: 'Positivos',
  negativa: 'Negativos',
  neutra: 'Em aberto',
};

/** Um cartao de KPI do topo. */
function Kpi({ valor, rotulo, destaque }: { valor: string; rotulo: string; destaque?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className={cn('text-2xl font-bold tabular-nums', destaque)}>{valor}</p>
        <p className="text-xs text-muted-foreground">{rotulo}</p>
      </CardContent>
    </Card>
  );
}

/** A linha do tempo da negociacao de um orcamento. */
function Timeline({ historico }: { historico: ContatoOrcamento[] }) {
  const registros = [...historico].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );
  if (registros.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum registro ainda. O primeiro checkup começa o histórico deste cliente.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {registros.map((r) => {
        const estilo = r.resultado ? RESULTADO_ESTILO[r.resultado] : null;
        const Icone = r.resultado ? ICONE_RESULTADO[r.resultado] : CircleDashed;
        return (
          <li key={r.id} className="flex gap-3">
            <span className="relative flex flex-col items-center">
              <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', estilo?.ponto ?? 'bg-muted-foreground/40')} />
              <span className="mt-1 w-px flex-1 bg-border" />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">
                  {format(new Date(r.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {r.registrado_por && (
                  <span className="text-[11px] text-muted-foreground">
                    por {r.registrado_por}
                  </span>
                )}
                {r.resultado ? (
                  <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px]', estilo?.texto)}>
                    <Icone className="mr-1 h-3 w-3" />
                    {RESULTADO_LABEL[r.resultado]}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {r.tipo === 'envio' ? 'Envio' : 'Contato'}
                  </Badge>
                )}
                {r.objecao && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {OBJECAO_LABEL[r.objecao] || r.objecao}
                  </Badge>
                )}
              </div>
              {r.observacao && <p className="mt-0.5 text-sm">{r.observacao}</p>}
              {r.proximo_passo && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Próximo passo:</span> {r.proximo_passo}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function AnaliseOrcamentos() {
  const hoje = new Date();
  const [filtros] = useState<DashboardFiltros>({
    consultor: null,
    periodoTipo: 'mensal',
    dataInicio: startOfMonth(hoje),
    dataFim: endOfMonth(hoje),
  });

  const { consultoresUnicos, orcamentosDetalhados, isLoading } = useDashboardComercial(filtros);
  const { addContato } = useOrcamentos({ enabled: false });
  const { user } = useAuth();
  /** Quem esta' registrando -- o gestor precisa saber de quem veio a nota. */
  const autor =
    (user?.user_metadata as any)?.nome ||
    (user?.user_metadata as any)?.full_name ||
    user?.email ||
    undefined;

  const [consultorFiltro, setConsultorFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [checkupFiltro, setCheckupFiltro] = useState<FiltroCheckup>('todos');
  const [valorMinimo, setValorMinimo] = useState('');
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState<OrcamentoDetalhado | null>(null);
  const [salvando, setSalvando] = useState(false);

  const filtrados = useMemo(() => {
    const minimo = parseFloat(valorMinimo) || 0;
    const termo = busca.trim().toLowerCase();
    return orcamentosDetalhados.filter((o) => {
      if (consultorFiltro !== 'todos' && o.consultor !== consultorFiltro) return false;
      if (statusFiltro !== 'todos' && o.status !== statusFiltro) return false;
      if (minimo > 0 && o.valor < minimo) return false;
      if (termo) {
        const alvoTexto = `${o.cliente} ${o.numero_orcamento || ''} ${o.consultor}`.toLowerCase();
        if (!alvoTexto.includes(termo)) return false;
      }
      if (checkupFiltro !== 'todos') {
        const u = ultimoCheckup(o.historico_contatos);
        if (checkupFiltro === 'pendentes') return !u;
        if (!u?.resultado) return false;
        return u.resultado === checkupFiltro;
      }
      return true;
    });
  }, [orcamentosDetalhados, consultorFiltro, statusFiltro, checkupFiltro, valorMinimo, busca]);

  /** Agrupado por consultor: a checagem acontece 1 a 1, com cada consultor. */
  const porConsultor = useMemo(() => {
    const mapa = new Map<string, OrcamentoDetalhado[]>();
    filtrados.forEach((o) => {
      const chave = o.consultor || 'Sem consultor';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(o);
    });
    return Array.from(mapa.entries())
      .map(([consultor, itens]) => {
        const ordenados = [...itens].sort((a, b) => {
          // Quem nunca foi checado sobe; depois, o mais parado primeiro.
          const ca = ultimoCheckup(a.historico_contatos) ? 1 : 0;
          const cb = ultimoCheckup(b.historico_contatos) ? 1 : 0;
          if (ca !== cb) return ca - cb;
          return b.dias_parado - a.dias_parado;
        });
        const contagem = contarResultados(itens.map((i) => i.historico_contatos));
        return {
          consultor,
          itens: ordenados,
          valorTotal: itens.reduce((s, i) => s + i.valor, 0),
          checadosHoje: itens.filter((i) => checadoHoje(i.historico_contatos)).length,
          contagem,
        };
      })
      .sort((a, b) => b.valorTotal - a.valorTotal);
  }, [filtrados]);

  const resumo = useMemo(() => {
    const contagem = contarResultados(filtrados.map((o) => o.historico_contatos));
    const checados = filtrados.length - contagem.semCheckup;
    return {
      total: filtrados.length,
      valorTotal: filtrados.reduce((s, o) => s + o.valor, 0),
      checados,
      progresso: filtrados.length > 0 ? (checados / filtrados.length) * 100 : 0,
      hoje: filtrados.filter((o) => checadoHoje(o.historico_contatos)).length,
      ...contagem,
    };
  }, [filtrados]);

  const objecoes = useMemo(
    () => rankingObjecoes(filtrados.map((o) => ({ historico: o.historico_contatos, valor: o.valor }))),
    [filtrados],
  );

  const registrarCheckup = async (r: CheckupRegistro) => {
    if (!alvo) return;
    setSalvando(true);
    try {
      await addContato.mutateAsync({
        id: alvo.orcamento_id,
        contato: {
          data: r.data,
          tipo: 'contato',
          observacao: r.observacao,
          resultado: r.resultado,
          objecao: r.objecao,
          proximo_passo: r.proximoPasso,
          registrado_por: autor,
        },
      });
      setAlvo(null);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Lightbulb className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Análise de Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            Checkup um a um: registre a devolutiva do cliente, a objeção e o próximo passo.
          </p>
        </div>
      </div>

      {/* Progresso da checagem -- o que da' a sensacao de avanco. */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              {resumo.checados} de {resumo.total} orçamentos com histórico
            </span>
            <span className="text-xs text-muted-foreground">
              {resumo.hoje} checado(s) hoje
            </span>
          </div>
          <Progress value={resumo.progresso} />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className={RESULTADO_ESTILO.positiva.texto}>
              <CheckCircle2 className="mr-1 h-3 w-3" /> {resumo.positiva} positivos
            </Badge>
            <Badge variant="outline" className={RESULTADO_ESTILO.negativa.texto}>
              <XCircle className="mr-1 h-3 w-3" /> {resumo.negativa} negativos
            </Badge>
            <Badge variant="outline" className={RESULTADO_ESTILO.neutra.texto}>
              <CircleDashed className="mr-1 h-3 w-3" /> {resumo.neutra} em aberto
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {resumo.semCheckup} sem checkup
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi valor={formatCurrency(resumo.valorTotal)} rotulo="Valor em análise" />
        <Kpi valor={String(porConsultor.length)} rotulo="Consultores" />
        <Kpi valor={String(resumo.total)} rotulo="Orçamentos listados" />
        <Kpi
          valor={String(resumo.semCheckup)}
          rotulo="Ninguém falou com eles ainda"
          destaque={resumo.semCheckup > 0 ? 'text-amber-600 dark:text-amber-500' : undefined}
        />
      </div>

      {objecoes.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">O que mais trava a negociação</span>
              <span className="text-xs text-muted-foreground">
                pela última palavra do cliente
              </span>
            </div>
            <div className="space-y-2">
              {objecoes.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => setBusca('')}
                  className="w-full space-y-1 text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm">{o.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {o.quantidade}× · {o.percentual.toFixed(0)}% ·{' '}
                      <span className="font-medium text-foreground">
                        {formatCurrency(o.valorTravado)}
                      </span>{' '}
                      parados
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-red-500/70"
                      style={{ width: `${Math.max(2, o.percentual)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, número ou consultor"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Consultor</Label>
            <Select value={consultorFiltro} onValueChange={setConsultorFiltro}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {consultoresUnicos.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(STATUS_LABEL) as StatusOrcamentoDetalhado[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Checkup</Label>
            <Select value={checkupFiltro} onValueChange={(v) => setCheckupFiltro(v as FiltroCheckup)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FILTRO_CHECKUP_LABEL) as FiltroCheckup[]).map((f) => (
                  <SelectItem key={f} value={f}>{FILTRO_CHECKUP_LABEL[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor mínimo</Label>
            <Input
              type="number"
              value={valorMinimo}
              onChange={(e) => setValorMinimo(e.target.value)}
              placeholder="R$"
              className="w-[130px]"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Carregando orçamentos...</p>
      ) : porConsultor.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserSearch className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>Nenhum orçamento com esses filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {porConsultor.map((grupo) => (
            <Card key={grupo.consultor}>
              <CardContent className="p-4">
                <Collapsible defaultOpen={porConsultor.length <= 2}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="h-auto w-full justify-between px-2 py-2">
                      <span className="flex flex-wrap items-center gap-2 text-left">
                        <span className="font-semibold">{grupo.consultor}</span>
                        <span className="text-xs text-muted-foreground">
                          {grupo.itens.length} orçamento(s) · {formatCurrency(grupo.valorTotal)}
                        </span>
                        {grupo.checadosHoje > 0 && (
                          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] text-green-700 dark:text-green-400">
                            <Sparkles className="h-3 w-3" />
                            {grupo.checadosHoje} hoje
                          </Badge>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="space-y-2 pt-2">
                    {grupo.itens.map((o) => {
                      const estilo = estiloDoHistorico(o.historico_contatos);
                      const ultimo = ultimoCheckup(o.historico_contatos);
                      const dias = diasDesdeCheckup(o.historico_contatos);
                      const foiHoje = checadoHoje(o.historico_contatos);
                      return (
                        <Collapsible
                          key={o.orcamento_id}
                          className={cn(
                            'rounded-md border border-l-4 transition-colors',
                            estilo.borda,
                            estilo.fundo,
                            foiHoje && 'ring-1 ring-primary/40',
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{o.cliente}</span>
                                <span className="text-xs text-muted-foreground">
                                  {o.numero_orcamento || '—'}
                                </span>
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  {STATUS_LABEL[o.status]}
                                </Badge>
                                {foiHoje && (
                                  <Badge className="h-5 gap-1 px-1.5 text-[10px]">
                                    <Sparkles className="h-3 w-3" /> atualizado hoje
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(o.valor)} · {o.situacao}
                                {ultimo
                                  ? ` · último checkup ${dias === 0 ? 'hoje' : `há ${dias} dia(s)`}`
                                  : ' · sem checkup'}
                              </p>
                              {ultimo?.objecao && (
                                <p className={cn('text-xs', estilo.texto)}>
                                  Objeção: {OBJECAO_LABEL[ultimo.objecao] || ultimo.objecao}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => setAlvo(o)}>
                                <MessageSquarePlus className="mr-1 h-4 w-4" />
                                Registrar checkup
                              </Button>
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <TrendingUp className="mr-1 h-4 w-4" />
                                  Histórico
                                  <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent className="border-t px-3 py-3">
                            <Timeline historico={o.historico_contatos || []} />
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegistrarCheckupDialog
        open={!!alvo}
        onOpenChange={(o) => !o && setAlvo(null)}
        numeroOrcamento={alvo?.numero_orcamento || '—'}
        nomeCliente={alvo?.cliente || ''}
        salvando={salvando}
        onRegistrar={registrarCheckup}
      />
    </div>
  );
}
