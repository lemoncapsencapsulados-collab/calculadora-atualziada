import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useOrcamentosPaginados, useOrcamentosKanban, useConsultoresDisponiveis } from '@/hooks/useOrcamentosPaginados';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { PrazoPrecoBadge } from '@/components/PrazoPrecoBadge';
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
import PropostaCompletaDialog from '@/components/PropostaCompletaDialog';
import AprovacaoOrcamentoDialog from '@/components/AprovacaoOrcamentoDialog';
import OrcamentoKanbanView from '@/components/OrcamentoKanbanView';
import { useResumosContratoExistentes } from '@/hooks/useResumoContrato';
import { DateNumericInput, buildDate } from '@/components/ui/date-numeric-input';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  pago: { label: 'Pago', variant: 'outline' },
  recusado: { label: 'Recusado', variant: 'destructive' },
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

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const { deleteOrcamento, updateStatus, addContato, removeContato } = useOrcamentos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [consultorFilter, setConsultorFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [editandoOrcamento, setEditandoOrcamento] = useState<Orcamento | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [previewOrcamento, setPreviewOrcamento] = useState<Orcamento | null>(null);
  const [propostaCompletaOrcamento, setPropostaCompletaOrcamento] = useState<Orcamento | null>(null);
  const [verResumoContrato, setVerResumoContrato] = useState<Orcamento | null>(null);
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

  const { orcamentos, totalCount, totalPages, isLoading: listLoading } = useOrcamentosPaginados({
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchTerm,
    consultorFilter: consultorFilter || undefined,
  });

  const { orcamentos: kanbanOrcamentos, isLoading: kanbanLoading } = useOrcamentosKanban({
    searchTerm,
    consultorFilter: consultorFilter || undefined,
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
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('list')}
                  title="Visualização em lista"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('kanban')}
                  title="Visualização Kanban"
                >
                  <Columns3 className="w-4 h-4" />
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
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por cliente, consultor ou número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={consultorFilter || 'all'} onValueChange={(v) => setConsultorFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultores.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                <div className="space-y-4">
                  {orcamentos.map((orcamento) => {
                    const isPago = orcamento.status === 'pago';
                    return (
                      <Card
                        key={orcamento.id}
                        id={`orc-card-${orcamento.id}`}
                        className={`overflow-hidden transition-all ${
                          isPago
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20 shadow-green-100 dark:shadow-green-900/20 shadow-md'
                            : ''
                        }`}
                      >
                        <CardContent className="p-0">
                          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-3 sm:p-4">
                            <div className="space-y-3 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-base sm:text-lg break-words">{orcamento.nome_cliente}</span>
                                    <Badge variant={STATUS_CONFIG[orcamento.status]?.variant || 'secondary'}>
                                      {STATUS_CONFIG[orcamento.status]?.label || orcamento.status}
                                    </Badge>
                                    <Badge variant="outline" className={
                                      (orcamento as any).tipo_orcamento === 'recompra'
                                        ? 'border-orange-500 text-orange-700 dark:text-orange-300'
                                        : 'border-blue-500 text-blue-700 dark:text-blue-300'
                                    }>
                                      {(orcamento as any).tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor'}
                                    </Badge>
                                    {isPago && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                  </div>
                                  <p className="text-muted-foreground text-sm mt-1">
                                    Consultor: <span className="font-medium text-foreground">{orcamento.consultor_responsavel || '—'}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{orcamento.numero_orcamento}</p>
                                  <PrazoPrecoBadge prazoPrecoId={(orcamento as any).prazo_preco_id} className="mt-1" />
                                </div>
                              <Select
                                  value={orcamento.status}
                                  onValueChange={(value) => handleStatusChange(orcamento.id, value as Orcamento['status'])}
                                >
                                  <SelectTrigger className="w-full sm:w-[140px] shrink-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rascunho">Rascunho</SelectItem>
                                    <SelectItem value="enviado">Enviado</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                    <SelectItem value="recusado">Recusado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Criado: {format(new Date(orcamento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </div>
                                {orcamento.updated_at && new Date(orcamento.updated_at).getTime() - new Date(orcamento.created_at).getTime() > 60000 && (
                                  <div className="flex items-center gap-1 text-amber-600">
                                    <Pencil className="w-3 h-3" />
                                    Editado: {format(new Date(orcamento.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </div>
                                )}
                                {isPago && orcamento.data_pagamento && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CalendarIcon className="w-3 h-3" />
                                    Pgto: {format(new Date(orcamento.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                  </div>
                                )}
                                {orcamento.data_envio && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <Send className="w-3 h-3" />
                                    Enviado: {format(new Date(orcamento.data_envio), "dd/MM/yyyy", { locale: ptBR })}
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  {orcamento.itens_producao?.length || 0} produto(s)
                                </div>
                                <div className="flex items-center gap-1">
                                  <Palette className="w-3 h-3" />
                                  {orcamento.servicos_marca?.length || 0} serviço(s)
                                </div>
                              </div>
                              {orcamento.observacoes_internas && (
                                <div className="flex items-start gap-2 text-xs italic text-muted-foreground bg-muted/40 rounded p-2 border border-border/50">
                                  <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span className="whitespace-pre-wrap break-words line-clamp-3">{orcamento.observacoes_internas}</span>
                                </div>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs">Produção</p>
                                  <p className="font-medium">{formatCurrency(orcamento.subtotal_producao)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Serviços</p>
                                  <p className="font-medium">{formatCurrency(orcamento.subtotal_servicos)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs">Total</p>
                                  <p className={`font-bold text-base sm:text-lg ${isPago ? 'text-green-600' : 'text-primary'}`}>
                                    {formatCurrency(orcamento.valor_total)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap lg:flex-col gap-2 lg:justify-start lg:w-[200px]">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 lg:flex-initial"
                                onClick={() => abrirHistorico(orcamento)}
                              >
                                <History className="w-4 h-4 mr-2" />
                                Histórico ({orcamento.historico_contatos?.length || 0})
                              </Button>
                              {orcamento.status === 'enviado' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20 flex-1 lg:flex-initial"
                                  onClick={() => window.open('https://www.asaas.com/c/e8z81rc6owbwhpde', '_blank')}
                                >
                                  <DollarSign className="w-4 h-4 mr-2" />Gerar PIX
                                </Button>
                              )}
                              <Button variant="outline" size="sm" className="flex-1 lg:flex-initial" onClick={() => setEditandoOrcamento(orcamento)}>
                                <Pencil className="w-4 h-4 mr-2" />Editar
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1 lg:flex-initial" onClick={() => setPreviewOrcamento(orcamento)}>
                                <FileText className="w-4 h-4 mr-2" />Gerar PDF
                              </Button>
                              <Button variant="default" size="sm" className="flex-1 lg:flex-initial" onClick={() => setPropostaCompletaOrcamento(orcamento)}>
                                <FileCheck className="w-4 h-4 mr-2" />Resumo para Contrato
                              </Button>
                              {resumosExistentes?.has(orcamento.id) && (
                                <Button variant="outline" size="sm" className="flex-1 lg:flex-initial" onClick={() => setVerResumoContrato(orcamento)}>
                                  <FileSignature className="w-4 h-4 mr-2" />Ver Resumo do Contrato
                                </Button>
                              )}
                              <Button variant="destructive" size="sm" className="flex-1 lg:flex-initial" onClick={() => setDeletandoId(orcamento.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />Excluir
                              </Button>
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
