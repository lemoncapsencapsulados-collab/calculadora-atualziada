import { useState, useMemo } from 'react';
import { usePedidos } from '@/hooks/usePedidos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { 
  Search, FileText, Trash2, Download, Clock, Package, Truck, CheckCircle2,
  Calendar, Info, User, Wallet, ShoppingBag, Layers, Pencil, Printer, ClipboardList,
  FileSpreadsheet, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { gerarPDFOrdemProducao } from '@/lib/pdfGenerator';
import { formatCurrency } from '@/lib/unitConversion';
import {
  gerarRelatorioPedidoPDF,
  gerarRelatorioPedidosGeralPDF,
  gerarRelatorioPedidoExcel,
  gerarRelatorioPedidosGeralExcel,
} from '@/lib/relatoriosPedidos';
import { StatusPedido, AcompanhamentoProcessos as AcompanhamentoType } from '@/types/formula';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import DetalhesPedidoDialog from '@/components/DetalhesPedidoDialog';
import FichaTecnicaDialog from '@/components/FichaTecnicaDialog';
import AcompanhamentoProcessos from '@/components/AcompanhamentoProcessos';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const getStatusFromAcompanhamento = (acomp?: AcompanhamentoType): StatusPedido | null => {
  if (!acomp) return null;
  const fields = ['criacao_marca', 'producao', 'integracao_logistica', 'pagina_venda', 'envio_produto'] as const;
  const allDone = fields.every(k => acomp[k] === 'entregue' || acomp[k] === 'nao_necessario');
  return allDone ? 'concluido' : null;
};

const Pedidos = () => {
  const { pedidos, loading, updateStatus, updateObservacoes, updateAcompanhamento, deletePedido } = usePedidos();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<Date | undefined>();
  const [dataFimFiltro, setDataFimFiltro] = useState<Date | undefined>();
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any>(null);
  const [editingObs, setEditingObs] = useState<{ id: string; obs: string } | null>(null);
  const [fichaTecnicaPedido, setFichaTecnicaPedido] = useState<any>(null);

  const consultoresUnicos = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => {
      const c = p.orcamento_snapshot?.consultor_responsavel;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [pedidos]);


  const getStatusConfig = (status: StatusPedido) => {
    const configs = {
      aguardando_producao: { label: 'Aguardando Produção', icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      no_estoque: { label: 'No Estoque', icon: Package, color: 'bg-blue-100 text-blue-800 border-blue-300' },
      enviado: { label: 'Enviado', icon: Truck, color: 'bg-purple-100 text-purple-800 border-purple-300' },
      concluido: { label: 'Concluído', icon: CheckCircle2, color: 'bg-green-100 text-green-800 border-green-300' },
    };
    return configs[status];
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((pedido) => {
      const snapshot = pedido.orcamento_snapshot;
      const formulaSnap = pedido.formula_snapshot;
      
      const searchLower = searchTerm.toLowerCase();
      let matchesSearch = pedido.numero_pedido.toLowerCase().includes(searchLower);
      
      if (snapshot) {
        matchesSearch = matchesSearch || 
          (snapshot.nome_cliente || '').toLowerCase().includes(searchLower) ||
          (snapshot.consultor_responsavel || '').toLowerCase().includes(searchLower) ||
          (snapshot.numero_orcamento || '').toLowerCase().includes(searchLower);
      } else if (formulaSnap) {
        matchesSearch = matchesSearch ||
          formulaSnap.cliente?.toLowerCase().includes(searchLower) ||
          formulaSnap.nome_formula?.toLowerCase().includes(searchLower);
      }

      const matchesStatus = filterStatus === 'todos' || pedido.status === filterStatus;

      const matchesConsultor = filtroConsultor === 'todos' || 
        (snapshot?.consultor_responsavel || '') === filtroConsultor;

      let matchesData = true;
      if (dataInicioFiltro || dataFimFiltro) {
        const dataPgtoStr = snapshot?.data_pagamento?.substring(0, 10);
        if (!dataPgtoStr) {
          matchesData = false;
        } else {
          if (dataInicioFiltro && dataPgtoStr < format(dataInicioFiltro, 'yyyy-MM-dd')) matchesData = false;
          if (dataFimFiltro && dataPgtoStr > format(dataFimFiltro, 'yyyy-MM-dd')) matchesData = false;
        }
      }

      return matchesSearch && matchesStatus && matchesConsultor && matchesData;
    });
  }, [pedidos, searchTerm, filterStatus, filtroConsultor, dataInicioFiltro, dataFimFiltro]);

  const renderOrcamentoPedido = (pedido: any) => {
    const snap = pedido.orcamento_snapshot;
    if (!snap) return null;

    const itens = snap.itens_producao || [];
    const servicos = snap.servicos_marca || [];
    const dadosCliente = snap.dados_cliente || {};
    const condicoes = snap.condicoes_pagamento || {};
    const frete = snap.detalhamento_frete || {};

    return (
      <div className="space-y-3">
        {/* Header info */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={
            snap.tipo_orcamento === 'recompra'
              ? 'border-orange-500 text-orange-700'
              : 'border-blue-500 text-blue-700'
          }>
            {snap.tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor'}
          </Badge>
          {itens.some((i: any) => i.modelo_negocio === 'print_on_demand') && (
            <Badge variant="outline" className="border-purple-500 text-purple-700">POD</Badge>
          )}
          <span className="text-xs text-muted-foreground">{snap.numero_orcamento}</span>
        </div>

        {snap.consultor_responsavel && (
          <p className="text-sm text-muted-foreground">
            Consultor: <span className="font-medium text-foreground">{snap.consultor_responsavel}</span>
          </p>
        )}

        {/* Produtos */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Package className="w-3 h-3" /> Produtos ({itens.length})
          </p>
          {itens.map((item: any, idx: number) => (
            <div key={idx} className="text-sm flex justify-between items-center">
              <span className="truncate flex-1">
                {item.nome_produto}
                {item.modelo_negocio === 'print_on_demand' ? ' (POD)' : ` x${item.quantidade}`}
              </span>
              <span className="font-medium ml-2">{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Serviços */}
        {servicos.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Layers className="w-3 h-3" /> Serviços ({servicos.length})
            </p>
            {servicos.map((s: any, idx: number) => (
              <div key={idx} className="text-sm flex justify-between">
                <span className="truncate flex-1">{s.nome_plano}</span>
                <span className="font-medium ml-2">{formatCurrency(s.valor)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Totais */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(snap.valor_total)}</span>
        </div>

        {snap.data_pagamento && (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <Calendar className="w-3 h-3" />
            Pgto: {format(new Date(snap.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        )}

        {snap.updated_at && (
          <div className="flex items-center gap-1 text-sm text-amber-600">
            <Pencil className="w-3 h-3" />
            Orçamento editado em: {format(new Date(snap.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        )}

        {/* Dados do Cliente (collapsible) */}
        {dadosCliente.nome_completo && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 px-2">
                <User className="w-3 h-3 mr-1" /> Dados do Cliente ▸
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-2 bg-muted/50 rounded text-xs space-y-1">
              {dadosCliente.nome_completo && <p><strong>Nome:</strong> {dadosCliente.nome_completo}</p>}
              {dadosCliente.email && <p><strong>Email:</strong> {dadosCliente.email}</p>}
              {dadosCliente.telefone && <p><strong>Tel:</strong> {dadosCliente.telefone}</p>}
              {dadosCliente.cnpj && <p><strong>CNPJ:</strong> {dadosCliente.cnpj}</p>}
              {dadosCliente.razao_social && <p><strong>Razão Social:</strong> {dadosCliente.razao_social}</p>}
              {dadosCliente.cidade && <p><strong>Cidade:</strong> {dadosCliente.cidade}/{dadosCliente.estado}</p>}
              {dadosCliente.forma_venda && dadosCliente.forma_venda !== 'sem_informacao' && (
                <p><strong>Forma de venda:</strong> {dadosCliente.forma_venda === 'locais_fisicos' ? 'Locais Físicos' : dadosCliente.forma_venda === 'venda_digital' ? 'Digital' : 'Ambas'}</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Condições de Pagamento (collapsible) */}
        {(condicoes.valor_entrada || condicoes.valor_termino) && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 px-2">
                <Wallet className="w-3 h-3 mr-1" /> Condições de Pagamento ▸
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-2 bg-muted/50 rounded text-xs space-y-1">
              {condicoes.valor_entrada && (
                <p><strong>Entrada:</strong> {formatCurrency(condicoes.valor_entrada)} ({condicoes.forma_pagamento_entrada || '-'})</p>
              )}
              {condicoes.valor_termino && (
                <p><strong>Término:</strong> {formatCurrency(condicoes.valor_termino)} ({condicoes.forma_pagamento_termino || '-'})</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Frete (collapsible) */}
        {frete.detalhamento_envio && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 px-2">
                <Truck className="w-3 h-3 mr-1" /> Frete ▸
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-2 bg-muted/50 rounded text-xs space-y-1">
              <p><strong>Logística:</strong> {
                frete.detalhamento_envio.tipo === 'total_produtor' ? 'Todo para o Produtor' :
                frete.detalhamento_envio.tipo === 'total_lemoncaps' ? 'Via Lemon Caps' : 'Parcial'
              }</p>
              {frete.detalhamento_envio.descricao_parcial && (
                <p>{frete.detalhamento_envio.descricao_parcial}</p>
              )}
              <p><strong>Frete Lemon Caps:</strong> {frete.frete_lemon_caps ? 'Sim' : 'Não'}</p>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  const renderFormulaPedido = (pedido: any) => {
    const snap = pedido.formula_snapshot;
    if (!snap) return <p className="text-sm text-muted-foreground">Sem dados</p>;

    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{snap.nome_formula}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span>Entrega: {format(pedido.data_entrega, 'dd/MM/yyyy', { locale: ptBR })}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-muted-foreground">Quantidade:</span>
          <span className="font-semibold">{pedido.quantidade_produto} {pedido.unidade_produto}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Custo Total:</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(snap.custo_total)}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Pedidos
          </CardTitle>
          <CardDescription>
            Acompanhe e gerencie as ordens de produção
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterStatus === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('todos')}
            >
              Todos ({pedidos.length})
            </Button>
            {(['aguardando_producao', 'no_estoque', 'enviado', 'concluido'] as StatusPedido[]).map((status) => {
              const config = getStatusConfig(status);
              const count = pedidos.filter(p => p.status === status).length;
              const StatusIcon = config.icon;
              return (
                <Button key={status} variant={filterStatus === status ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(status)}>
                  <StatusIcon className="h-4 w-4 mr-1" />
                  {config.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Filtros de Consultor e Data de Pagamento */}
          <div className="flex gap-3 flex-wrap items-end">
            <div className="space-y-1">
              <Label className="text-xs">Consultor</Label>
              <Select value={filtroConsultor} onValueChange={setFiltroConsultor}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {consultoresUnicos.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pgto. De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal h-9", !dataInicioFiltro && "text-muted-foreground")}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {dataInicioFiltro ? format(dataInicioFiltro, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dataInicioFiltro} onSelect={setDataInicioFiltro} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pgto. Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal h-9", !dataFimFiltro && "text-muted-foreground")}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {dataFimFiltro ? format(dataFimFiltro, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dataFimFiltro} onSelect={setDataFimFiltro} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {(filtroConsultor !== 'todos' || dataInicioFiltro || dataFimFiltro) && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFiltroConsultor('todos'); setDataInicioFiltro(undefined); setDataFimFiltro(undefined); }}>
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Exportar Geral
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => gerarRelatorioPedidosGeralPDF(filteredPedidos)}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gerarRelatorioPedidosGeralExcel(filteredPedidos)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filteredPedidos.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {searchTerm || filterStatus !== 'todos' ? 'Nenhum pedido encontrado' : 'Nenhum pedido gerado ainda'}
              </p>
              <p className="text-sm mt-2">
                {!searchTerm && filterStatus === 'todos' && 'Pedidos são criados automaticamente ao aprovar orçamentos'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPedidos.map((pedido) => {
            const derivedStatus = getStatusFromAcompanhamento(pedido.acompanhamento_processos);
            const displayStatus = derivedStatus || pedido.status;
            const statusConfig = getStatusConfig(displayStatus);
            const StatusIcon = statusConfig.icon;
            const isConcluido = displayStatus === 'concluido';
            const isOrcamento = !!pedido.orcamento_snapshot;
            const clienteName = isOrcamento 
              ? pedido.orcamento_snapshot?.nome_cliente 
              : pedido.formula_snapshot?.cliente || 'Cliente';

            return (
              <Card key={pedido.id} className={`hover:shadow-lg transition-shadow ${isConcluido ? 'border-green-400 bg-green-50/50' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-base">{pedido.numero_pedido}</CardTitle>
                      <CardDescription className="text-sm">{clienteName}</CardDescription>
                    </div>
                    <Badge className={`${statusConfig.color} flex items-center gap-1 px-2 py-1`}>
                      <StatusIcon className="h-3 w-3" />
                      <span className="text-xs">{statusConfig.label}</span>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {isOrcamento ? renderOrcamentoPedido(pedido) : renderFormulaPedido(pedido)}

                  {pedido.observacoes && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-yellow-900 mb-1">Observações:</p>
                          <p className="text-xs text-yellow-800 whitespace-pre-line line-clamp-3">{pedido.observacoes}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Acompanhamento de Processos */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 px-2 font-semibold">
                        <ClipboardList className="w-3.5 h-3.5 mr-1" /> Acompanhamento de Processos ▸
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 bg-muted/30 rounded-lg mt-1">
                       <AcompanhamentoProcessos
                        acompanhamento={pedido.acompanhamento_processos}
                        onUpdate={(acomp) => updateAcompanhamento({ id: pedido.id, acompanhamento: acomp, pedidoId: pedido.id })}
                      />
                    </CollapsibleContent>
                  </Collapsible>


                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setPedidoDetalhe(pedido)}>
                      <Info className="h-4 w-4 mr-1" />
                      Ver Detalhes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingObs({ id: pedido.id, obs: pedido.observacoes || '' })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isOrcamento && (
                      <Button variant="outline" size="sm" onClick={() => setFichaTecnicaPedido(pedido)} title="Ficha Técnica">
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    {!isOrcamento && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => gerarPDFOrdemProducao(pedido)}>
                        <Download className="h-4 w-4 mr-1" />
                        Baixar Ordem
                      </Button>
                    )}
                    {isOrcamento && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" title="Relatório">
                            <FileSpreadsheet className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => gerarRelatorioPedidoPDF(pedido)}>
                            <FileText className="h-4 w-4 mr-2" /> PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => gerarRelatorioPedidoExcel(pedido)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o pedido {pedido.numero_pedido}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePedido(pedido.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      <DetalhesPedidoDialog
        pedido={pedidoDetalhe}
        open={!!pedidoDetalhe}
        onOpenChange={(open) => !open && setPedidoDetalhe(null)}
      />

      {/* Dialog de edição de observações */}
      <Dialog open={!!editingObs} onOpenChange={(open) => !open && setEditingObs(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Editar Observações
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingObs?.obs || ''}
            onChange={(e) => setEditingObs(prev => prev ? { ...prev, obs: e.target.value } : null)}
            placeholder="Observações para a equipe de produção..."
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingObs(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (editingObs) {
                await updateObservacoes({ id: editingObs.id, observacoes: editingObs.obs });
                setEditingObs(null);
              }
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FichaTecnicaDialog
        pedido={fichaTecnicaPedido}
        open={!!fichaTecnicaPedido}
        onOpenChange={(open) => !open && setFichaTecnicaPedido(null)}
      />
    </div>
  );
};

export default Pedidos;
