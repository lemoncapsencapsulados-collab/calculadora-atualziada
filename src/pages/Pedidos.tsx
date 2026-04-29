import { useState, useMemo, useRef } from 'react';
import { usePedidos } from '@/hooks/usePedidos';
import { usePedidoAnexos, PedidoAnexo } from '@/hooks/usePedidoAnexos';
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
  FileSpreadsheet, ChevronDown, Copy, Upload, Eye, Receipt, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, differenceInCalendarDays } from 'date-fns';
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
import { formatarCondicoesPagamento as formatarCondicoesPagamentoUtil } from '@/lib/formatarPagamento';
import { StatusPedido, AcompanhamentoProcessos as AcompanhamentoType } from '@/types/formula';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import DetalhesPedidoDialog from '@/components/DetalhesPedidoDialog';
import FichaTecnicaDialog from '@/components/FichaTecnicaDialog';
import AcompanhamentoProcessos from '@/components/AcompanhamentoProcessos';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClientes, type Cliente } from '@/hooks/useClientes';
import { buildWhatsappUrl, isTelefoneValido } from '@/lib/whatsapp';

const getStatusFromAcompanhamento = (acomp?: AcompanhamentoType): StatusPedido | null => {
  if (!acomp) return null;
  const fields = ['criacao_marca', 'producao', 'integracao_logistica', 'pagina_venda', 'envio_produto'] as const;
  const allDone = fields.every(k => acomp[k] === 'entregue' || acomp[k] === 'nao_necessario');
  return allDone ? 'concluido' : null;
};

const PRAZO_PRODUCAO_DIAS = 30;

const getDataBaseEntrega = (pedido: any): Date => {
  const dataPgto = pedido.orcamento_snapshot?.data_pagamento;
  if (dataPgto) return new Date(dataPgto);
  return new Date(pedido.data_pedido);
};

const calcularPrazoEntrega = (pedido: any) => {
  const base = getDataBaseEntrega(pedido);
  const dataPrevista = addDays(base, PRAZO_PRODUCAO_DIAS);
  const hoje = new Date();
  const diasRestantes = differenceInCalendarDays(dataPrevista, hoje);
  return { dataPrevista, diasRestantes };
};

const csvEscape = (val: any): string => {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
};

const exportarCSV = (pedidos: any[]) => {
  if (!pedidos || pedidos.length === 0) {
    toast.error('Nenhum pedido para exportar');
    return;
  }
  const headers = [
    'Número', 'Cliente', 'Email', 'Telefone', 'Consultor', 'Status',
    'Data Pedido', 'Data Pagamento', 'Entrega Prevista', 'Dias Restantes',
    'Valor Total', 'Pagamento', 'Produtos', 'Observações',
  ];
  const rows = pedidos.map((p) => {
    const snap = p.orcamento_snapshot || {};
    const { dataPrevista, diasRestantes } = calcularPrazoEntrega(p);
    const produtos = (snap.itens_producao || [])
      .map((it: any) => `${it.nome_produto || ''} (${it.quantidade ?? 0})`)
      .join(' | ');
    return [
      p.numero_pedido || '',
      snap.cliente_nome || p.cliente_nome || '',
      snap.cliente_email || '',
      snap.cliente_telefone || '',
      snap.consultor_nome || '',
      p.status || '',
      p.data_pedido ? format(new Date(p.data_pedido), 'dd/MM/yyyy') : '',
      snap.data_pagamento ? format(new Date(snap.data_pagamento), 'dd/MM/yyyy') : '',
      format(dataPrevista, 'dd/MM/yyyy'),
      diasRestantes,
      typeof p.valor_total === 'number' ? p.valor_total.toFixed(2).replace('.', ',') : '',
      snap.metodo_pagamento || '',
      produtos,
      (p.observacoes || '').replace(/\n/g, ' '),
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pedidos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`${pedidos.length} pedido(s) exportado(s)`);
};

const Pedidos = () => {
  const { pedidos, loading, updateStatus, updateObservacoes, updateAcompanhamento, deletePedido } = usePedidos();
  const { clientes } = useClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<Date | undefined>();
  const [dataFimFiltro, setDataFimFiltro] = useState<Date | undefined>();
  const [entregaInicioFiltro, setEntregaInicioFiltro] = useState<Date | undefined>();
  const [entregaFimFiltro, setEntregaFimFiltro] = useState<Date | undefined>();
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any>(null);
  const [editingObs, setEditingObs] = useState<{ id: string; obs: string } | null>(null);
  const [fichaTecnicaPedido, setFichaTecnicaPedido] = useState<any>(null);
  const [comprovantesDialogPedidoId, setComprovantesDialogPedidoId] = useState<string | null>(null);

  const pedidoIds = useMemo(() => pedidos.map(p => p.id), [pedidos]);
  const { getAnexosPorPedido, uploadAnexo, deleteAnexo } = usePedidoAnexos(pedidoIds);

  const contratoInputRef = useRef<HTMLInputElement>(null);
  const comprovanteInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ pedidoId: string; tipo: 'contrato' | 'comprovante' } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    await uploadAnexo(uploadTarget.pedidoId, uploadTarget.tipo, file);
    setUploadTarget(null);
    e.target.value = '';
  };

  const triggerUpload = (pedidoId: string, tipo: 'contrato' | 'comprovante') => {
    setUploadTarget({ pedidoId, tipo });
    setTimeout(() => {
      if (tipo === 'contrato') contratoInputRef.current?.click();
      else comprovanteInputRef.current?.click();
    }, 50);
  };

  const consultoresUnicos = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => {
      const c = p.orcamento_snapshot?.consultor_responsavel;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  const clientesById = useMemo(() => {
    const map = new Map<string, Cliente>();
    clientes.forEach(c => map.set(c.id, c));
    return map;
  }, [clientes]);

  const clientesByNome = useMemo(() => {
    const map = new Map<string, Cliente>();
    clientes.forEach(c => {
      const key = (c.nome || '').trim().toLowerCase();
      if (key) map.set(key, c);
    });
    return map;
  }, [clientes]);

  const getTelefoneCliente = (pedido: any): string => {
    const snap = pedido.orcamento_snapshot || {};
    const candidatos = [
      snap?.dados_cliente?.telefone,
      snap?.cliente_telefone,
      pedido.formula_snapshot?.telefone,
    ];
    for (const t of candidatos) {
      if (isTelefoneValido(t)) return t as string;
    }
    // Fallback: cadastro de clientes
    const clienteId = snap?.cliente_id || snap?.dados_cliente?.cliente_id;
    if (clienteId && clientesById.has(clienteId)) {
      const c = clientesById.get(clienteId)!;
      if (isTelefoneValido(c.telefone)) return c.telefone;
    }
    const nome = (snap?.dados_cliente?.nome_completo || snap?.nome_cliente || pedido.formula_snapshot?.cliente || '').trim().toLowerCase();
    if (nome && clientesByNome.has(nome)) {
      const c = clientesByNome.get(nome)!;
      if (isTelefoneValido(c.telefone)) return c.telefone;
    }
    return '';
  };

  const copiarRelatorioWhatsApp = (pedido: any) => {
    const snap = pedido.orcamento_snapshot;
    if (!snap) {
      toast.error('Pedido sem dados de orçamento para copiar.');
      return;
    }

    const dadosCliente = snap.dados_cliente || {};
    const consultor = snap.consultor_responsavel || '-';
    const nomeCliente = dadosCliente.nome_completo || snap.nome_cliente || '-';
    const valorVenda = snap.valor_total || 0;
    const isRecompra = snap.tipo_orcamento === 'recompra';
    const tipoProdutorLabel = isRecompra ? 'Recompra' : 'Novo produtor';
    const percentualComissao = isRecompra ? 0.01 : 0.05;
    const comissaoValor = valorVenda * percentualComissao;

    const email = dadosCliente.email || '-';
    const cnpj = dadosCliente.cnpj || '-';
    const telefone = dadosCliente.telefone || '-';
    const cidade = dadosCliente.cidade && dadosCliente.estado
      ? `${dadosCliente.cidade}/${dadosCliente.estado}`
      : dadosCliente.cidade || '-';

    const comissaoLabel = isRecompra
      ? `Comissão de 1% da recompra: ${formatCurrency(comissaoValor)}`
      : `Comissão de 5% do valor da venda: ${formatCurrency(comissaoValor)}`;

    const condicoes = snap.condicoes_pagamento || {};
    const linhasPagamento = formatarCondicoesPagamentoUtil(condicoes, valorVenda);

    const acomp = pedido.acompanhamento_processos;
    const statusLbl: Record<string, string> = {
      pendente: '⏳ Pendente',
      entregue: '✅ Entregue',
      nao_necessario: '— Não Necessário',
    };
    const acompLinhas = acomp ? [
      '',
      '🔄 Acompanhamento de Processos:',
      `• Criação de Marca: ${statusLbl[acomp.criacao_marca] || '-'}`,
      `• Produção: ${statusLbl[acomp.producao] || '-'}`,
      `• Integração Logística: ${statusLbl[acomp.integracao_logistica] || '-'}`,
      `• Página de Venda: ${statusLbl[acomp.pagina_venda] || '-'}`,
      `• Envio do Produto: ${statusLbl[acomp.envio_produto] || '-'}`,
      ...(acomp.satisfacao_nota != null
        ? [`⭐ Satisfação: ${acomp.satisfacao_nota}/10${acomp.satisfacao_observacoes ? ` — "${acomp.satisfacao_observacoes}"` : ''}`]
        : []),
    ] : [];

    const texto = [
      `Nome do consultor: ${consultor}`,
      `Nome da Cliente: ${nomeCliente}`,
      `Tipo de produtor: ${tipoProdutorLabel}`,
      ...(snap.data_pagamento ? [`Data de Pagamento: ${format(new Date(snap.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}`] : []),
      `Valor da venda: ${formatCurrency(valorVenda)}`,
      ...((snap.subtotal_producao || 0) > 0 ? [`Valor de Produção: ${formatCurrency(snap.subtotal_producao)}`] : []),
      ...((snap.subtotal_servicos || 0) > 0 ? [`Valor de Setup (Serviços de Marca): ${formatCurrency(snap.subtotal_servicos)}`] : []),
      `E-mail: ${email}`,
      `Cnpj: ${cnpj}`,
      `Telefone: ${telefone}`,
      `Cidade: ${cidade}`,
      '',
      comissaoLabel,
      ...(linhasPagamento.length > 0 ? ['', '💳 Forma de Pagamento:', ...linhasPagamento] : []),
      ...acompLinhas,
      ...(pedido.observacoes ? ['', `📝 Observações: ${pedido.observacoes}`] : []),
    ].join('\n');

    navigator.clipboard.writeText(texto).then(() => {
      toast.success('Relatório copiado para a área de transferência!');
    }).catch(() => {
      toast.error('Erro ao copiar relatório.');
    });
  };


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

      let matchesEntrega = true;
      if (entregaInicioFiltro || entregaFimFiltro) {
        const { dataPrevista } = calcularPrazoEntrega(pedido);
        const dataPrevStr = format(dataPrevista, 'yyyy-MM-dd');
        if (entregaInicioFiltro && dataPrevStr < format(entregaInicioFiltro, 'yyyy-MM-dd')) matchesEntrega = false;
        if (entregaFimFiltro && dataPrevStr > format(entregaFimFiltro, 'yyyy-MM-dd')) matchesEntrega = false;
      }

      return matchesSearch && matchesStatus && matchesConsultor && matchesData && matchesEntrega;
    });
  }, [pedidos, searchTerm, filterStatus, filtroConsultor, dataInicioFiltro, dataFimFiltro, entregaInicioFiltro, entregaFimFiltro]);

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

        {snap.data_pagamento && (
          <div className="flex items-center gap-1 text-sm text-blue-600">
            <Package className="w-3 h-3" />
            Entrega prevista: {format(addDays(new Date(snap.data_pagamento), PRAZO_PRODUCAO_DIAS), "dd/MM/yyyy", { locale: ptBR })}
            <span className="text-xs text-muted-foreground ml-1">(30 dias após pagamento)</span>
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
        {(condicoes.metodo_principal || condicoes.valor_entrada || condicoes.valor_termino) && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 px-2">
                <Wallet className="w-3 h-3 mr-1" /> Condições de Pagamento ▸
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-2 bg-muted/50 rounded text-xs space-y-1">
              {formatarCondicoesPagamentoUtil(condicoes, snap.valor_total).map((line, i) => (
                <p key={i} className="whitespace-pre-wrap">{line}</p>
              ))}
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

            <div className="space-y-1">
              <Label className="text-xs">Entrega De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal h-9", !entregaInicioFiltro && "text-muted-foreground")}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {entregaInicioFiltro ? format(entregaInicioFiltro, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={entregaInicioFiltro} onSelect={setEntregaInicioFiltro} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Entrega Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal h-9", !entregaFimFiltro && "text-muted-foreground")}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {entregaFimFiltro ? format(entregaFimFiltro, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={entregaFimFiltro} onSelect={setEntregaFimFiltro} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {(filtroConsultor !== 'todos' || dataInicioFiltro || dataFimFiltro || entregaInicioFiltro || entregaFimFiltro) && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFiltroConsultor('todos'); setDataInicioFiltro(undefined); setDataFimFiltro(undefined); setEntregaInicioFiltro(undefined); setEntregaFimFiltro(undefined); }}>
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
                <DropdownMenuItem onClick={() => gerarRelatorioPedidosGeralPDF(filteredPedidos, {
                  dataInicio: dataInicioFiltro,
                  dataFim: dataFimFiltro,
                  consultor: filtroConsultor !== 'todos' ? filtroConsultor : undefined,
                  status: filterStatus !== 'todos' ? filterStatus : undefined,
                })}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gerarRelatorioPedidosGeralExcel(filteredPedidos, {
                  dataInicio: dataInicioFiltro,
                  dataFim: dataFimFiltro,
                  consultor: filtroConsultor !== 'todos' ? filtroConsultor : undefined,
                  status: filterStatus !== 'todos' ? filterStatus : undefined,
                })}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => exportarCSV(filteredPedidos)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
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

            const { dataPrevista, diasRestantes } = calcularPrazoEntrega(pedido);
            let prazoColor = 'bg-green-100 text-green-800 border-green-300';
            let prazoLabel = `${diasRestantes} dias restantes`;
            if (isConcluido) {
              prazoColor = 'bg-gray-100 text-gray-700 border-gray-300';
              prazoLabel = 'Entregue';
            } else if (diasRestantes < 0) {
              prazoColor = 'bg-red-100 text-red-800 border-red-300';
              prazoLabel = `Atrasado ${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'}`;
            } else if (diasRestantes === 0) {
              prazoColor = 'bg-red-100 text-red-800 border-red-300';
              prazoLabel = 'Entrega hoje';
            } else if (diasRestantes <= 10) {
              prazoColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
              prazoLabel = `${diasRestantes} ${diasRestantes === 1 ? 'dia restante' : 'dias restantes'}`;
            }

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
                  <div className={`mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-md border ${prazoColor}`}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-bold">{prazoLabel}</span>
                    </div>
                    <span className="text-xs opacity-90">
                      Entrega: {format(dataPrevista, 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
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
                    {isOrcamento && (
                      <Button variant="outline" size="sm" onClick={() => copiarRelatorioWhatsApp(pedido)} title="Copiar Relatório WhatsApp">
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}

                    {(() => {
                      const telefone = getTelefoneCliente(pedido);
                      const nomeCliente = pedido.orcamento_snapshot?.dados_cliente?.nome_completo
                        || pedido.orcamento_snapshot?.nome_cliente
                        || pedido.formula_snapshot?.cliente
                        || 'cliente';
                      const msg = `Olá ${nomeCliente}, tudo bem? Sou da Lemon Caps, entrando em contato sobre o seu pedido ${pedido.numero_pedido}. Previsão de entrega: ${format(dataPrevista, 'dd/MM/yyyy', { locale: ptBR })}.`;
                      const url = buildWhatsappUrl(telefone, msg);
                      const habilitado = !!url;
                      return (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={!habilitado ? 'inline-block cursor-not-allowed' : 'inline-block'}>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={!habilitado}
                                  onClick={() => url && window.open(url, '_blank')}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {habilitado ? 'Abrir conversa no WhatsApp' : 'Telefone do cliente indisponível'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}

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

                  {/* Botões de Anexos */}
                  <div className="flex gap-2 flex-wrap">
                    {(() => {
                      const contratos = getAnexosPorPedido(pedido.id, 'contrato');
                      const comprovantes = getAnexosPorPedido(pedido.id, 'comprovante');
                      return (
                        <>
                          {contratos.length > 0 ? (
                            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => window.open(contratos[0].arquivo_url, '_blank')}>
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Ver Contrato
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => triggerUpload(pedido.id, 'contrato')}>
                              <Upload className="h-3.5 w-3.5 mr-1" />
                              Anexar Contrato
                            </Button>
                          )}
                          {comprovantes.length > 0 ? (
                            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setComprovantesDialogPedidoId(pedido.id)}>
                              <Receipt className="h-3.5 w-3.5 mr-1" />
                              Ver Comprovante(s)
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => triggerUpload(pedido.id, 'comprovante')}>
                              <Upload className="h-3.5 w-3.5 mr-1" />
                              Anexar Comprovante
                            </Button>
                          )}
                        </>
                      );
                    })()}
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

      {/* Hidden file inputs */}
      <input type="file" ref={contratoInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      <input type="file" ref={comprovanteInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" />

      {/* Dialog de Comprovantes */}
      <Dialog open={!!comprovantesDialogPedidoId} onOpenChange={(open) => !open && setComprovantesDialogPedidoId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Comprovantes de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {comprovantesDialogPedidoId && getAnexosPorPedido(comprovantesDialogPedidoId, 'comprovante').map((comp) => (
              <div key={comp.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{comp.arquivo_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(comp.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => window.open(comp.arquivo_url, '_blank')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteAnexo(comp)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {comprovantesDialogPedidoId && getAnexosPorPedido(comprovantesDialogPedidoId, 'comprovante').length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum comprovante anexado.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (comprovantesDialogPedidoId) triggerUpload(comprovantesDialogPedidoId, 'comprovante');
            }}>
              <Upload className="h-4 w-4 mr-1" />
              Adicionar Comprovante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pedidos;
