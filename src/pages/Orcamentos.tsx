import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useOrcamentosPaginados, useOrcamentosKanban, useConsultoresDisponiveis, useTopOrcamentosPorValor } from '@/hooks/useOrcamentosPaginados';
import { Orcamento, ContatoOrcamento, TipoContato } from '@/types/orcamento';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Pencil, Trash2, Calendar, Package, Palette,
  FileText, Plus, CheckCircle2, FileCheck, FileSignature,
  ChevronLeft, ChevronRight, List, Columns3, CalendarIcon, DollarSign,
  Send, MessageSquare, History, X
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import GerarOrcamentoDialog from '@/components/GerarOrcamentoDialog';
import PreviewPdfDialog from '@/components/PreviewPdfDialog';
import PedidoDeCompraDialog from '@/components/pedidos/PedidoDeCompraDialog';
import { listarCamposFaltantes } from '@/types/pedidoCompra';
import PropostaCompletaDialog from '@/components/PropostaCompletaDialog';
import AprovacaoOrcamentoDialog from '@/components/AprovacaoOrcamentoDialog';
import OrcamentoKanbanView from '@/components/OrcamentoKanbanView';
import { useResumosContratoExistentes } from '@/hooks/useResumoContrato';
import { DateNumericInput, buildDate } from '@/components/ui/date-numeric-input';
import { useFreteCotacoes } from '@/hooks/useFreteCotacoes';
import { labelFreteCotacao } from '@/lib/freteHelpers';
import { Truck } from 'lucide-react';
import FreteOrcamentoDialog from '@/components/frete/FreteOrcamentoDialog';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  pago: { label: 'Pago', variant: 'outline' },
  recusado: { label: 'Recusado', variant: 'destructive' },
};

/* Estado é sinal, não fundo. A mesma cor aparece em dois lugares — o trilho
   de 3px na borda do card e o ponto ao lado do nome — para o olho ligar um ao
   outro sem precisar de uma pílula colorida em cada linha. */
const STATUS_RAIL: Record<string, string> = {
  rascunho: 'before:bg-border-strong',
  enviado: 'before:bg-info',
  pago: 'before:bg-success',
  recusado: 'before:bg-destructive',
};

const STATUS_DOT: Record<string, string> = {
  rascunho: 'bg-border-strong',
  enviado: 'bg-info',
  pago: 'bg-success',
  recusado: 'bg-destructive',
};

const CONTRATO_BADGE: Record<string, { label: string; className: string }> = {
  enviado: {
    label: 'Contrato em análise',
    className: 'border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20',
  },
  assinado: {
    label: 'Contrato assinado',
    className: 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
  },
  recusado: {
    label: 'Contrato recusado',
    className: 'border-red-500 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20',
  },
};

const PAGE_SIZE = 15;

type ViewMode = 'list' | 'kanban';

type PeriodoFiltro = 'todos' | 'semanal' | 'quinzenal' | 'mensal' | 'personalizado';

const PERIODO_LABEL: Record<PeriodoFiltro, string> = {
  todos: 'Todo o período',
  semanal: 'Últimos 7 dias',
  quinzenal: 'Últimos 15 dias',
  mensal: 'Últimos 30 dias',
  personalizado: 'Personalizado',
};

/**
 * Converte o periodo escolhido em um intervalo ISO para a consulta. Os presets
 * contam para tras a partir de hoje; o personalizado usa as datas informadas,
 * com o dia final inteiro (ate' 23:59:59) para nao cortar o proprio dia.
 */
function intervaloDoPeriodo(
  periodo: PeriodoFiltro,
  inicio?: Date,
  fim?: Date,
): { inicio?: string; fim?: string } {
  if (periodo === 'todos') return {};

  if (periodo === 'personalizado') {
    const ini = inicio ? new Date(inicio) : undefined;
    if (ini) ini.setHours(0, 0, 0, 0);
    const f = fim ? new Date(fim) : undefined;
    if (f) f.setHours(23, 59, 59, 999);
    return { inicio: ini?.toISOString(), fim: f?.toISOString() };
  }

  const dias = periodo === 'semanal' ? 7 : periodo === 'quinzenal' ? 15 : 30;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  desde.setHours(0, 0, 0, 0);
  return { inicio: desde.toISOString() };
}

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const { deleteOrcamento, updateStatus, addContato, removeContato, salvarPedidoCompra } = useOrcamentos({ enabled: false });
  const [searchParams, setSearchParams] = useSearchParams();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todos');
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>();
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [consultorFilter, setConsultorFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [editandoOrcamento, setEditandoOrcamento] = useState<Orcamento | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [previewOrcamento, setPreviewOrcamento] = useState<Orcamento | null>(null);
  const [pedidoCompraOrcamento, setPedidoCompraOrcamento] = useState<Orcamento | null>(null);
  const [propostaCompletaOrcamento, setPropostaCompletaOrcamento] = useState<Orcamento | null>(null);
  const [verResumoContrato, setVerResumoContrato] = useState<Orcamento | null>(null);
  const [verFreteOrcamento, setVerFreteOrcamento] = useState<Orcamento | null>(null);
  const { data: resumosExistentes } = useResumosContratoExistentes();

  // State para popup de aprovação com proposta completa
  const [aprovandoOrcamento, setAprovandoOrcamento] = useState<Orcamento | null>(null);

  // Dialog "Histórico de Contatos"
  const [historicoOrcamento, setHistoricoOrcamento] = useState<Orcamento | null>(null);
  const [novoContatoData, setNovoContatoData] = useState<Date>(new Date());
  const [novoContatoTipo, setNovoContatoTipo] = useState<TipoContato>('contato');
  const [novoContatoTexto, setNovoContatoTexto] = useState('');
  const [dataDia, setDataDia] = useState('');
  const [dataMes, setDataMes] = useState('');
  const [dataAno, setDataAno] = useState('');

  const consultores = useConsultoresDisponiveis();
  const { data: freteCotacoes = [] } = useFreteCotacoes();
  const freteMap = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of freteCotacoes) {
      const arr = m.get(c.orcamento_id) || [];
      arr.push(c);
      m.set(c.orcamento_id, arr);
    }
    return m;
  }, [freteCotacoes]);

  // O recorte de data vale para a lista, para a contagem e para o Top 5.
  const intervalo = useMemo(
    () => intervaloDoPeriodo(periodo, periodoInicio, periodoFim),
    [periodo, periodoInicio, periodoFim],
  );

  const { orcamentos, totalCount, totalPages, isLoading: listLoading } = useOrcamentosPaginados({
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchTerm,
    consultorFilter: consultorFilter || undefined,
    dataInicio: intervalo.inicio,
    dataFim: intervalo.fim,
    enabled: viewMode === 'list',
  });

  const { topOrcamentos } = useTopOrcamentosPorValor({
    consultorFilter: consultorFilter || undefined,
    dataInicio: intervalo.inicio,
    dataFim: intervalo.fim,
  });

  // Trocar o periodo pode deixar a pagina atual fora do novo total.
  useEffect(() => {
    setCurrentPage(1);
  }, [periodo, periodoInicio, periodoFim]);

  const { orcamentos: kanbanOrcamentos, isLoading: kanbanLoading } = useOrcamentosKanban({
    searchTerm,
    consultorFilter: consultorFilter || undefined,
    enabled: viewMode !== 'list',
  });

  const isLoading = viewMode === 'list' ? listLoading : kanbanLoading;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, consultorFilter]);

  // Deep-link: localiza e destaca o orçamento na lista quando ?focus=<id> está presente.
  // Não abre o diálogo de edição — o usuário ajusta status diretamente no card.
  const focusId = searchParams.get('focus');
  const focusNumero = searchParams.get('numero');
  useEffect(() => {
    if (!focusId) return;
    // Se veio número, aplica filtro de busca para garantir que o card apareça.
    if (focusNumero && searchTerm !== focusNumero) {
      setSearchTerm(focusNumero);
    }
    let attempts = 0;
    const tryHighlight = () => {
      const el = document.getElementById(`orc-card-${focusId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 2500);
        searchParams.delete('focus');
        searchParams.delete('numero');
        setSearchParams(searchParams, { replace: true });
        return true;
      }
      return false;
    };
    if (tryHighlight()) return;
    const interval = setInterval(() => {
      attempts += 1;
      if (tryHighlight() || attempts > 20) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusNumero, orcamentos.length, kanbanOrcamentos.length]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
    queryClient.invalidateQueries({ queryKey: ['orcamentos-kanban'] });
    queryClient.invalidateQueries({ queryKey: ['consultores-disponiveis'] });
    queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['pedidos'] });
  };

  const abrirHistorico = (orc: Orcamento) => {
    setHistoricoOrcamento(orc);
    const hoje = new Date();
    setNovoContatoData(hoje);
    setDataDia(String(hoje.getDate()).padStart(2, '0'));
    setDataMes(String(hoje.getMonth() + 1).padStart(2, '0'));
    setDataAno(String(hoje.getFullYear()));
    setNovoContatoTipo('contato');
    setNovoContatoTexto('');
  };

  // Mantém o diálogo sincronizado com a versão mais recente do orçamento
  useEffect(() => {
    if (!historicoOrcamento) return;
    const all = [...orcamentos, ...kanbanOrcamentos];
    const atualizado = all.find(o => o.id === historicoOrcamento.id);
    if (atualizado && atualizado.updated_at !== historicoOrcamento.updated_at) {
      setHistoricoOrcamento(atualizado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentos, kanbanOrcamentos]);

  const adicionarContato = async () => {
    if (!historicoOrcamento) return;
    if (novoContatoTipo === 'contato' && !novoContatoTexto.trim()) return;
    const novoItem: ContatoOrcamento = {
      id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      data: novoContatoData.toISOString(),
      tipo: novoContatoTipo,
      observacao: novoContatoTexto.trim(),
    };
    // Atualização otimista da timeline
    setHistoricoOrcamento(prev => prev ? {
      ...prev,
      historico_contatos: [...(prev.historico_contatos || []), novoItem],
    } : prev);
    await addContato.mutateAsync({
      id: historicoOrcamento.id,
      contato: {
        data: novoItem.data,
        tipo: novoItem.tipo,
        observacao: novoItem.observacao,
      },
    });
    const hoje = new Date();
    setNovoContatoData(hoje);
    setDataDia(String(hoje.getDate()).padStart(2, '0'));
    setDataMes(String(hoje.getMonth() + 1).padStart(2, '0'));
    setDataAno(String(hoje.getFullYear()));
    setNovoContatoTipo('contato');
    setNovoContatoTexto('');
    invalidateAll();
  };

  const removerContato = async (contatoId: string) => {
    if (!historicoOrcamento) return;
    setHistoricoOrcamento(prev => prev ? {
      ...prev,
      historico_contatos: (prev.historico_contatos || []).filter(c => c.id !== contatoId),
    } : prev);
    await removeContato.mutateAsync({ id: historicoOrcamento.id, contatoId });
    invalidateAll();
  };

  const handleConfirmDelete = async () => {
    if (deletandoId) {
      await deleteOrcamento.mutateAsync(deletandoId);
      setDeletandoId(null);
      invalidateAll();
    }
  };

  const handleStatusChange = async (orcamentoId: string, newStatus: Orcamento['status']) => {
    if (newStatus === 'pago') {
      // Find the full orcamento data
      const allOrcamentos = viewMode === 'list' ? orcamentos : kanbanOrcamentos;
      const orc = allOrcamentos.find(o => o.id === orcamentoId);
      if (orc) {
        setAprovandoOrcamento(orc);
      }
      return;
    }
    await updateStatus.mutateAsync({ id: orcamentoId, status: newStatus });
    invalidateAll();
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando orçamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                Orçamentos Gerados
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Gerencie todos os orçamentos comerciais
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Trilho de segmento: o ativo é sólido, o outro some no fundo. */}
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 rounded-md px-2.5"
                  onClick={() => setViewMode('list')}
                  title="Visualização em lista"
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 rounded-md px-2.5"
                  onClick={() => setViewMode('kanban')}
                  title="Visualização Kanban"
                  aria-pressed={viewMode === 'kanban'}
                >
                  <Columns3 className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => setCriandoNovo(true)} className="flex-1 sm:flex-initial">
                <Plus className="w-4 h-4 mr-2" />
                <span className="whitespace-nowrap">Novo Orçamento</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-3 sm:p-6">
          {/* Filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por cliente, consultor ou número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-lg pl-10"
              />
            </div>
            <Select value={consultorFilter || 'all'} onValueChange={(v) => setConsultorFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-10 w-full rounded-lg sm:w-[220px]">
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultores.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
              <SelectTrigger className="h-10 w-full rounded-lg sm:w-[180px]">
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_LABEL) as PeriodoFiltro[]).map((k) => (
                  <SelectItem key={k} value={k}>{PERIODO_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quantos são: um número, não uma frase. */}
            <p className="shrink-0 text-xs text-muted-foreground sm:pl-1">
              <span className="tnum font-medium text-foreground">{totalCount}</span>{' '}
              {totalCount === 1 ? 'orçamento' : 'orçamentos'}
            </p>
          </div>

          {periodo === 'personalizado' && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">De</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 w-[160px] justify-start font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodoInicio ? format(periodoInicio, 'dd/MM/yyyy') : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodoInicio}
                      onSelect={setPeriodoInicio}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 w-[160px] justify-start font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodoFim ? format(periodoFim, 'dd/MM/yyyy') : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodoFim}
                      onSelect={setPeriodoFim}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {(periodoInicio || periodoFim) && (
                <Button
                  variant="ghost"
                  className="h-10"
                  onClick={() => { setPeriodoInicio(undefined); setPeriodoFim(undefined); }}
                >
                  Limpar datas
                </Button>
              )}
            </div>
          )}

          {/* Top 5 por valor: sai de uma consulta propria, ordenada no banco. */}
          {topOrcamentos.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Top 5 orçamentos por valor</span>
                <span className="text-xs text-muted-foreground">
                  {PERIODO_LABEL[periodo].toLowerCase()}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {topOrcamentos.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setPreviewOrcamento(o)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-background"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
                        {i + 1}º
                      </Badge>
                      <span className="truncate text-sm">{o.nome_cliente}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {o.numero_orcamento}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatCurrency(o.valor_total)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Kanban View */}
          {viewMode === 'kanban' && (
             <OrcamentoKanbanView
              orcamentos={kanbanOrcamentos}
              onEdit={setEditandoOrcamento}
              onDelete={setDeletandoId}
              onPreview={setPreviewOrcamento}
              onPropostaCompleta={setPropostaCompletaOrcamento}
              onVerResumoContrato={setVerResumoContrato}
              resumosExistentes={resumosExistentes}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <>
              {orcamentos.length === 0 ? (
                <div className="py-12 text-center border rounded-lg bg-muted/30">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm || consultorFilter ? 'Nenhum orçamento encontrado.' : 'Nenhum orçamento gerado ainda.'}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setCriandoNovo(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Orçamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orcamentos.map((orcamento) => {
                    const isPago = orcamento.status === 'pago';
                    return (
                      <Card
                        key={orcamento.id}
                        id={`orc-card-${orcamento.id}`}
                        className={cn(
                          // Uma superfície só para todos os estados: o card não muda
                          // de cor, muda de trilho. Assim uma lista de 15 orçamentos
                          // continua sendo uma lista, e não um mosaico.
                          'group relative overflow-hidden border-border shadow-soft',
                          'transition-[box-shadow,border-color] duration-150 ease-out',
                          'hover:border-border-strong hover:shadow-medium',
                          "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
                          STATUS_RAIL[orcamento.status] || 'before:bg-border-strong',
                        )}
                      >
                        <CardContent className="p-0">
                          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-3 p-3 pl-4 sm:p-4 sm:pl-5 xl:grid-cols-[minmax(0,1fr)_auto_auto]">

                            {/* ─── Identidade: quem é, quem atende, o que aconteceu ─── */}
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                <span className="break-words text-base font-semibold tracking-[-0.01em]">{orcamento.nome_cliente}</span>

                                {/* Estado: ponto + palavra. Uma pílula a menos por linha. */}
                                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[orcamento.status] || 'bg-border-strong')} />
                                  {STATUS_CONFIG[orcamento.status]?.label || orcamento.status}
                                </span>

                                <Badge variant="outline" className={cn(
                                  'h-5 px-1.5 text-[11px] font-medium',
                                  (orcamento as any).tipo_orcamento === 'recompra'
                                    ? 'border-warning/35 bg-warning-soft text-warning'
                                    : 'border-info/35 bg-info-soft text-info',
                                )}>
                                  {(orcamento as any).tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor'}
                                </Badge>
                                {(() => {
                                  const sc = (orcamento as any).status_contrato as string | undefined;
                                  const cfg = sc && CONTRATO_BADGE[sc];
                                  return cfg ? (
                                    <Badge variant="outline" className={cn('h-5 px-1.5 text-[11px] font-medium', cfg.className)}>
                                      <FileSignature className="mr-1 h-3 w-3" />
                                      {cfg.label}
                                    </Badge>
                                  ) : null;
                                })()}
                                {(orcamento as any).vhsys_liquidado_em && (orcamento as any).status !== 'pago' && (
                                  <Badge variant="outline" className="h-5 border-info/35 bg-info-soft px-1.5 text-[11px] font-medium text-info">
                                    VHSys liquidado · aguardando contrato
                                  </Badge>
                                )}
                                {(() => {
                                  const cots = freteMap.get(orcamento.id);
                                  if (!cots || cots.length === 0) return null;
                                  const cot = cots[0];
                                  const isEP = cot.tipo === 'estoque_proprio';
                                  const confirmado = cot.status === 'confirmado';
                                  const cls = isEP
                                    ? (confirmado
                                        ? 'border-success/35 bg-success-soft text-success'
                                        : 'border-warning/35 bg-warning-soft text-warning')
                                    : 'border-info/35 bg-info-soft text-info';
                                  const label = cots.length > 1
                                    ? `Frete: ${cots.length} produtos vinculados`
                                    : labelFreteCotacao(cot);
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setVerFreteOrcamento(orcamento)}
                                      title="Ver cotações de frete vinculadas"
                                    >
                                      <Badge variant="outline" className={cn('h-5 cursor-pointer px-1.5 text-[11px] font-medium hover:opacity-80', cls)}>
                                        <Truck className="mr-1 h-3 w-3" />
                                        {label}
                                      </Badge>
                                    </button>
                                  );
                                })()}
                              </div>

                              {/* Consultor e número: um respiro só, não duas linhas. */}
                              <p className="truncate text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{orcamento.consultor_responsavel || '—'}</span>
                                <span className="mx-1.5 text-border-strong">·</span>
                                <span className="tnum">{orcamento.numero_orcamento}</span>
                              </p>

                              {/* Cronologia e volume, em linha única. Os separadores vêm
                                  do CSS (.meta-row) e o excesso some num fade. */}
                              <div className="meta-row text-xs text-muted-foreground">
                                <span>
                                  Criado <span className="tnum text-foreground/75">{format(new Date(orcamento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                </span>
                                {orcamento.updated_at && new Date(orcamento.updated_at).getTime() - new Date(orcamento.created_at).getTime() > 60000 && (
                                  <span>
                                    Editado <span className="tnum text-foreground/75">{format(new Date(orcamento.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                  </span>
                                )}
                                {isPago && orcamento.data_pagamento && (
                                  <span className="font-medium text-success">
                                    Pago em <span className="tnum">{format(new Date(orcamento.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}</span>
                                  </span>
                                )}
                                {orcamento.data_envio && (
                                  <span>
                                    Enviado <span className="tnum text-foreground/75">{format(new Date(orcamento.data_envio), "dd/MM/yyyy", { locale: ptBR })}</span>
                                  </span>
                                )}
                                <span>
                                  {(orcamento.itens_producao?.length || 0) === 1
                                    ? '1 produto'
                                    : `${orcamento.itens_producao?.length || 0} produtos`}
                                </span>
                                <span>
                                  {(orcamento.servicos_marca?.length || 0) === 0
                                    ? 'sem serviços'
                                    : (orcamento.servicos_marca?.length === 1 ? '1 serviço' : `${orcamento.servicos_marca?.length} serviços`)}
                                </span>
                              </div>

                              {orcamento.observacoes_internas && (
                                <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 p-2 text-xs italic text-muted-foreground">
                                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="line-clamp-2 whitespace-pre-wrap break-words">{orcamento.observacoes_internas}</span>
                                </div>
                              )}
                            </div>

                            {/* ─── Dinheiro: colunas de largura fixa, alinhadas à direita ─── */}
                            <div className="flex items-end justify-start gap-4 sm:gap-5 xl:justify-end">
                              <div className="w-[88px] text-right">
                                <p className="eyebrow">Produção</p>
                                <p className={cn('tnum mt-0.5 text-[13px]', orcamento.subtotal_producao ? 'text-foreground' : 'text-muted-foreground')}>
                                  {formatCurrency(orcamento.subtotal_producao)}
                                </p>
                              </div>
                              <div className="w-[88px] text-right">
                                <p className="eyebrow">Serviços</p>
                                <p className={cn('tnum mt-0.5 text-[13px]', orcamento.subtotal_servicos ? 'text-foreground' : 'text-muted-foreground')}>
                                  {formatCurrency(orcamento.subtotal_servicos)}
                                </p>
                              </div>
                              <div className="w-[124px] border-l border-border pl-4 text-right sm:pl-5">
                                <p className="eyebrow">Total</p>
                                <p className={cn('tnum mt-0.5 text-xl font-semibold tracking-[-0.02em]', isPago ? 'text-success' : 'text-foreground')}>
                                  {formatCurrency(orcamento.valor_total)}
                                </p>
                              </div>
                            </div>

                            {/* ─── Ações: o estado, o passo seguinte, e o resto ─── */}
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                              {/* Controle de estado: presente, mas sem borda até ser tocado. */}
                              <Select
                                value={orcamento.status}
                                onValueChange={(value) => handleStatusChange(orcamento.id, value as Orcamento['status'])}
                              >
                                <SelectTrigger
                                  aria-label="Alterar status do orçamento"
                                  className="h-8 w-[124px] shrink-0 border-transparent bg-transparent text-xs shadow-none transition-colors hover:border-border hover:bg-secondary/60 focus:border-border data-[state=open]:border-border data-[state=open]:bg-background"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="rascunho">Rascunho</SelectItem>
                                  <SelectItem value="enviado">Enviado</SelectItem>
                                  <SelectItem value="pago">Pago</SelectItem>
                                  <SelectItem value="recusado">Recusado</SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Ação primária: contorno em repouso, cheia quando a linha
                                  está sob o cursor. Quinze botões sólidos empilhados não
                                  são hierarquia — são ruído. */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-citrus/50 text-foreground transition-colors group-hover:border-citrus group-hover:bg-citrus group-hover:text-citrus-foreground focus-visible:border-citrus focus-visible:bg-citrus focus-visible:text-citrus-foreground"
                                onClick={() => setPropostaCompletaOrcamento(orcamento)}
                              >
                                <FileCheck className="mr-1.5 h-4 w-4" />
                                <span className="hidden sm:inline">Projeto para Contrato</span>
                                <span className="sm:hidden">Projeto</span>
                              </Button>

                              {/* O Pedido de Compra salvo fica acessivel aqui: da'
                                  para reabrir, conferir e baixar quantas vezes
                                  precisar, sem refazer o preenchimento. */}
                              {(() => {
                                const salvos = (orcamento as any).pedido_compra_dados;
                                if (!salvos) return null;
                                const pendentes = listarCamposFaltantes(
                                  salvos,
                                  (orcamento as any).numero_contrato || '',
                                ).length;
                                return (
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      'h-8',
                                      pendentes === 0
                                        ? 'border-green-500/60 text-green-700 dark:text-green-400'
                                        : 'border-amber-500/60 text-amber-700 dark:text-amber-500',
                                    )}
                                    onClick={() => setPedidoCompraOrcamento(orcamento)}
                                  >
                                    <FileSignature className="mr-1.5 h-4 w-4" />
                                    <span className="hidden sm:inline">Pedido de Compra</span>
                                    <span className="sm:hidden">Pedido</span>
                                    <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                                      {pendentes === 0 ? 'completo' : `${pendentes} pend.`}
                                    </Badge>
                                  </Button>
                                );
                              })()}

                              {/* Frequentes: ícone + tooltip. Discretos em repouso, cheios
                                  no hover, sempre visíveis no teclado e no toque. */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative hidden h-8 w-8 opacity-60 transition-opacity after:absolute after:-inset-1 after:content-[''] group-hover:opacity-100 focus-visible:opacity-100 sm:inline-flex [@media(hover:none)]:opacity-100"
                                    onClick={() => setEditandoOrcamento(orcamento)}
                                    aria-label="Editar orçamento"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative hidden h-8 w-8 opacity-60 transition-opacity after:absolute after:-inset-1 after:content-[''] group-hover:opacity-100 focus-visible:opacity-100 sm:inline-flex [@media(hover:none)]:opacity-100"
                                    onClick={() => setPreviewOrcamento(orcamento)}
                                    aria-label="Gerar PDF"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Gerar PDF</TooltipContent>
                              </Tooltip>

                              {/* O resto continua a um clique, sem ocupar a tela. */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative h-8 w-8 opacity-60 transition-opacity after:absolute after:-inset-1 after:content-[''] group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                                    aria-label="Mais ações"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {/* Abaixo de sm os ícones saem da linha; os mesmos
                                      comandos continuam aqui. */}
                                  <DropdownMenuItem className="sm:hidden" onClick={() => setEditandoOrcamento(orcamento)}>
                                    <Pencil className="mr-2 h-4 w-4 opacity-70" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="sm:hidden" onClick={() => setPreviewOrcamento(orcamento)}>
                                    <FileText className="mr-2 h-4 w-4 opacity-70" />
                                    Gerar PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="sm:hidden" />
                                  <DropdownMenuItem onClick={() => abrirHistorico(orcamento)}>
                                    <History className="mr-2 h-4 w-4 opacity-70" />
                                    Histórico
                                    <span className="tnum ml-auto text-xs text-muted-foreground">
                                      {orcamento.historico_contatos?.length || 0}
                                    </span>
                                  </DropdownMenuItem>
                                  {orcamento.status === 'enviado' && (
                                    <DropdownMenuItem onClick={() => window.open('https://www.asaas.com/c/e8z81rc6owbwhpde', '_blank')}>
                                      <DollarSign className="mr-2 h-4 w-4 opacity-70" />
                                      Gerar PIX
                                    </DropdownMenuItem>
                                  )}
                                  {(freteMap.get(orcamento.id)?.length || 0) > 0 && (
                                    <DropdownMenuItem onClick={() => setVerFreteOrcamento(orcamento)}>
                                      <Truck className="mr-2 h-4 w-4 opacity-70" />
                                      Ver frete
                                    </DropdownMenuItem>
                                  )}
                                  {resumosExistentes?.has(orcamento.id) && (
                                    <DropdownMenuItem onClick={() => setVerResumoContrato(orcamento)}>
                                      <FileSignature className="mr-2 h-4 w-4 opacity-70" />
                                      Ver projeto do contrato
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeletandoId(orcamento.id)}
                                    className="text-destructive focus:bg-destructive-soft focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {totalCount} resultado{totalCount !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                          <ChevronLeft className="w-4 h-4 mr-1" />Anterior
                        </Button>
                        <span className="text-xs sm:text-sm text-muted-foreground px-2 whitespace-nowrap">Página {currentPage} de {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>
                          Próxima<ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {(criandoNovo || editandoOrcamento) && (
        <GerarOrcamentoDialog
          orcamentoExistente={editandoOrcamento}
          onClose={() => { setCriandoNovo(false); setEditandoOrcamento(null); }}
          onSuccess={invalidateAll}
        />
      )}

      {pedidoCompraOrcamento && (
        <PedidoDeCompraDialog
          open
          onOpenChange={(o) => !o && setPedidoCompraOrcamento(null)}
          snapshot={pedidoCompraOrcamento as any}
          cliente={{
            razao_social: pedidoCompraOrcamento.dados_cliente?.razao_social,
            nome: pedidoCompraOrcamento.nome_cliente,
            cnpj: pedidoCompraOrcamento.dados_cliente?.cnpj,
            cpf: pedidoCompraOrcamento.dados_cliente?.cpf,
            telefone: pedidoCompraOrcamento.dados_cliente?.telefone,
          }}
          numeroPedido={pedidoCompraOrcamento.numero_orcamento || ''}
          dadosSalvos={(pedidoCompraOrcamento as any).pedido_compra_dados || null}
          contratoSalvo={(pedidoCompraOrcamento as any).numero_contrato || null}
          onAutoSalvar={(dados, numeroContrato) =>
            salvarPedidoCompra.mutate({ id: pedidoCompraOrcamento.id, dados, numeroContrato })
          }
          onGerar={() => setPedidoCompraOrcamento(null)}
        />
      )}

      {previewOrcamento && (
        <PreviewPdfDialog orcamento={previewOrcamento} onClose={() => setPreviewOrcamento(null)} />
      )}

      {propostaCompletaOrcamento && (
        <PropostaCompletaDialog orcamento={propostaCompletaOrcamento} onClose={() => setPropostaCompletaOrcamento(null)} />
      )}

      {verResumoContrato && (
        <PropostaCompletaDialog
          orcamento={verResumoContrato}
          modo="visualizar"
          onClose={() => setVerResumoContrato(null)}
        />
      )}

      {verFreteOrcamento && (
        <FreteOrcamentoDialog
          orcamentoId={verFreteOrcamento.id}
          produtor={verFreteOrcamento.nome_cliente}
          numeroOrcamento={verFreteOrcamento.numero_orcamento}
          onClose={() => setVerFreteOrcamento(null)}
        />
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deletandoId} onOpenChange={(open) => !open && setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Aprovação com Proposta Completa */}
      {aprovandoOrcamento && (
        <AprovacaoOrcamentoDialog
          orcamento={aprovandoOrcamento}
          onClose={() => setAprovandoOrcamento(null)}
          onSuccess={invalidateAll}
        />
      )}

      {/* Dialog: histórico de contatos */}
      <Dialog open={!!historicoOrcamento} onOpenChange={(open) => !open && setHistoricoOrcamento(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg break-words">Histórico de contatos {historicoOrcamento ? `— ${historicoOrcamento.nome_cliente}` : ''}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Registre cada envio de orçamento e cada conversa com o cliente. Esses dados alimentam os Insights do Dashboard.
            </DialogDescription>
          </DialogHeader>

          {/* Timeline */}
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {(historicoOrcamento?.historico_contatos || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum contato registrado ainda.
              </p>
            ) : (
              [...(historicoOrcamento?.historico_contatos || [])]
                .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                .map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded border text-sm',
                      c.tipo === 'envio'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-muted/40 border-border/60'
                    )}
                  >
                    {c.tipo === 'envio'
                      ? <Send className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                      : <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase">
                          {c.tipo === 'envio' ? 'Envio' : 'Contato'} · {format(new Date(c.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removerContato(c.id)}
                          disabled={removeContato.isPending}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      {c.observacao && (
                        <p className="whitespace-pre-wrap break-words mt-1">{c.observacao}</p>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Novo contato */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-sm font-semibold">Registrar novo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={novoContatoTipo} onValueChange={(v) => setNovoContatoTipo(v as TipoContato)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="envio">📤 Envio do orçamento</SelectItem>
                    <SelectItem value="contato">💬 Contato com cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <DateNumericInput
                  dia={dataDia}
                  mes={dataMes}
                  ano={dataAno}
                  onChange={(d, m, a, date) => {
                    setDataDia(d);
                    setDataMes(m);
                    setDataAno(a);
                    if (date) setNovoContatoData(date);
                  }}
                />
              </div>
            </div>
            <Textarea
              value={novoContatoTexto}
              onChange={(e) => setNovoContatoTexto(e.target.value)}
              placeholder={novoContatoTipo === 'envio'
                ? 'Opcional: nota sobre o envio (ex.: enviado por WhatsApp)'
                : 'Feedback da conversa (ex.: cliente pediu desconto, ligar terça)'}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoOrcamento(null)}>Fechar</Button>
            <Button
              onClick={adicionarContato}
              disabled={addContato.isPending || (novoContatoTipo === 'contato' && !novoContatoTexto.trim())}
            >
              <Plus className="w-4 h-4 mr-2" />Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
