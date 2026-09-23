import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ExternalLink, User, CheckCircle2, MessageSquare } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { ClienteEmAberto, InsightDashboard, OrcamentoDetalhado } from '@/types/dashboard';
import {
  agruparInsightsPorCliente,
  chaveCobranca,
  lerCobrancas,
  salvarCobrancas,
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  type MapaCobrancas,
} from '@/lib/insightsPorCliente';
import { CobrarDevolutivaDialog } from './CobrarDevolutivaDialog';
import { ResolverOrcamentoDialog, type AlvoResolucao } from './ResolverOrcamentoDialog';
import { useInsightResolucoes } from '@/hooks/useInsightResolucoes';
import { Undo2 } from 'lucide-react';

interface Props {
  insights: InsightDashboard[];
  orcamentos: OrcamentoDetalhado[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string) => (d ? format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }) : '—');

export function InsightsPorCliente({ insights, orcamentos }: Props) {
  const navigate = useNavigate();
  const [cobrancas, setCobrancas] = useState<MapaCobrancas>({});
  const [filtroVendedor, setFiltroVendedor] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');
  const [valorMinimo, setValorMinimo] = useState('');
  const [incluirAnteriores, setIncluirAnteriores] = useState(true);
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);
  const [clienteCobranca, setClienteCobranca] = useState<ClienteEmAberto | null>(null);
  const [alvoResolucao, setAlvoResolucao] = useState<AlvoResolucao | null>(null);
  const { resolucoes, marcarResolvido, desfazerResolucao } = useInsightResolucoes();

  useEffect(() => {
    setCobrancas(lerCobrancas());
  }, []);

  const grupos = useMemo(() => {
    const base = incluirAnteriores ? orcamentos : orcamentos.filter(o => !o.foraDoPeriodo);
    return agruparInsightsPorCliente(base, insights);
  }, [orcamentos, insights, incluirAnteriores]);

  const vendedores = useMemo(() => grupos.map(g => g.consultor).sort(), [grupos]);

  const isCobradoHoje = (c: ClienteEmAberto) => {
    const reg = cobrancas[chaveCobranca(c.consultor, c.cliente)];
    if (!reg) return false;
    return differenceInDays(new Date(), parseISO(reg.cobradoEm)) === 0;
  };

  const gruposFiltrados = useMemo(() => {
    const min = Number(valorMinimo) || 0;
    const diasMax = filtroPeriodo === 'todos' ? Infinity : Number(filtroPeriodo);

    return grupos
      .filter(g => filtroVendedor === 'todos' || g.consultor === filtroVendedor)
      .map(g => {
        const clientes = g.clientes
          .map(c => {
            if (['rascunho', 'enviado', 'pago', 'recusado'].includes(filtroStatus)) {
              const itens = c.itens.filter(i => i.status === filtroStatus);
              if (itens.length === 0) return null;
              return { ...c, itens };
            }
            if (filtroStatus === 'aberto') {
              const itens = c.itens.filter(i => i.emAberto);
              if (itens.length === 0) return null;
              return { ...c, itens };
            }
            return c;
          })
          .filter((c): c is ClienteEmAberto => !!c)
          .filter(c => {
            if (c.valorTotal < min) return false;
            if (c.diasParado > diasMax) return false;
            if (filtroStatus === 'cobrados' && !isCobradoHoje(c)) return false;
            return true;
          });
        const ativos = clientes.filter(c => {
          if (cobrancas[chaveCobranca(c.consultor, c.cliente)]) return false;
          const pendentes = c.itens.filter(i => !i.orcamento_id || !resolucoes[i.orcamento_id]);
          return pendentes.length > 0;
        });
        return {
          ...g,
          clientes,
          totalClientes: clientes.length,
          totalAlertas: ativos.filter(c => c.temAlerta).length,
          totalAtencoes: ativos.filter(c => !c.temAlerta && (c.valorEmAberto || 0) > 0).length,
          valorTotal: clientes.reduce((acc, c) => acc + c.valorTotal, 0),
        };
      })
      .filter(g => g.clientes.length > 0);
  }, [grupos, filtroVendedor, filtroStatus, filtroPeriodo, valorMinimo, cobrancas, resolucoes]);

  const metricas = useMemo(() => {
    const clientes = gruposFiltrados.flatMap(g => g.clientes);
    const itens = clientes.flatMap(c => c.itens);
    const pendentes = itens.filter(i => !i.orcamento_id || !resolucoes[i.orcamento_id]);
    return {
      total: itens.filter(i => i.emAberto).reduce((acc, i) => acc + i.valor, 0),
      clientes: clientes.length,
      orcamentos: itens.length,
      semRetorno: pendentes.filter(i => i.emAberto && i.dias >= 5).length,
    };
  }, [gruposFiltrados, resolucoes]);

  const confirmarResolucao = (alvo: AlvoResolucao, observacao: string) => {
    if (!alvo.item.orcamento_id) return;
    marcarResolvido.mutate(
      {
        orcamento_id: alvo.item.orcamento_id,
        numero_orcamento: alvo.item.numero_orcamento,
        cliente: alvo.cliente,
        consultor: alvo.consultor,
        observacao,
      },
      { onSuccess: () => setAlvoResolucao(null) }
    );
  };

  const marcarCobrado = (cliente: ClienteEmAberto, observacao: string) => {
    const proximo: MapaCobrancas = {
      ...cobrancas,
      [chaveCobranca(cliente.consultor, cliente.cliente)]: {
        cobradoEm: new Date().toISOString(),
        observacao: observacao.trim() || undefined,
      },
    };
    setCobrancas(proximo);
    salvarCobrancas(proximo);
  };

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nenhum cliente com orçamento em aberto no período selecionado.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-lg font-semibold">{brl(metricas.total)}</p>
          <p className="text-xs text-muted-foreground">Total em aberto</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-lg font-semibold">{metricas.clientes}</p>
          <p className="text-xs text-muted-foreground">Clientes únicos</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-lg font-semibold">{metricas.orcamentos}</p>
          <p className="text-xs text-muted-foreground">Orçamentos listados</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-lg font-semibold">{metricas.semRetorno}</p>
          <p className="text-xs text-muted-foreground">Sem retorno há 5+ dias</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
          <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os vendedores</SelectItem>
            {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Em aberto</SelectItem>
            <SelectItem value="rascunho">Criado</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="recusado">Recusado</SelectItem>
            <SelectItem value="cobrados">Cobrados hoje</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer período</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Valor mínimo (R$)"
          className="w-[170px] h-8 text-xs"
          value={valorMinimo}
          onChange={e => setValorMinimo(e.target.value)}
        />
        <div className="flex items-center gap-2 h-8">
          <Switch id="incluir-anteriores" checked={incluirAnteriores} onCheckedChange={setIncluirAnteriores} />
          <Label htmlFor="incluir-anteriores" className="text-xs text-muted-foreground">
            Incluir anteriores ao período (em aberto)
          </Label>
        </div>
      </div>

      {gruposFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum cliente encontrado com os filtros selecionados.
        </p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {gruposFiltrados.map(g => (
            <AccordionItem key={g.consultor} value={g.consultor} className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-left w-full pr-2">
                  <span className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {g.consultor}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {g.totalClientes} {g.totalClientes === 1 ? 'cliente' : 'clientes'} · {g.totalAlertas} alertas · {g.totalAtencoes} atenções
                  </span>
                  <span className="text-xs font-medium sm:ml-auto">Total em aberto: {brl(g.valorTotal)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  {g.clientes.map(c => {
                    const chave = chaveCobranca(c.consultor, c.cliente);
                    const reg = cobrancas[chave];
                    const expandido = clienteExpandido === chave;
                    return (
                      <div
                        key={chave}
                        className={`rounded-lg border p-3 ${reg ? 'opacity-60 bg-muted/40' : ''}`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setClienteExpandido(expandido ? null : chave)}
                            className="flex-1 text-left flex flex-wrap items-center gap-x-4 gap-y-1"
                          >
                            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                            <span className="font-medium text-sm">{c.cliente}</span>
                            <span className="text-xs text-muted-foreground">
                              Último: {c.ultimoOrcamento ? format(parseISO(c.ultimoOrcamento), 'dd/MMM/yyyy', { locale: ptBR }) : '—'}
                            </span>
                            <span className="text-xs text-muted-foreground">{c.diasParado} {c.diasParado === 1 ? 'dia' : 'dias'} parado</span>
                            <span className="text-xs font-medium">{brl(c.valorTotal)}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.qtdOrcamentos} {c.qtdOrcamentos === 1 ? 'orçamento' : 'orçamentos'}
                            </span>
                            <Badge variant="outline" className="text-[11px] font-normal">{PRIORIDADE_LABEL[c.prioridade]}</Badge>
                            {reg && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Cobrado em {format(parseISO(reg.cobradoEm), 'dd/MM HH:mm', { locale: ptBR })}
                              </span>
                            )}
                          </button>
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setClienteCobranca(c)}>
                            Cobrar devolutiva
                          </Button>
                        </div>

                        {reg?.observacao && (
                          <p className="mt-2 text-xs italic text-muted-foreground flex items-start gap-1">
                            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                            {reg.observacao}
                          </p>
                        )}

                        {expandido && (
                          <div className="mt-3 space-y-2 border-t pt-2">
                            {c.itens.map((item, idx) => {
                              const resolucao = item.orcamento_id ? resolucoes[item.orcamento_id] : undefined;
                              return (
                              <div
                                key={idx}
                                className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-md p-2 ${
                                  resolucao ? 'border border-success/40 bg-success/10' : ''
                                }`}
                              >
                                {resolucao && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                                <span className="font-medium">{item.numero_orcamento || '—'}</span>
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {item.status ? STATUS_LABEL[item.status] : '—'}
                                </Badge>
                                <span>{brl(item.valor)}</span>
                                <span className="text-muted-foreground">Criado: {fmtData(item.created_at)}</span>
                                <span className="text-muted-foreground">Envio: {fmtData(item.data_envio)}</span>
                                <span className="text-muted-foreground">{item.situacao}</span>
                                {item.foraDoPeriodo && (
                                  <Badge variant="outline" className="text-[10px] font-normal">Anterior ao período</Badge>
                                )}
                                {item.observacao && (
                                  <span className="italic text-muted-foreground basis-full">{item.observacao}</span>
                                )}
                                {resolucao && (
                                  <span className="basis-full text-[11px] text-success">
                                    Resolvido por {resolucao.resolvido_por_email || 'usuário'} em{' '}
                                    {format(parseISO(resolucao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} —{' '}
                                    <span className="italic">{resolucao.observacao}</span>
                                  </span>
                                )}
                                {item.orcamento_id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs"
                                    onClick={() =>
                                      navigate(
                                        `/orcamentos?focus=${item.orcamento_id}${item.numero_orcamento ? `&numero=${encodeURIComponent(item.numero_orcamento)}` : ''}`
                                      )
                                    }
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Ver orçamento
                                  </Button>
                                )}
                                {item.orcamento_id && (
                                  resolucao ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs"
                                      onClick={() => desfazerResolucao.mutate(item.orcamento_id!)}
                                    >
                                      <Undo2 className="w-3 h-3 mr-1" />
                                      Desfazer
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-xs"
                                      onClick={() =>
                                        setAlvoResolucao({ item, cliente: c.cliente, consultor: c.consultor })
                                      }
                                    >
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Marcar como resolvido
                                    </Button>
                                  )
                                )}
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <CobrarDevolutivaDialog
        cliente={clienteCobranca}
        registro={clienteCobranca ? cobrancas[chaveCobranca(clienteCobranca.consultor, clienteCobranca.cliente)] : undefined}
        open={!!clienteCobranca}
        onOpenChange={open => !open && setClienteCobranca(null)}
        onMarcarCobrado={marcarCobrado}
      />

      <ResolverOrcamentoDialog
        alvo={alvoResolucao}
        open={!!alvoResolucao}
        onOpenChange={open => !open && setAlvoResolucao(null)}
        onConfirmar={confirmarResolucao}
        salvando={marcarResolvido.isPending}
      />
    </div>
  );
}