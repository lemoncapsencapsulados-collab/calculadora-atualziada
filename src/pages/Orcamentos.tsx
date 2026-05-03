import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useOrcamentosPaginados, useOrcamentosKanban, useConsultoresDisponiveis } from '@/hooks/useOrcamentosPaginados';
import { Orcamento } from '@/types/orcamento';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Pencil, Trash2, Calendar, Package, Palette,
  FileText, Plus, CheckCircle2, FileCheck, FileSignature,
  ChevronLeft, ChevronRight, List, Columns3, CalendarIcon, DollarSign,
  Send, MessageSquare
} from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
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

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  pago: { label: 'Pago', variant: 'outline' },
  recusado: { label: 'Recusado', variant: 'destructive' },
};

const PAGE_SIZE = 15;

type ViewMode = 'list' | 'kanban';

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const { deleteOrcamento, updateStatus, updateObservacoesInternas } = useOrcamentos();
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

  // Dialog "Enviado" — escolher data
  const [enviandoOrcamento, setEnviandoOrcamento] = useState<Orcamento | null>(null);
  const [dataEnvioSelecionada, setDataEnvioSelecionada] = useState<Date>(new Date());

  // Dialog "Observação"
  const [observandoOrcamento, setObservandoOrcamento] = useState<Orcamento | null>(null);
  const [textoObservacao, setTextoObservacao] = useState('');

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

  const abrirDialogEnviado = (orc: Orcamento) => {
    setEnviandoOrcamento(orc);
    setDataEnvioSelecionada(orc.data_envio ? new Date(orc.data_envio) : new Date());
  };

  const confirmarEnvio = async () => {
    if (!enviandoOrcamento) return;
    await updateStatus.mutateAsync({
      id: enviandoOrcamento.id,
      status: 'enviado',
      data_envio: dataEnvioSelecionada.toISOString(),
    });
    setEnviandoOrcamento(null);
    invalidateAll();
  };

  const abrirDialogObservacao = (orc: Orcamento) => {
    setObservandoOrcamento(orc);
    setTextoObservacao(orc.observacoes_internas || '');
  };

  const salvarObservacao = async () => {
    if (!observandoOrcamento) return;
    await updateObservacoesInternas.mutateAsync({
      id: observandoOrcamento.id,
      observacoes_internas: textoObservacao,
    });
    setObservandoOrcamento(null);
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando orçamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Orçamentos Gerados
              </CardTitle>
              <CardDescription>
                Gerencie todos os orçamentos comerciais
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
              <Button onClick={() => setCriandoNovo(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Orçamento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
                        className={`overflow-hidden transition-all ${
                          isPago
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20 shadow-green-100 dark:shadow-green-900/20 shadow-md'
                            : ''
                        }`}
                      >
                        <CardContent className="p-0">
                          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-lg">{orcamento.nome_cliente}</span>
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
                                </div>
                              <Select
                                  value={orcamento.status}
                                  onValueChange={(value) => handleStatusChange(orcamento.id, value as Orcamento['status'])}
                                >
                                  <SelectTrigger className="w-full sm:w-[140px]">
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
                              <div className="grid grid-cols-3 gap-4 text-sm">
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
                                  <p className={`font-bold text-lg ${isPago ? 'text-green-600' : 'text-primary'}`}>
                                    {formatCurrency(orcamento.valor_total)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap md:flex-col lg:flex-col gap-2 justify-end">
                              {orcamento.status !== 'enviado' && orcamento.status !== 'pago' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
                                  onClick={() => abrirDialogEnviado(orcamento)}
                                >
                                  <Send className="w-4 h-4 mr-2" />Enviado
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirDialogObservacao(orcamento)}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                {orcamento.observacoes_internas ? 'Editar Obs.' : 'Observação'}
                              </Button>
                              {orcamento.status === 'enviado' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20"
                                  onClick={() => window.open('https://www.asaas.com/c/e8z81rc6owbwhpde', '_blank')}
                                >
                                  <DollarSign className="w-4 h-4 mr-2" />Gerar PIX
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => setEditandoOrcamento(orcamento)}>
                                <Pencil className="w-4 h-4 mr-2" />Editar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setPreviewOrcamento(orcamento)}>
                                <FileText className="w-4 h-4 mr-2" />Gerar PDF
                              </Button>
                              <Button variant="default" size="sm" onClick={() => setPropostaCompletaOrcamento(orcamento)}>
                                <FileCheck className="w-4 h-4 mr-2" />Resumo para Contrato
                              </Button>
                              {resumosExistentes?.has(orcamento.id) && (
                                <Button variant="outline" size="sm" onClick={() => setVerResumoContrato(orcamento)}>
                                  <FileSignature className="w-4 h-4 mr-2" />Ver Resumo do Contrato
                                </Button>
                              )}
                              <Button variant="destructive" size="sm" onClick={() => setDeletandoId(orcamento.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />Excluir
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        {totalCount} resultado{totalCount !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                          <ChevronLeft className="w-4 h-4 mr-1" />Anterior
                        </Button>
                        <span className="text-sm text-muted-foreground px-2">Página {currentPage} de {totalPages}</span>
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

      {/* Dialog: registrar data de envio */}
      <Dialog open={!!enviandoOrcamento} onOpenChange={(open) => !open && setEnviandoOrcamento(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Enviado</DialogTitle>
            <DialogDescription>
              Selecione a data em que o orçamento foi enviado ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Data de envio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataEnvioSelecionada, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={dataEnvioSelecionada}
                  onSelect={(d) => d && setDataEnvioSelecionada(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnviandoOrcamento(null)}>Cancelar</Button>
            <Button onClick={confirmarEnvio} disabled={updateStatus.isPending}>
              <Send className="w-4 h-4 mr-2" />Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: observação interna */}
      <Dialog open={!!observandoOrcamento} onOpenChange={(open) => !open && setObservandoOrcamento(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observação interna</DialogTitle>
            <DialogDescription>
              Anote o contexto comercial deste orçamento. Esta nota aparece nos Insights do Dashboard e não vai para o PDF do cliente.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={textoObservacao}
            onChange={(e) => setTextoObservacao(e.target.value)}
            placeholder="Ex: Cliente pediu desconto, retornar na próxima semana..."
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservandoOrcamento(null)}>Cancelar</Button>
            <Button onClick={salvarObservacao} disabled={updateObservacoesInternas.isPending}>
              Salvar observação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
