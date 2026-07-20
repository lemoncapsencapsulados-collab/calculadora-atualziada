import { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, Package, Check, ChevronsUpDown, Search, ImageDown, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useFreteCotacoes, useCreateFreteCotacao, useUpdateFreteCotacao, useDeleteFreteCotacao, fetchFreteCotacaoByOrcamento } from '@/hooks/useFreteCotacoes';
import { useFretePodPrecos, fetchPodPrecoAtivo } from '@/hooks/useFretePodPrecos';
import { useFreteMargemFaixas } from '@/hooks/useFreteMargemFaixas';
import { AdminPasswordDialog } from '@/components/admin/AdminPasswordDialog';
import { exportElementAsPng } from '@/lib/freteImageExport';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useConsultoresDisponiveis } from '@/hooks/useOrcamentosPaginados';
import { FRETE_TIPOS_PRODUTO, FRETE_POD_PLANOS_SUGERIDOS as FRETE_POD_PLANOS, FreteCotacao, FreteCotacaoInsert, FreteStatus, FreteTipoProduto } from '@/types/frete';
import type { PodPlanoSelecionado } from '@/types/frete';
import { formatBRL, calcularPrecoPod, resolverMargemPorEnvios, descreverFaixa, IMPOSTO_POD_PADRAO } from '@/lib/freteHelpers';
import { toast } from 'sonner';

export default function Logistica() {
  const { data: cotacoes = [], isLoading } = useFreteCotacoes();
  const { orcamentos } = useOrcamentos();
  const createMut = useCreateFreteCotacao();
  const updateMut = useUpdateFreteCotacao();
  const deleteMut = useDeleteFreteCotacao();

  const [tab, setTab] = useState<'estoque_proprio' | 'pod'>('estoque_proprio');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FreteCotacao | null>(null);
  const [deletando, setDeletando] = useState<FreteCotacao | null>(null);
  const [confirmSubstituicao, setConfirmSubstituicao] = useState<{ payload: FreteCotacaoInsert } | null>(null);
  const [confirmEdicaoConfirmada, setConfirmEdicaoConfirmada] = useState<FreteCotacao | null>(null);

  const cotacoesFiltradas = useMemo(() => cotacoes.filter(c => c.tipo === tab), [cotacoes, tab]);

  const orcamentoLabel = (id: string | null) => {
    const o = orcamentos.find(x => x.id === id);
    return o ? `${o.numero_orcamento} — ${o.nome_cliente}` : '—';
  };

  const handleAbrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEditar = (c: FreteCotacao) => {
    if (c.tipo === 'estoque_proprio' && c.status === 'confirmado') {
      setConfirmEdicaoConfirmada(c);
      return;
    }
    setEditing(c);
    setDialogOpen(true);
  };

  const proceedEdicao = () => {
    if (confirmEdicaoConfirmada) {
      setEditing(confirmEdicaoConfirmada);
      setDialogOpen(true);
      setConfirmEdicaoConfirmada(null);
    }
  };

  const handleSalvar = async (payloads: FreteCotacaoInsert[]) => {
    if (payloads.length === 0) return;
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, updates: payloads[0] as any });
      setDialogOpen(false);
      setEditing(null);
      return;
    }
    const existente = await fetchFreteCotacaoByOrcamento(payloads[0].orcamento_id);
    if (existente) {
      setConfirmSubstituicao({ payload: payloads as any });
      return;
    }
    for (const p of payloads) {
      await createMut.mutateAsync({ cotacao: p });
    }
    setDialogOpen(false);
  };

  const confirmarSubstituicao = async () => {
    if (!confirmSubstituicao) return;
    const list = confirmSubstituicao.payload as unknown as FreteCotacaoInsert[];
    for (let i = 0; i < list.length; i++) {
      await createMut.mutateAsync({ cotacao: list[i], substituir: i === 0 });
    }
    setConfirmSubstituicao(null);
    setDialogOpen(false);
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                Logística
              </CardTitle>
              <CardDescription>Cotações de frete por orçamento — Estoque Próprio ou Print on Demand</CardDescription>
            </div>
            <Button onClick={handleAbrirNovo}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Cotação
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-3 sm:p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="estoque_proprio">
                <Package className="w-4 h-4 mr-2" />
                Estoque Próprio
              </TabsTrigger>
              <TabsTrigger value="pod">
                <Truck className="w-4 h-4 mr-2" />
                Print on Demand
              </TabsTrigger>
            </TabsList>

            <TabsContent value="estoque_proprio" className="mt-4">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : cotacoesFiltradas.length === 0 ? (
                <div className="py-12 text-center border rounded-lg bg-muted/30 text-muted-foreground">
                  Nenhuma cotação de Estoque Próprio registrada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produtor</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Frete Médio</TableHead>
                        <TableHead>Orçamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cotacoesFiltradas.map(c => (
                        <TableRow key={c.id}>
                          <TableCell>{c.nome_produtor || '—'}</TableCell>
                          <TableCell>{c.nome_produto || '—'}</TableCell>
                          <TableCell>{c.tipo_produto || '—'}</TableCell>
                          <TableCell className="text-right">{c.quantidade_unidades ?? '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatBRL(c.valor_frete)}</TableCell>
                          <TableCell className="text-xs">{orcamentoLabel(c.orcamento_id)}</TableCell>
                          <TableCell>
                            {c.status === 'confirmado' ? (
                              <Badge className="bg-green-500 hover:bg-green-500">Confirmado</Badge>
                            ) : (
                              <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditar(c)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeletando(c)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pod" className="mt-4">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : cotacoesFiltradas.length === 0 ? (
                <div className="py-12 text-center border rounded-lg bg-muted/30 text-muted-foreground">
                  Nenhuma cotação POD registrada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orçamento</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Plano</TableHead>
                        <TableHead className="text-right">Preço/envio</TableHead>
                        <TableHead className="text-right">Qtd Envios</TableHead>
                        <TableHead className="text-right">Total Estimado</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cotacoesFiltradas.map(c => {
                        const selecionados = Array.isArray(c.pod_planos_selecionados) ? c.pod_planos_selecionados : [];
                        const total = (Number(c.pod_preco_por_envio) || 0) * (Number(c.pod_quantidade_envios_estimada) || 0);
                        const planoLabel = selecionados.length > 1
                          ? `${selecionados.length} planos: ${selecionados.map(s => s.plano).join(', ')}`
                          : (c.pod_plano ?? '—');
                        const precoLabel = selecionados.length > 1
                          ? `a partir de ${formatBRL(Math.min(...selecionados.map(s => Number(s.preco_final))))}`
                          : formatBRL(c.pod_preco_por_envio);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs">{orcamentoLabel(c.orcamento_id)}</TableCell>
                            <TableCell>{c.tipo_produto || '—'}</TableCell>
                            <TableCell className="text-right text-xs">{planoLabel}</TableCell>
                            <TableCell className={`text-right font-medium ${c.pod_preco_editado_manualmente ? 'text-amber-600' : ''}`}>
                              {precoLabel}
                              {c.pod_preco_editado_manualmente && <span className="ml-1 text-[10px] uppercase">manual</span>}
                            </TableCell>
                            <TableCell className="text-right">{c.pod_quantidade_envios_estimada ?? '—'}</TableCell>
                            <TableCell className="text-right">{total > 0 ? formatBRL(total) : '—'}</TableCell>
                            <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handleEditar(c)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeletando(c)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {dialogOpen && (
        <FreteCotacaoDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={handleSalvar}
          editing={editing}
          tipoInicial={tab}
          orcamentos={orcamentos}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

      <AlertDialog open={!!deletando} onOpenChange={(o) => !o && setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deletando) { await deleteMut.mutateAsync(deletando.id); setDeletando(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmSubstituicao} onOpenChange={(o) => !o && setConfirmSubstituicao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir cotação existente?</AlertDialogTitle>
            <AlertDialogDescription>
              Este orçamento já possui uma cotação de frete ativa. Ao confirmar, a cotação anterior será arquivada e a nova ficará ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarSubstituicao}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmEdicaoConfirmada} onOpenChange={(o) => !o && setConfirmEdicaoConfirmada(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar cotação confirmada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta cotação já foi confirmada. Editar pode causar divergência com o pedido. Deseja prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={proceedEdicao}>Prosseguir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ Dialog ============

interface DialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (payloads: FreteCotacaoInsert[]) => Promise<void> | void;
  editing: FreteCotacao | null;
  tipoInicial: 'estoque_proprio' | 'pod';
  orcamentos: any[];
  saving: boolean;
}

function FreteCotacaoDialog({ open, onClose, onSave, editing, tipoInicial, orcamentos, saving }: DialogProps) {
  const [tipo, setTipo] = useState<'estoque_proprio' | 'pod'>(editing?.tipo || tipoInicial);
  const [orcamentoId, setOrcamentoId] = useState(editing?.orcamento_id || '');
  const [tipoProduto, setTipoProduto] = useState<string>(editing?.tipo_produto || '');
  // EP
  const [nomeProdutor, setNomeProdutor] = useState(editing?.nome_produtor || '');
  const [nomeProduto, setNomeProduto] = useState(editing?.nome_produto || '');
  const [quantidade, setQuantidade] = useState(String(editing?.quantidade_unidades ?? ''));
  const [valorFrete, setValorFrete] = useState(String(editing?.valor_frete ?? ''));
  const [status, setStatus] = useState<FreteStatus>(editing?.status || 'pendente');
  const [observacoesInternas, setObservacoesInternas] = useState(editing?.observacoes_internas || '');
  // POD
  const [plano, setPlano] = useState<string>(editing?.pod_plano ? String(editing.pod_plano) : '');
  const [precoEnvio, setPrecoEnvio] = useState(String(editing?.pod_preco_por_envio ?? ''));
  const [precoEditado, setPrecoEditado] = useState<boolean>(!!editing?.pod_preco_editado_manualmente);
  const [qtdEnvios, setQtdEnvios] = useState(String(editing?.pod_quantidade_envios_estimada ?? ''));
  const [observacoes, setObservacoes] = useState(editing?.observacoes || '');
  const [precoTabelado, setPrecoTabelado] = useState<number | null>(null);
  const [avisoSemPreco, setAvisoSemPreco] = useState('');

  // POD multi-item state (uma linha por produto do orçamento)
  const consultores = useConsultoresDisponiveis();
  const [consultorFiltro, setConsultorFiltro] = useState<string>('');
  const [buscaOrc, setBuscaOrc] = useState('');
  const [orcOpen, setOrcOpen] = useState(false);
  const [podItens, setPodItens] = useState<PodItemDraft[]>([]);
  const { data: todosPodPrecos = [] } = useFretePodPrecos();
  const { data: faixasMargem = [] } = useFreteMargemFaixas();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [passwordItemIdx, setPasswordItemIdx] = useState<number | null>(null);

  const orcamentoSelecionado = useMemo(
    () => orcamentos.find(o => o.id === orcamentoId) || null,
    [orcamentos, orcamentoId]
  );

  const orcamentosFiltrados = useMemo(() => {
    let list = orcamentos;
    if (consultorFiltro) list = list.filter((o: any) => o.consultor_responsavel === consultorFiltro);
    if (buscaOrc.trim()) {
      const q = buscaOrc.trim().toLowerCase();
      list = list.filter((o: any) =>
        (o.numero_orcamento || '').toLowerCase().includes(q) ||
        (o.nome_cliente || '').toLowerCase().includes(q) ||
        (o.consultor_responsavel || '').toLowerCase().includes(q)
      );
    }
    return list.slice(0, 100);
  }, [orcamentos, consultorFiltro, buscaOrc]);

  // Mapeia tipo_produto do item para valores válidos de FRETE_TIPOS_PRODUTO
  const mapTipoProduto = (raw?: string): string => {
    if (!raw) return '';
    const s = raw.toLowerCase();
    if (s.includes('encaps')) return 'Encapsulado';
    if (s.includes('líquid') || s.includes('liquid')) return 'Líquido';
    if (s.includes('gummy') || s.includes('gomas') || s.includes('goma')) return 'Gummy';
    if (s.includes('solúv') || s.includes('soluv') || s.includes('sachê') || s.includes('sache')) return 'Solúvel';
    return '';
  };

  // Ao mudar orçamento no modo POD, pré-carrega uma linha por item de produção
  useEffect(() => {
    if (editing || tipo !== 'pod' || !orcamentoSelecionado) {
      setPodItens([]);
      return;
    }
    const itens = (orcamentoSelecionado.itens_producao || []) as any[];
    setPodItens(itens.map((it: any) => ({
      nome_produto: it.nome_produto || 'Produto',
      tipo_produto: mapTipoProduto(it.tipo_produto),
      planos_selecionados: [],
      qtd_envios: '',
      observacoes: '',
      margem_pct: null,
      margem_override: false,
    })));
  }, [orcamentoSelecionado, tipo, editing]);

  const atualizarItem = async (idx: number, patch: Partial<PodItemDraft>) => {
    setPodItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const margemEfetivaItem = (it: PodItemDraft): { pct: number; faixaLabel: string; override: boolean } => {
    if (it.margem_override && it.margem_pct != null) {
      return { pct: Number(it.margem_pct), faixaLabel: 'edição manual', override: true };
    }
    const envios = it.qtd_envios ? Number(it.qtd_envios) : 0;
    const faixa = resolverMargemPorEnvios(envios, faixasMargem);
    return {
      pct: faixa ? Number(faixa.margem_percentual) : 0,
      faixaLabel: descreverFaixa(faixa),
      override: false,
    };
  };

  /** Planos disponíveis (com preço) para um tipo de produto, ordenados. */
  const planosDoTipo = (tp: string) =>
    todosPodPrecos.filter(p => p.tipo_produto === tp).sort((a, b) => a.plano - b.plano);

  const carregarPrecoTabelado = async (tp: string, pl: string) => {
    if (!tp || !pl) { setPrecoTabelado(null); return; }
    const p = await fetchPodPrecoAtivo(tp, Number(pl));
    setPrecoTabelado(p);
    if (p == null) {
      setAvisoSemPreco(`Preço não cadastrado para ${tp} / Plano ${pl}. Peça ao administrador para cadastrar em Painel Administrador → Preços POD.`);
    } else {
      setAvisoSemPreco('');
      if (!editing && !precoEditado) {
        setPrecoEnvio(String(p));
      }
    }
  };

  const totalEstimado = (Number(precoEnvio) || 0) * (Number(qtdEnvios) || 0);

  const handleSubmit = async () => {
    if (!orcamentoId) { toast.error('Selecione um orçamento'); return; }
    if (tipo === 'estoque_proprio') {
      if (!nomeProdutor || !nomeProduto || !tipoProduto || !quantidade || !valorFrete) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
      const payload: FreteCotacaoInsert = {
        tipo: 'estoque_proprio',
        orcamento_id: orcamentoId,
        nome_produtor: nomeProdutor,
        nome_produto: nomeProduto,
        tipo_produto: tipoProduto,
        quantidade_unidades: Number(quantidade),
        valor_frete: Number(valorFrete),
        status,
        observacoes_internas: observacoesInternas || null,
      };
      await onSave([payload]);
    } else {
      // Editando: envia uma única cotação POD com os campos legados
      if (editing) {
        if (!tipoProduto || !plano || !precoEnvio) {
          toast.error('Preencha tipo, plano e preço');
          return;
        }
        const editadoManual = precoTabelado != null && Number(precoEnvio) !== Number(precoTabelado);
        const payload: FreteCotacaoInsert = {
          tipo: 'pod',
          orcamento_id: orcamentoId,
          tipo_produto: tipoProduto,
          pod_plano: Number(plano),
          pod_preco_por_envio: Number(precoEnvio),
          pod_preco_editado_manualmente: precoEditado || editadoManual,
          pod_quantidade_envios_estimada: qtdEnvios ? Number(qtdEnvios) : null,
          observacoes: observacoes || null,
        };
        await onSave([payload]);
        return;
      }
      // Criação: uma cotação por item de produção
      const validos = podItens.filter(it => it.tipo_produto && it.planos_selecionados.length > 0);
      if (validos.length === 0) {
        toast.error('Selecione ao menos um plano em cada produto que deseja cotar');
        return;
      }
      const payloads: FreteCotacaoInsert[] = validos.map(it => {
        const { pct: margemPct, override } = margemEfetivaItem(it);
        const planosRows = planosDoTipo(it.tipo_produto).filter(p => it.planos_selecionados.includes(p.plano));
        const ordenados = planosRows.sort((a, b) => a.plano - b.plano);
        const selecionados: PodPlanoSelecionado[] = ordenados.map(p => {
          const frete = Number(p.preco || 0);
          const manuseio = Number(p.taxa_manuseio || 0);
          const { precoFinal } = calcularPrecoPod({ frete, manuseio, margemPct, impostoPct: IMPOSTO_POD_PADRAO });
          return {
            plano: p.plano,
            preco: frete,
            taxa_manuseio: manuseio,
            margem_percentual: margemPct,
            imposto_percentual: IMPOSTO_POD_PADRAO,
            preco_final: precoFinal,
            margem_override: override,
          };
        });
        const principal = selecionados[0];
        return {
          tipo: 'pod',
          orcamento_id: orcamentoId,
          tipo_produto: it.tipo_produto,
          nome_produto: it.nome_produto,
          pod_plano: principal.plano,
          pod_preco_por_envio: principal.preco_final,
          pod_preco_editado_manualmente: false,
          pod_quantidade_envios_estimada: it.qtd_envios ? Number(it.qtd_envios) : null,
          observacoes: it.observacoes || null,
          margem_percentual: margemPct,
          margem_override: override,
          imposto_percentual: IMPOSTO_POD_PADRAO,
          pod_planos_selecionados: selecionados,
        };
      });
      await onSave(payloads);
    }
  };

  const baixarImagem = async () => {
    if (!exportRef.current) return;
    const nome = orcamentoSelecionado?.nome_cliente || 'produtor';
    const num = orcamentoSelecionado?.numero_orcamento || '';
    const slug = `${num}_${nome}`.replace(/[^\w-]+/g, '_');
    try {
      await exportElementAsPng(exportRef.current, `precos_pod_${slug}.png`);
      toast.success('Imagem gerada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar imagem');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Cotação' : 'Nova Cotação de Frete'}</DialogTitle>
          <DialogDescription>Vincule a cotação a um orçamento existente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div>
              <Label>Modelo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estoque_proprio">Estoque Próprio</SelectItem>
                  <SelectItem value="pod">Print on Demand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === 'pod' && !editing ? (
            <div className="space-y-2">
              <Label>Orçamento vinculado *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2">
                <Select value={consultorFiltro || '__all__'} onValueChange={(v) => setConsultorFiltro(v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos consultores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos consultores</SelectItem>
                    {consultores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover open={orcOpen} onOpenChange={setOrcOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn('justify-between font-normal', !orcamentoId && 'text-muted-foreground')}>
                      {orcamentoSelecionado
                        ? `${orcamentoSelecionado.numero_orcamento} — ${orcamentoSelecionado.nome_cliente}`
                        : 'Buscar orçamento...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Buscar por nº, cliente ou consultor..." value={buscaOrc} onValueChange={setBuscaOrc} />
                      <CommandList>
                        <CommandEmpty>Nenhum orçamento encontrado.</CommandEmpty>
                        <CommandGroup>
                          {orcamentosFiltrados.map((o: any) => (
                            <CommandItem
                              key={o.id}
                              value={o.id}
                              onSelect={() => { setOrcamentoId(o.id); setOrcOpen(false); }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', orcamentoId === o.id ? 'opacity-100' : 'opacity-0')} />
                              <div className="flex flex-col">
                                <span className="text-sm">{o.numero_orcamento} — {o.nome_cliente}</span>
                                {o.consultor_responsavel && (
                                  <span className="text-xs text-muted-foreground">Consultor: {o.consultor_responsavel}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          ) : (
            <div>
              <Label>Orçamento vinculado *</Label>
              <Select value={orcamentoId} onValueChange={setOrcamentoId} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Selecione um orçamento" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {orcamentos.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.numero_orcamento} — {o.nome_cliente}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(tipo === 'estoque_proprio' || editing) && (
            <div>
              <Label>Tipo de Produto *</Label>
              <Select value={tipoProduto} onValueChange={(v) => { setTipoProduto(v); if (tipo === 'pod') carregarPrecoTabelado(v, plano); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {FRETE_TIPOS_PRODUTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === 'estoque_proprio' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome do Produtor *</Label>
                  <Input value={nomeProdutor} onChange={(e) => setNomeProdutor(e.target.value)} />
                </div>
                <div>
                  <Label>Nome do Produto / Segmento *</Label>
                  <Input value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} />
                </div>
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
                </div>
                <div>
                  <Label>Valor do Frete Médio (R$) *</Label>
                  <Input type="number" step="0.01" min="0" value={valorFrete} onChange={(e) => setValorFrete(e.target.value)} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as FreteStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente de confirmação</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações internas</Label>
                <Textarea rows={3} value={observacoesInternas} onChange={(e) => setObservacoesInternas(e.target.value)} />
              </div>
            </>
          )}

          {tipo === 'pod' && editing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plano (nº de frascos) *</Label>
                  <Select value={plano} onValueChange={(v) => { setPlano(v); carregarPrecoTabelado(tipoProduto, v); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {FRETE_POD_PLANOS.map(p => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preço por envio (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precoEnvio}
                    onChange={(e) => { setPrecoEnvio(e.target.value); setPrecoEditado(true); }}
                    className={precoTabelado != null && Number(precoEnvio) !== Number(precoTabelado) ? 'border-amber-500' : ''}
                  />
                  {precoTabelado != null && (
                    <p className="text-xs text-muted-foreground mt-1">Tabelado: {formatBRL(precoTabelado)}</p>
                  )}
                </div>
                <div>
                  <Label>Quantidade estimada de envios</Label>
                  <Input type="number" min="0" value={qtdEnvios} onChange={(e) => setQtdEnvios(e.target.value)} />
                  {totalEstimado > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Total estimado: {formatBRL(totalEstimado)}</p>
                  )}
                </div>
              </div>
              {avisoSemPreco && (
                <div className="text-xs text-amber-600 border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                  {avisoSemPreco}
                </div>
              )}
              <div>
                <Label>Observações</Label>
                <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
            </>
          )}

          {tipo === 'pod' && !editing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Produtos do orçamento</Label>
                {orcamentoSelecionado && (
                  <span className="text-xs text-muted-foreground">{podItens.length} item(ns)</span>
                )}
              </div>
              {!orcamentoSelecionado ? (
                <div className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
                  Selecione um orçamento acima para carregar os produtos automaticamente.
                </div>
              ) : podItens.length === 0 ? (
                <div className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
                  Este orçamento não possui itens de produção.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={baixarImagem} disabled={podItens.length === 0}>
                      <ImageDown className="w-4 h-4 mr-2" />Baixar imagem (PNG)
                    </Button>
                  </div>
                  {podItens.map((it, idx) => {
                    const planos = planosDoTipo(it.tipo_produto);
                    const margem = margemEfetivaItem(it);
                    return (
                      <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-sm">{it.nome_produto}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <Label className="text-xs">Tipo:</Label>
                            <Select
                              value={it.tipo_produto}
                              onValueChange={(v) => atualizarItem(idx, { tipo_produto: v, planos_selecionados: [] })}
                            >
                              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {FRETE_TIPOS_PRODUTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {it.tipo_produto && planos.length > 0 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 border border-dashed rounded p-2 bg-background/60">
                            <div className="text-xs">
                              <span className="text-muted-foreground">Margem aplicada: </span>
                              <strong className={margem.override ? 'text-amber-600' : ''}>{margem.pct}%</strong>
                              <span className="text-muted-foreground"> ({margem.faixaLabel}) · Imposto {IMPOSTO_POD_PADRAO}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {margem.override && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => atualizarItem(idx, { margem_override: false, margem_pct: null })}>
                                  Restaurar padrão
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPasswordItemIdx(idx)}>
                                <Lock className="w-3 h-3 mr-1" />Editar margem
                              </Button>
                            </div>
                          </div>
                        )}

                        {!it.tipo_produto ? (
                          <p className="text-xs text-muted-foreground">Selecione o tipo de produto para ver os planos disponíveis.</p>
                        ) : planos.length === 0 ? (
                          <p className="text-xs text-amber-600 border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                            Nenhum plano cadastrado para {it.tipo_produto}. Cadastre em Painel Administrador → Logística.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-16">Escolher</TableHead>
                                  <TableHead className="text-right">Plano</TableHead>
                                  <TableHead className="text-right">Frete Médio</TableHead>
                                  <TableHead className="text-right">+ Manuseio</TableHead>
                                  <TableHead className="text-right">Margem ({margem.pct}%)</TableHead>
                                  <TableHead className="text-right">Imposto ({IMPOSTO_POD_PADRAO}%)</TableHead>
                                  <TableHead className="text-right">Preço/Envio</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {planos.map(p => {
                                  const manuseio = Number(p.taxa_manuseio || 0);
                                  const calc = calcularPrecoPod({ frete: Number(p.preco), manuseio, margemPct: margem.pct, impostoPct: IMPOSTO_POD_PADRAO });
                                  const selected = it.planos_selecionados.includes(p.plano);
                                  return (
                                    <TableRow key={p.id} className={selected ? 'bg-primary/5' : ''}>
                                      <TableCell>
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={(e) => {
                                            const next = e.target.checked
                                              ? Array.from(new Set([...it.planos_selecionados, p.plano]))
                                              : it.planos_selecionados.filter(pl => pl !== p.plano);
                                            atualizarItem(idx, { planos_selecionados: next });
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">{p.plano}</TableCell>
                                      <TableCell className="text-right">{formatBRL(p.preco)}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{formatBRL(manuseio)}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{formatBRL(calc.margemValor)}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">{formatBRL(calc.impostoValor)}</TableCell>
                                      <TableCell className="text-right font-semibold">{formatBRL(calc.precoFinal)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Qtd estimada de envios</Label>
                            <Input
                              type="number"
                              min="0"
                              value={it.qtd_envios}
                              onChange={(e) => atualizarItem(idx, { qtd_envios: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <Label>Observações gerais</Label>
                    <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                  </div>

                  {/* Hidden export container */}
                  <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
                    <div ref={exportRef} style={{ padding: 24, background: '#fff', color: '#111', width: 720, fontFamily: 'system-ui, sans-serif' }}>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tabela de Preços — Print on Demand</h2>
                      <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#555' }}>
                        Produtor: <strong>{orcamentoSelecionado?.nome_cliente || '—'}</strong> · Orçamento: <strong>{orcamentoSelecionado?.numero_orcamento || '—'}</strong> · {new Date().toLocaleDateString('pt-BR')}
                      </p>
                      {podItens.map((it, idx) => {
                        const planos = planosDoTipo(it.tipo_produto);
                        const margem = margemEfetivaItem(it);
                        return (
                          <div key={idx} style={{ marginBottom: 18, border: '1px solid #e5e5e5', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                              <span>{it.nome_produto}</span>
                              <span style={{ color: '#666', fontWeight: 400 }}>{it.tipo_produto || '—'}</span>
                            </div>
                            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#555' }}>
                              Margem: <strong>{margem.pct}%</strong> ({margem.faixaLabel}) · Imposto: <strong>{IMPOSTO_POD_PADRAO}%</strong>
                            </p>
                            {planos.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#a15c00' }}>Sem planos cadastrados.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: '#f5f5f5' }}>
                                    <th style={{ textAlign: 'right', padding: 6 }}>Plano</th>
                                    <th style={{ textAlign: 'right', padding: 6 }}>Frete Médio</th>
                                    <th style={{ textAlign: 'right', padding: 6 }}>+ Manuseio</th>
                                    <th style={{ textAlign: 'right', padding: 6 }}>Margem</th>
                                    <th style={{ textAlign: 'right', padding: 6 }}>Imposto</th>
                                    <th style={{ textAlign: 'right', padding: 6 }}>Preço/Envio</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {planos.map(p => {
                                    const calc = calcularPrecoPod({ frete: Number(p.preco), manuseio: Number(p.taxa_manuseio || 0), margemPct: margem.pct, impostoPct: IMPOSTO_POD_PADRAO });
                                    const sel = it.planos_selecionados.includes(p.plano);
                                    return (
                                      <tr key={p.id} style={{ borderTop: '1px solid #eee', background: sel ? '#fff8e1' : 'transparent' }}>
                                        <td style={{ textAlign: 'right', padding: 6, fontWeight: sel ? 700 : 400 }}>{sel ? '★ ' : ''}{p.plano}</td>
                                        <td style={{ textAlign: 'right', padding: 6 }}>{formatBRL(p.preco)}</td>
                                        <td style={{ textAlign: 'right', padding: 6, color: '#666' }}>{formatBRL(p.taxa_manuseio)}</td>
                                        <td style={{ textAlign: 'right', padding: 6, color: '#666' }}>{formatBRL(calc.margemValor)}</td>
                                        <td style={{ textAlign: 'right', padding: 6, color: '#666' }}>{formatBRL(calc.impostoValor)}</td>
                                        <td style={{ textAlign: 'right', padding: 6, fontWeight: sel ? 700 : 600 }}>{formatBRL(calc.precoFinal)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{editing ? 'Salvar' : 'Criar Cotação'}</Button>
        </DialogFooter>
      </DialogContent>
      {passwordItemIdx !== null && (
        <MargemOverrideFlow
          idx={passwordItemIdx}
          currentPct={margemEfetivaItem(podItens[passwordItemIdx]).pct}
          onClose={() => setPasswordItemIdx(null)}
          onApply={(pct) => {
            atualizarItem(passwordItemIdx, { margem_override: true, margem_pct: pct });
            setPasswordItemIdx(null);
          }}
        />
      )}
    </Dialog>
  );
}

function MargemOverrideFlow({ idx, currentPct, onClose, onApply }: {
  idx: number;
  currentPct: number;
  onClose: () => void;
  onApply: (pct: number) => void;
}) {
  const [passOpen, setPassOpen] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [novaMargem, setNovaMargem] = useState<string>(String(currentPct));

  return (
    <>
      <AdminPasswordDialog
        open={passOpen}
        onOpenChange={(o) => { if (!o) { setPassOpen(false); if (!editOpen) onClose(); } }}
        title="Editar margem de lucro"
        description="Alterar a margem de um orçamento POD exige senha do administrador."
        actionLabel="Liberar edição"
        onConfirm={() => { setPassOpen(false); setEditOpen(true); }}
      />
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); onClose(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Margem de lucro (item {idx + 1})</DialogTitle>
            <DialogDescription>Defina a margem personalizada para este produto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Margem (%)</Label>
            <Input type="number" min="0" step="0.01" value={novaMargem} onChange={(e) => setNovaMargem(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); onClose(); }}>Cancelar</Button>
            <Button disabled={novaMargem === ''} onClick={() => { onApply(Number(novaMargem)); setEditOpen(false); }}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PodItemDraft {
  nome_produto: string;
  tipo_produto: string;
  planos_selecionados: number[];
  qtd_envios: string;
  observacoes: string;
  margem_pct: number | null;
  margem_override: boolean;
}