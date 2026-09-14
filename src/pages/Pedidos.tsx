import { useState, useMemo, useRef, useEffect } from 'react';
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
  FileSpreadsheet, ChevronDown, Copy, Upload, Eye, Receipt, MessageCircle, RefreshCw,
  MoreVertical, ShoppingCart, AlertTriangle, FileSignature,
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
import { ConfirmarExclusaoPedidoDialog } from '@/components/pedidos/ConfirmarExclusaoPedidoDialog';
import { DocumentosPedidoDialog } from '@/components/pedidos/DocumentosPedidoDialog';
import { AlterarPagamentoDialog } from '@/components/pedidos/AlterarPagamentoDialog';
import HistoricoPagamentoLista from '@/components/pedidos/HistoricoPagamentoLista';
import DetalhesPedidoDialog from '@/components/DetalhesPedidoDialog';
import FichaTecnicaDialog from '@/components/FichaTecnicaDialog';
import AcompanhamentoProcessos from '@/components/AcompanhamentoProcessos';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClientes, type Cliente } from '@/hooks/useClientes';
import { buildWhatsappUrl, formatTelefone, isTelefoneValido } from '@/lib/whatsapp';
import AdicionarRecompraDialog from '@/components/pedidos/AdicionarRecompraDialog';
import GerarOrcamentoDialog from '@/components/GerarOrcamentoDialog';
import type { Orcamento } from '@/types/orcamento';
import { MSG_PEDIDO_INCOMPLETO, compararPorSequencial, parseNumeroPedido } from '@/lib/numeroPedido';
import PedidoDeCompraDialog from '@/components/pedidos/PedidoDeCompraDialog';
import PreviewPdfDialog from '@/components/PreviewPdfDialog';
import {
  STATUS_APROVACAO_CLASSE, STATUS_APROVACAO_LABEL, type StatusAprovacao,
} from '@/types/pedidoCompra';

const getStatusFromAcompanhamento = (acomp?: AcompanhamentoType): StatusPedido | null => {
  if (!acomp) return null;
  const fields = ['criacao_marca', 'producao', 'integracao_logistica', 'pagina_venda', 'envio_produto'] as const;
  const allDone = fields.every(k => acomp[k] === 'entregue' || acomp[k] === 'nao_necessario');
  return allDone ? 'concluido' : null;
};

const PRAZO_PRODUCAO_DIAS = 30;

// Faturamento efetivo de um item POD = qtd consumida × preço unitário
// (cobre registros antigos salvos com quantidade/subtotal zerados).
const getItemValorEfetivo = (item: any): number => {
  const subtotal = Number(item?.subtotal) || 0;
  if (subtotal > 0) return subtotal;
  if (item?.modelo_negocio === 'print_on_demand') {
    const qtd = Number(item?.pod_consumo_quantidade) || Number(item?.quantidade) || 0;
    const preco = Number(item?.preco_unitario) || 0;
    return qtd * preco;
  }
  return (Number(item?.quantidade) || 0) * (Number(item?.preco_unitario) || 0);
};

// Total efetivo do pedido — recalcula POD a partir dos itens quando o snapshot veio com 0
const getPedidoValorEfetivo = (snap: any): number => {
  const total = Number(snap?.valor_total) || 0;
  if (total > 0) return total;
  const itens = (snap?.itens_producao || []) as any[];
  const servicos = (snap?.servicos_marca || []) as any[];
  const somaItens = itens.reduce((s, i) => s + getItemValorEfetivo(i), 0);
  const somaServicos = servicos.reduce((s, i) => s + (Number(i?.valor) || 0), 0);
  return somaItens + somaServicos;
};


/** Um produtor e' um CNPJ (ou, sem CNPJ, um cliente) com todos os seus pedidos. */
interface GrupoProdutor {
  chave: string;
  /** Id do cliente cadastrado, quando existe. E' o que pre-seleciona o cliente
   *  no gerador de orcamento -- sem ele o campo abre vazio. */
  clienteId?: string;
  cnpj: string;
  razaoSocial: string;
  nomeCliente: string;
  telefone: string;
  /** Do primeiro pedido para o mais recente. */
  pedidos: any[];
}

const normalizeDoc = (doc: string | null | undefined): string => (doc || '').replace(/\D/g, '');

/**
 * O Pedido de Compra pode partir de um pedido que ja' existe ou de um orcamento
 * de recompra recem-gerado, que ainda nao virou pedido.
 */
type AlvoPedidoCompra =
  | { tipo: 'pedido'; pedido: any; grupo: GrupoProdutor }
  | { tipo: 'orcamento'; orcamento: Orcamento; grupo: GrupoProdutor };

/**
 * O caminho inverso: reconstitui um Orcamento a partir do snapshot do pedido,
 * para gerar o mesmo PDF que "Orçamentos Gerados" entrega ao cliente. O snapshot
 * ja' carrega tudo que o gerador le'; o resto e' preenchido com neutros.
 */
const snapshotComoOrcamento = (pedido: any): Orcamento => {
  const snap = pedido?.orcamento_snapshot || {};
  return {
    id: pedido?.orcamento_id || pedido?.id || '',
    numero_orcamento: snap.numero_orcamento || pedido?.numero_pedido || '',
    nome_cliente: snap.nome_cliente || '',
    cliente_id: snap.cliente_id,
    consultor_responsavel: snap.consultor_responsavel,
    tipo_orcamento: snap.tipo_orcamento || 'novo_produtor',
    itens_producao: snap.itens_producao || [],
    servicos_marca: snap.servicos_marca || [],
    dados_cliente: snap.dados_cliente,
    detalhamento_frete: snap.detalhamento_frete,
    condicoes_pagamento: snap.condicoes_pagamento,
    subtotal_producao: Number(snap.subtotal_producao) || 0,
    subtotal_servicos: Number(snap.subtotal_servicos) || 0,
    valor_total: Number(snap.valor_total) || 0,
    observacoes: snap.observacoes,
    forma_pagamento: snap.forma_pagamento,
    validade_dias: Number(snap.validade_dias) || 7,
    status: 'pago',
    created_at: (pedido?.data_pedido instanceof Date
      ? pedido.data_pedido
      : new Date(pedido?.data_pedido || Date.now())
    ).toISOString(),
    updated_at: new Date().toISOString(),
  } as Orcamento;
};

/** O orcamento tem os mesmos campos que o snapshot guarda; so' reempacota. */
const orcamentoComoSnapshot = (o: Orcamento): any => ({
  numero_orcamento: o.numero_orcamento,
  nome_cliente: o.nome_cliente,
  consultor_responsavel: o.consultor_responsavel,
  tipo_orcamento: o.tipo_orcamento,
  itens_producao: o.itens_producao || [],
  servicos_marca: o.servicos_marca || [],
  dados_cliente: o.dados_cliente,
  detalhamento_frete: o.detalhamento_frete,
  condicoes_pagamento: o.condicoes_pagamento,
  subtotal_producao: o.subtotal_producao,
  subtotal_servicos: o.subtotal_servicos,
  valor_total: o.valor_total,
  observacoes: o.observacoes,
});

/** Data que posiciona o pedido na linha do tempo do produtor. */
const getDataPedidoOrdenacao = (pedido: any): Date | null => {
  const raw = pedido.data_pedido || pedido.orcamento_snapshot?.data_pagamento || pedido.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

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
  const { pedidos, loading, updateStatus, updateObservacoes, deletePedidoAsync, deletandoPedido, alterarPagamento, vincularPedidoCompra, createPedidoFromOrcamento } = usePedidos();
  const { clientes, atualizarCliente } = useClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroConsultor, setFiltroConsultor] = useState<string>('todos');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<Date | undefined>();
  const [dataFimFiltro, setDataFimFiltro] = useState<Date | undefined>();
  const [entregaInicioFiltro, setEntregaInicioFiltro] = useState<Date | undefined>();
  const [entregaFimFiltro, setEntregaFimFiltro] = useState<Date | undefined>();
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any>(null);
  const [editingObs, setEditingObs] = useState<{ id: string; obs: string } | null>(null);
  const [fichaTecnicaPedido, setFichaTecnicaPedido] = useState<any>(null);
  const [documentosDialogPedidoId, setDocumentosDialogPedidoId] = useState<string | null>(null);
  const [recompraPedido, setRecompraPedido] = useState<any | null>(null);
  const [pedidoParaExcluir, setPedidoParaExcluir] = useState<{ id: string; numero: string } | null>(null);
  const [pedidoParaEditarPagto, setPedidoParaEditarPagto] = useState<any | null>(null);
  const [rascunhoRecompra, setRascunhoRecompra] = useState<
    { rascunho: Partial<Orcamento>; grupo: GrupoProdutor } | null
  >(null);
  const [pedidoCompraAlvo, setPedidoCompraAlvo] = useState<AlvoPedidoCompra | null>(null);
  const [orcamentoPdf, setOrcamentoPdf] = useState<Orcamento | null>(null);
  const [editandoOrcamento, setEditandoOrcamento] = useState<
    { orcamento: Orcamento; grupo: GrupoProdutor } | null
  >(null);

  // Abre detalhe automaticamente quando a URL contém ?pedido=<id>
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pedidoId = params.get('pedido');
    if (!pedidoId || pedidos.length === 0) return;
    const found = pedidos.find((p: any) => p.id === pedidoId);
    if (found) {
      setPedidoDetalhe(found);
      const url = new URL(window.location.href);
      url.searchParams.delete('pedido');
      window.history.replaceState({}, '', url.toString());
    }
  }, [pedidos]);

  const pedidoIds = useMemo(() => pedidos.map(p => p.id), [pedidos]);
  const { getAnexosPorPedido, uploadAnexo, deleteAnexo, reordenarAnexos } = usePedidoAnexos(pedidoIds);


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

  const clientesByCnpj = useMemo(() => {
    const map = new Map<string, Cliente>();
    clientes.forEach((c) => {
      const doc = normalizeDoc(c.cnpj) || normalizeDoc(c.cpf);
      if (doc) map.set(doc, c);
    });
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
    const valorVenda = getPedidoValorEfetivo(snap);
    const isRecompraPOD = snap.tipo_orcamento === 'recompra_pod';
    const isRecompra = snap.tipo_orcamento === 'recompra' || isRecompraPOD;
    const tipoProdutorLabel = isRecompraPOD ? 'Recompra POD' : (isRecompra ? 'Recompra' : 'Novo produtor');
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

      return matchesSearch && matchesConsultor && matchesData && matchesEntrega;
    });
  }, [pedidos, searchTerm, filtroConsultor, clientesById, clientesByNome, dataInicioFiltro, dataFimFiltro, entregaInicioFiltro, entregaFimFiltro]);

  const getValorFaturado = (pedido: any): number => {
    const snap = pedido.orcamento_snapshot;
    if (snap) return getPedidoValorEfetivo(snap);
    return Number(pedido.valor_total) || Number(pedido.formula_snapshot?.custo_total) || 0;
  };

  const getRazaoSocialOuNome = (pedido: any): string => {
    const snap = pedido.orcamento_snapshot;
    const dc = snap?.dados_cliente || {};
    if (dc.razao_social) return dc.razao_social;
    const clienteId = snap?.cliente_id || dc.cliente_id;
    if (clienteId && clientesById.has(clienteId)) {
      const c = clientesById.get(clienteId)!;
      if (c.razao_social) return c.razao_social;
    }
    const nome = (dc.nome_completo || snap?.nome_cliente || pedido.formula_snapshot?.cliente || '').trim();
    const lower = nome.toLowerCase();
    if (lower && clientesByNome.has(lower)) {
      const c = clientesByNome.get(lower)!;
      if (c.razao_social) return c.razao_social;
    }
    return nome || 'Cliente';
  };

  const getClienteVinculado = (pedido: any): Cliente | null => {
    const snap = pedido.orcamento_snapshot;
    const dc = snap?.dados_cliente || {};
    const clienteId = snap?.cliente_id || dc.cliente_id;
    if (clienteId && clientesById.has(clienteId)) return clientesById.get(clienteId)!;
    // Antes do nome: o documento e' o identificador estavel do produtor, e o
    // nome no snapshot costuma divergir do cadastro (grafia, razao x fantasia).
    const doc = normalizeDoc(dc.cnpj) || normalizeDoc(dc.cpf) || normalizeDoc(pedido.cnpj_contratante);
    if (doc && clientesByCnpj.has(doc)) return clientesByCnpj.get(doc)!;
    const nome = (dc.nome_completo || snap?.nome_cliente || pedido.formula_snapshot?.cliente || '').trim().toLowerCase();
    if (nome && clientesByNome.has(nome)) return clientesByNome.get(nome)!;
    return null;
  };

  /**
   * Agrupa os pedidos por produtor. A chave e' o CNPJ quando existe -- e' o que
   * o Pedido de Compra usa para numerar a sequencia -- caindo para o id do
   * cliente e, por ultimo, para o nome normalizado quando o cadastro ainda
   * nao tem CNPJ.
   */
  const gruposProdutores = useMemo<GrupoProdutor[]>(() => {
    const mapa = new Map<string, GrupoProdutor>();

    filteredPedidos.forEach((pedido: any) => {
      const cliente = getClienteVinculado(pedido);
      const dc = pedido.orcamento_snapshot?.dados_cliente || {};
      const cnpj = normalizeDoc(cliente?.cnpj || dc.cnpj);
      const razaoSocial = getRazaoSocialOuNome(pedido);
      const nomeCliente = (
        cliente?.nome ||
        dc.nome_completo ||
        pedido.orcamento_snapshot?.nome_cliente ||
        pedido.formula_snapshot?.cliente ||
        ''
      ).trim();

      const chave =
        cnpj ||
        cliente?.id ||
        (razaoSocial || nomeCliente).trim().toLowerCase() ||
        pedido.id;

      let grupo = mapa.get(chave);
      if (!grupo) {
        grupo = {
          chave,
          clienteId: cliente?.id,
          cnpj: cliente?.cnpj || dc.cnpj || '',
          razaoSocial,
          nomeCliente,
          telefone: cliente?.telefone || dc.telefone || '',
          pedidos: [],
        };
        mapa.set(chave, grupo);
      }
      // O cadastro do cliente e' mais confiavel que o snapshot antigo do pedido.
      if (!grupo.clienteId) grupo.clienteId = cliente?.id;
      if (!grupo.telefone) grupo.telefone = cliente?.telefone || dc.telefone || '';
      if (!grupo.nomeCliente) grupo.nomeCliente = nomeCliente;
      grupo.pedidos.push(pedido);
    });

    const emMs = (pedido: any): number => {
      const d = getDataPedidoOrdenacao(pedido);
      return d ? d.getTime() : 0;
    };

    /** A compra acontece quando e' paga; sem pagamento, vale a data do pedido. */
    const pagoEmMs = (pedido: any): number => {
      const raw = pedido.orcamento_snapshot?.data_pagamento;
      const d = raw ? new Date(raw) : null;
      return d && !Number.isNaN(d.getTime()) ? d.getTime() : emMs(pedido);
    };

    const grupos = Array.from(mapa.values());
    // Dentro do bloco: do primeiro pagamento para o mais recente. E' essa ordem
    // que numera os Pedidos de Compra (01, 02, 03...). Datas iguais desempatam
    // pelo sequencial do numero.
    grupos.forEach((g) =>
      g.pedidos.sort((a, b) => {
        const porPagamento = pagoEmMs(a) - pagoEmMs(b);
        return porPagamento !== 0
          ? porPagamento
          : compararPorSequencial(a.numero_pedido, b.numero_pedido);
      }),
    );
    // Entre blocos: quem comprou mais recentemente aparece primeiro.
    grupos.sort((a, b) => emMs(b.pedidos[b.pedidos.length - 1]) - emMs(a.pedidos[a.pedidos.length - 1]));
    return grupos;
  }, [filteredPedidos, clientesById, clientesByCnpj, clientesByNome]);

  /**
   * O numero de contrato e' do produtor. Procura no cadastro do cliente e, na
   * falta, em qualquer pedido dele que ja' carregue um -- assim o consultor nao
   * redigita o mesmo numero a cada recompra.
   */
  const contratoDoGrupo = (grupo: GrupoProdutor): string | undefined => {
    const doCadastro = grupo.clienteId
      ? (clientesById.get(grupo.clienteId) as any)?.numero_contrato
      : undefined;
    if (doCadastro) return String(doCadastro);
    for (const p of grupo.pedidos) {
      const direto = (p as any).numero_contrato;
      if (direto) return String(direto);
      const { numeroContrato } = parseNumeroPedido(p.numero_pedido);
      if (numeroContrato) return numeroContrato;
    }
    return undefined;
  };

  /**
   * Abre o gerador de orcamento ja' preenchido com o ultimo pedido do produtor.
   * O orcamento e' o passo anterior ao Pedido de Compra: o consultor ajusta
   * precos e quantidades, acrescenta produtos das precificacoes salvas ou do
   * catalogo, monta um setup novo se for o caso, e envia para o cliente
   * confirmar antes de virar pedido.
   */
  const abrirNovoPedidoCompra = (grupo: GrupoProdutor) => {
    const ultimo = grupo.pedidos[grupo.pedidos.length - 1];
    const snap = ultimo?.orcamento_snapshot || {};
    const clienteId =
      grupo.clienteId || snap.cliente_id || (snap.dados_cliente as any)?.cliente_id;
    setRascunhoRecompra({
      grupo,
      rascunho: {
      tipo_orcamento: 'recompra',
      nome_cliente: snap.nome_cliente || grupo.nomeCliente || grupo.razaoSocial,
      consultor_responsavel: snap.consultor_responsavel || '',
      validade_dias: 7,
      // Itens do pedido anterior entram como ponto de partida editavel.
      itens_producao: snap.itens_producao || [],
      // Setup nao se repete numa recompra: entra vazio e o consultor acrescenta
      // um novo pelo perfil "Produtor Experiente" se houver entregaveis a cobrar.
      servicos_marca: [],
      dados_cliente: snap.dados_cliente,
      detalhamento_frete: snap.detalhamento_frete,
      condicoes_pagamento: snap.condicoes_pagamento,
      // Sem cliente_id o passo 1 abre com "Nome do Cliente" em branco: o campo
      // e' preenchido pelo cliente selecionado, nao pelo nome solto.
      ...(clienteId ? { cliente_id: clienteId } : {}),
      } as Partial<Orcamento>,
    });
  };

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
            snap.tipo_orcamento === 'recompra_pod'
              ? 'border-purple-500 text-purple-700'
              : snap.tipo_orcamento === 'recompra'
                ? 'border-orange-500 text-orange-700'
                : 'border-blue-500 text-blue-700'
          }>
            {snap.tipo_orcamento === 'recompra_pod'
              ? 'Recompra POD'
              : snap.tipo_orcamento === 'recompra' ? 'Recompra' : 'Novo Produtor'}
          </Badge>
          {snap.tipo_orcamento === 'recompra_pod' && (
            <Badge variant="outline" className="border-green-500 text-green-700">Pago</Badge>
          )}
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
            <div key={idx} className="text-sm">
              <div className="flex justify-between items-center">
                <span className="truncate flex-1">
                  {item.nome_produto}
                  {item.modelo_negocio === 'print_on_demand' ? ` (POD) x${Number(item.pod_consumo_quantidade) || Number(item.quantidade) || 0}` : ` x${item.quantidade}`}
                </span>
                <span className="font-medium ml-2">{formatCurrency(getItemValorEfetivo(item))}</span>
              </div>
              {item.modelo_negocio === 'print_on_demand' && item.pod_consumo_inicio && item.pod_consumo_fim && (
                <div className="text-xs text-purple-700 ml-1">
                  Consumo: {item.pod_consumo_quantidade ?? 0} potes (
                  {format(new Date(item.pod_consumo_inicio), 'dd/MM/yy', { locale: ptBR })}
                  –{format(new Date(item.pod_consumo_fim), 'dd/MM/yy', { locale: ptBR })})
                </div>
              )}
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
          <span className="text-lg font-bold text-primary">{formatCurrency(getPedidoValorEfetivo(snap))}</span>
        </div>

        {snap.data_pagamento && (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <Calendar className="w-3 h-3" />
            Pgto: {format(new Date(snap.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        )}

        {snap.data_pagamento && snap.tipo_orcamento !== 'recompra_pod' && (
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

  const renderAcoesMenu = (pedido: any) => {
    const isOrcamento = !!pedido.orcamento_snapshot;
    const telefone = getTelefoneCliente(pedido);
    const { dataPrevista } = calcularPrazoEntrega(pedido);
    const nomeCliente = pedido.orcamento_snapshot?.dados_cliente?.nome_completo
      || pedido.orcamento_snapshot?.nome_cliente
      || pedido.formula_snapshot?.cliente
      || 'cliente';
    const waMsg = `Olá ${nomeCliente}, tudo bem? Sou da Lemon Caps, entrando em contato sobre o seu pedido ${pedido.numero_pedido}. Previsão de entrega: ${format(dataPrevista, 'dd/MM/yyyy', { locale: ptBR })}.`;
    const waUrl = buildWhatsappUrl(telefone, waMsg);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Mais ações" className="h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isOrcamento && (
            <DropdownMenuItem onClick={() => setFichaTecnicaPedido(pedido)}>
              <Printer className="h-4 w-4 mr-2" /> Ficha Técnica
            </DropdownMenuItem>
          )}
          {!isOrcamento && (
            <DropdownMenuItem onClick={() => gerarPDFOrdemProducao(pedido)}>
              <Download className="h-4 w-4 mr-2" /> Baixar Ordem
            </DropdownMenuItem>
          )}
          {isOrcamento && (
            <DropdownMenuItem onClick={() => gerarRelatorioPedidoPDF(pedido)}>
              <FileText className="h-4 w-4 mr-2" /> Relatório PDF
            </DropdownMenuItem>
          )}
          {isOrcamento && (
            <DropdownMenuItem onClick={() => gerarRelatorioPedidoExcel(pedido)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Relatório Excel
            </DropdownMenuItem>
          )}
          {isOrcamento && (
            <DropdownMenuItem onClick={() => copiarRelatorioWhatsApp(pedido)}>
              <Copy className="h-4 w-4 mr-2" /> Copiar Relatório WhatsApp
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={!waUrl}
            onClick={() => waUrl && window.open(waUrl, '_blank')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {waUrl ? 'Abrir WhatsApp' : 'WhatsApp (sem telefone)'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDocumentosDialogPedidoId(pedido.id)}>
            <FileText className="h-4 w-4 mr-2" /> Documentos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditingObs({ id: pedido.id, obs: pedido.observacoes || '' })}>
            <Pencil className="h-4 w-4 mr-2" /> Editar observações
          </DropdownMenuItem>
          {isOrcamento && (
            <DropdownMenuItem onClick={() => setRecompraPedido(pedido)}>
              <RefreshCw className="h-4 w-4 mr-2" /> Registrar recompra já paga (POD)
            </DropdownMenuItem>
          )}
          {isOrcamento && (
            <DropdownMenuItem onClick={() => setPedidoParaEditarPagto(pedido)}>
              <Wallet className="h-4 w-4 mr-2" /> Alterar pagamento
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setPedidoParaExcluir({ id: pedido.id, numero: pedido.numero_pedido })}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        <div className="text-center">Carregando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
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
                })}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gerarRelatorioPedidosGeralExcel(filteredPedidos, {
                  dataInicio: dataInicioFiltro,
                  dataFim: dataFimFiltro,
                  consultor: filtroConsultor !== 'todos' ? filtroConsultor : undefined,
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

      {gruposProdutores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {searchTerm ? 'Nenhum produtor encontrado' : 'Nenhum pedido gerado ainda'}
            </p>
            <p className="text-sm mt-2">
              {!searchTerm && 'Pedidos são criados automaticamente ao aprovar orçamentos'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Nivel 1: o produtor, identificado pelo CNPJ contratante. */}
          {gruposProdutores.map((grupo) => {
            const whatsappUrl = buildWhatsappUrl(
              grupo.telefone,
              `Olá, ${grupo.nomeCliente}! Aqui é da Lemoncaps.`,
            );
            const incompletos = grupo.pedidos.filter(
              (p: any) => !parseNumeroPedido(p.numero_pedido).completo,
            ).length;
            return (
              <Card key={grupo.chave}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-base leading-tight">{grupo.razaoSocial}</p>
                      {grupo.nomeCliente && grupo.nomeCliente !== grupo.razaoSocial && (
                        <p className="text-sm text-muted-foreground">{grupo.nomeCliente}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {grupo.cnpj ? `CNPJ ${grupo.cnpj}` : 'Sem CNPJ cadastrado'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {whatsappUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            {formatTelefone(grupo.telefone)}
                          </a>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled title="Sem WhatsApp cadastrado">
                          <MessageCircle className="h-4 w-4 mr-1" /> Sem contato
                        </Button>
                      )}
                      <Button size="sm" onClick={() => abrirNovoPedidoCompra(grupo)}>
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Novo pedido de compra
                      </Button>
                    </div>
                  </div>

                  {incompletos > 0 && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {incompletos === 1
                        ? '1 pedido sem número de contrato'
                        : `${incompletos} pedidos sem número de contrato`}
                    </p>
                  )}

                  {/* Nivel 2: os pedidos do produtor, na ordem do sequencial. */}
                  <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pedidos de compra ({grupo.pedidos.length})
                  </p>
                  <div className="space-y-2">
                    {grupo.pedidos.map((pedido: any, indice: number) => {
                      const { numeroContrato, completo } = parseNumeroPedido(pedido.numero_pedido);
                      // Sequencial do Pedido de Compra dentro do produtor: a lista
                      // ja' vem ordenada por data de pagamento, entao e' a posicao.
                      const numeroCompra = String(indice + 1).padStart(2, '0');
                      const dataPgto = pedido.orcamento_snapshot?.data_pagamento;
                      const dataPedido = getDataPedidoOrdenacao(pedido);
                      const statusAprovacao = pedido.status_aprovacao as StatusAprovacao | null;
                      return (
                        <Collapsible key={pedido.id} className="rounded-md border">
                          <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="h-5 px-1.5 text-[10px]">
                                  Pedido de Compra {numeroCompra}
                                </Badge>
                                <span className="text-sm font-medium">{pedido.numero_pedido}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {dataPedido
                                  ? `Pedido em ${format(dataPedido, 'dd/MM/yyyy', { locale: ptBR })}`
                                  : 'Sem data de pedido'}
                                {' • '}
                                {dataPgto
                                  ? `pago em ${format(new Date(dataPgto), 'dd/MM/yyyy', { locale: ptBR })}`
                                  : 'sem pagamento'}
                                {' • '}
                                <span className="font-semibold text-foreground">
                                  {formatCurrency(getValorFaturado(pedido))}
                                </span>
                              </p>
                              {completo ? (
                                <p className="text-xs text-muted-foreground">
                                  Contrato nº {numeroContrato}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-700 dark:text-amber-500 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {MSG_PEDIDO_INCOMPLETO}
                                </p>
                              )}
                              {statusAprovacao && (
                                <Badge
                                  variant="outline"
                                  className={cn('mt-1 h-5 px-1.5 text-[10px]', STATUS_APROVACAO_CLASSE[statusAprovacao])}
                                >
                                  {STATUS_APROVACAO_LABEL[statusAprovacao]}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setOrcamentoPdf(snapshotComoOrcamento(pedido))}
                                title="Orçamento do cliente, no mesmo formato de Orçamentos Gerados"
                              >
                                <FileText className="h-4 w-4 mr-1" /> Orçamento
                              </Button>
                              {/* Sempre disponivel: e' por aqui que se baixa o PDF de novo. */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPedidoCompraAlvo({ tipo: 'pedido', pedido, grupo })}
                                title={
                                  completo
                                    ? 'Rever ou baixar o Pedido de Compra'
                                    : 'Preencher o Pedido de Compra'
                                }
                              >
                                <FileSignature className="h-4 w-4 mr-1" /> Pedido de Compra
                              </Button>
                              {renderAcoesMenu(pedido)}
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Info className="h-4 w-4 mr-1" /> Detalhamento
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          {/* Nivel 3: o detalhamento do pedido. */}
                          <CollapsibleContent className="border-t px-3 py-3">
                            {renderOrcamentoPedido(pedido) || (
                              <p className="text-sm text-muted-foreground">
                                Este pedido não tem orçamento vinculado.
                              </p>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DetalhesPedidoDialog
        pedido={pedidoDetalhe}
        open={!!pedidoDetalhe}
        onOpenChange={(open) => !open && setPedidoDetalhe(null)}
        statusBadge={(() => {
          if (!pedidoDetalhe) return undefined;
          const derived = getStatusFromAcompanhamento(pedidoDetalhe.acompanhamento_processos);
          const cfg = getStatusConfig(derived || pedidoDetalhe.status);
          return { label: cfg.label, className: cfg.color };
        })()}
        prazoBadge={(() => {
          if (!pedidoDetalhe) return undefined;
          const derived = getStatusFromAcompanhamento(pedidoDetalhe.acompanhamento_processos);
          const isConcluido = (derived || pedidoDetalhe.status) === 'concluido';
          const { dataPrevista, diasRestantes } = calcularPrazoEntrega(pedidoDetalhe);
          let className = 'bg-green-100 text-green-800 border-green-300';
          let label = `${diasRestantes} dias restantes`;
          if (isConcluido) {
            className = 'bg-gray-100 text-gray-700 border-gray-300';
            label = 'Entregue';
          } else if (diasRestantes < 0) {
            className = 'bg-red-100 text-red-800 border-red-300';
            label = `Atrasado ${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'}`;
          } else if (diasRestantes === 0) {
            className = 'bg-red-100 text-red-800 border-red-300';
            label = 'Entrega hoje';
          } else if (diasRestantes <= 10) {
            className = 'bg-yellow-100 text-yellow-800 border-yellow-300';
            label = `${diasRestantes} ${diasRestantes === 1 ? 'dia restante' : 'dias restantes'}`;
          }
          return { label, className, dataPrevista };
        })()}
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

      {orcamentoPdf && (
        <PreviewPdfDialog orcamento={orcamentoPdf} onClose={() => setOrcamentoPdf(null)} />
      )}

      {pedidoCompraAlvo && (
        <PedidoDeCompraDialog
          open
          onOpenChange={(o) => !o && setPedidoCompraAlvo(null)}
          snapshot={
            pedidoCompraAlvo.tipo === 'pedido'
              ? pedidoCompraAlvo.pedido.orcamento_snapshot || {}
              : orcamentoComoSnapshot(pedidoCompraAlvo.orcamento)
          }
          cliente={
            pedidoCompraAlvo.tipo === 'pedido'
              ? getClienteVinculado(pedidoCompraAlvo.pedido)
              : clientesById.get((pedidoCompraAlvo.orcamento as any).cliente_id) ?? null
          }
          // Um pedido que ja' existe nao conta a si mesmo; um orcamento novo entra
          // depois de todos os que o produtor ja' tem.
          pedidosDoCnpj={
            pedidoCompraAlvo.tipo === 'pedido'
              ? Math.max(0, pedidoCompraAlvo.grupo.pedidos.length - 1)
              : pedidoCompraAlvo.grupo.pedidos.length
          }
          onGerar={async ({ numeroContrato, numeroPedido, dados }) => {
            const cnpjContratante = (pedidoCompraAlvo.grupo.cnpj || '').replace(/\D/g, '');
            // Vindo de um orcamento novo, o pedido ainda precisa ser criado.
            const pedidoId =
              pedidoCompraAlvo.tipo === 'pedido'
                ? pedidoCompraAlvo.pedido.id
                : (await createPedidoFromOrcamento(pedidoCompraAlvo.orcamento as any))?.id;
            if (!pedidoId) return;
            await vincularPedidoCompra({
              id: pedidoId,
              numeroContrato,
              numeroPedido,
              cnpjContratante,
              dados,
            });
            // Guarda o contrato no cliente para os proximos pedidos herdarem.
            const clienteId = pedidoCompraAlvo.grupo.clienteId;
            if (clienteId && contratoDoGrupo(pedidoCompraAlvo.grupo) !== numeroContrato) {
              try {
                await atualizarCliente.mutateAsync({ id: clienteId, numero_contrato: numeroContrato } as any);
              } catch {
                // Nao impede o pedido: o contrato ja' foi gravado nele.
              }
            }
          }}
          numeroContratoSugerido={contratoDoGrupo(pedidoCompraAlvo.grupo)}
          onEditarOrcamento={
            pedidoCompraAlvo.tipo === 'orcamento'
              ? () => {
                  const alvo = pedidoCompraAlvo;
                  setPedidoCompraAlvo(null);
                  setEditandoOrcamento({ orcamento: alvo.orcamento, grupo: alvo.grupo });
                }
              : undefined
          }
        />
      )}

      {editandoOrcamento && (
        <GerarOrcamentoDialog
          orcamentoExistente={editandoOrcamento.orcamento}
          onClose={() => setEditandoOrcamento(null)}
          onSuccess={(orcamentoSalvo) => {
            const { orcamento, grupo } = editandoOrcamento;
            setEditandoOrcamento(null);
            // Reabre com a versao salva, senao o documento mostraria os produtos antigos.
            setPedidoCompraAlvo({ tipo: 'orcamento', orcamento: orcamentoSalvo ?? orcamento, grupo });
          }}
        />
      )}

      {rascunhoRecompra && (
        <GerarOrcamentoDialog
          rascunhoInicial={rascunhoRecompra.rascunho}
          onClose={() => setRascunhoRecompra(null)}
          onSuccess={(orcamentoCriado) => {
            const grupo = rascunhoRecompra.grupo;
            setRascunhoRecompra(null);
            if (!orcamentoCriado) return;
            toast.success('Orçamento de recompra criado. Agora monte o Pedido de Compra.');
            // Emenda direto: o Pedido de Compra nasce do orcamento recem-gerado.
            setPedidoCompraAlvo({ tipo: 'orcamento', orcamento: orcamentoCriado, grupo });
          }}
        />
      )}

      <AdicionarRecompraDialog
        pedido={recompraPedido}
        open={!!recompraPedido}
        onOpenChange={(o) => !o && setRecompraPedido(null)}
        consultoresDisponiveis={consultoresUnicos}
      />

      {/* Hidden file inputs */}
      <input type="file" ref={contratoInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      <input type="file" ref={comprovanteInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png" />

      {/* Dialog central de Documentos do Pedido */}
      {(() => {
        const pedidoAtual = documentosDialogPedidoId
          ? pedidos.find((p: any) => p.id === documentosDialogPedidoId)
          : null;
        return (
          <DocumentosPedidoDialog
            open={!!documentosDialogPedidoId}
            onOpenChange={(o) => !o && setDocumentosDialogPedidoId(null)}
            pedidoNumero={pedidoAtual?.numero_pedido}
            pedidoId={documentosDialogPedidoId || undefined}
            pedido={pedidoAtual ?? null}
            contratos={documentosDialogPedidoId ? getAnexosPorPedido(documentosDialogPedidoId, 'contrato') : []}
            comprovantes={documentosDialogPedidoId ? getAnexosPorPedido(documentosDialogPedidoId, 'comprovante') : []}
            onAdicionar={(tipo) => documentosDialogPedidoId && triggerUpload(documentosDialogPedidoId, tipo)}
            onRemover={(anexo) => deleteAnexo(anexo)}
            onReordenar={(pid, tipo, ids) => reordenarAnexos(pid, tipo, ids)}
          />
        );
      })()}

      {/* Confirmação de exclusão de pedido (controlado) */}
      <ConfirmarExclusaoPedidoDialog
        open={!!pedidoParaExcluir}
        onOpenChange={(o) => { if (!o && !deletandoPedido) setPedidoParaExcluir(null); }}
        numeroPedido={pedidoParaExcluir?.numero ?? ''}
        loading={deletandoPedido}
        onConfirm={async () => {
          if (!pedidoParaExcluir) return;
          try {
            await deletePedidoAsync(pedidoParaExcluir.id);
            setPedidoParaExcluir(null);
          } catch {
            // Mantém o dialog aberto para o usuário ver o erro e tentar de novo
            return;
          }
        }}
      />

      {/* Alterar Pagamento (controlado) */}
      <AlterarPagamentoDialog
        open={!!pedidoParaEditarPagto}
        onOpenChange={(o) => !o && setPedidoParaEditarPagto(null)}
        numeroPedido={pedidoParaEditarPagto?.numero_pedido}
        valorTotal={Number(pedidoParaEditarPagto?.orcamento_snapshot?.valor_total) || 0}
        dataPagamentoAtual={pedidoParaEditarPagto?.orcamento_snapshot?.data_pagamento}
        condicoesAtuais={pedidoParaEditarPagto?.orcamento_snapshot?.condicoes_pagamento}
        onConfirm={async ({ data_pagamento, condicoes_pagamento }) => {
          if (!pedidoParaEditarPagto) return;
          await alterarPagamento({
            id: pedidoParaEditarPagto.id,
            data_pagamento,
            condicoes_pagamento,
          });
          setPedidoParaEditarPagto(null);
        }}
      />


    </div>
  );
};

export default Pedidos;
