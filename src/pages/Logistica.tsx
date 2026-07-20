import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { Truck, Plus, Pencil, Trash2, Package, Check, ChevronsUpDown, Search, ImageDown, Lock, Eye, Users } from 'lucide-react';
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
  const [pendingEdit, setPendingEdit] = useState<FreteCotacao | null>(null);
  const [produtorAberto, setProdutorAberto] = useState<{ produtor: string; cotacoes: FreteCotacao[] } | null>(null);
  const [exportandoCotacao, setExportandoCotacao] = useState<FreteCotacao | null>(null);
  const exportListaRef = useRef<HTMLDivElement | null>(null);

  const cotacoesFiltradas = useMemo(() => cotacoes.filter(c => c.tipo === tab), [cotacoes, tab]);

  const gruposProdutor = useMemo(() => {
    const map = new Map<string, { produtor: string; cotacoes: FreteCotacao[] }>();
    cotacoesFiltradas.forEach(c => {
      const orc = orcamentos.find(o => o.id === c.orcamento_id);
      const produtor = orc?.nome_cliente || 'Sem produtor';
      if (!map.has(produtor)) map.set(produtor, { produtor, cotacoes: [] });
      map.get(produtor)!.cotacoes.push(c);
    });
    return Array.from(map.values()).sort((a, b) => a.produtor.localeCompare(b.produtor));
  }, [cotacoesFiltradas, orcamentos]);

  // Mantém dialog do produtor sincronizado quando cotações mudam
  useEffect(() => {
    if (!produtorAberto) return;
    const atualizado = gruposProdutor.find(g => g.produtor === produtorAberto.produtor);
    if (atualizado) setProdutorAberto(atualizado);
    else setProdutorAberto(null);
  }, [gruposProdutor]);

  const orcamentoLabel = (id: string | null) => {
    const o = orcamentos.find(x => x.id === id);
    return o ? `${o.numero_orcamento} — ${o.nome_cliente}` : '—';
  };

  const handleAbrirNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const solicitarEdicao = (c: FreteCotacao) => {
    setPendingEdit(c);
  };

  const handleEditar = (c: FreteCotacao) => {
    if (c.tipo === 'estoque_proprio' && c.status === 'confirmado') {
      setConfirmEdicaoConfirmada(c);
      return;
    }
    setEditing(c);
    setDialogOpen(true);
  };

  const baixarImagemCotacao = async (c: FreteCotacao) => {
    setExportandoCotacao(c);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 60));
    if (!exportListaRef.current) { setExportandoCotacao(null); return; }
    const orc = orcamentos.find(o => o.id === c.orcamento_id);
    const slug = `${orc?.numero_orcamento || 'cotacao'}_${c.nome_produto || c.tipo_produto || 'produto'}`.replace(/[^\w-]+/g, '_');
    try {
      await exportElementAsPng(exportListaRef.current, `frete_${slug}.png`);
      toast.success('Imagem gerada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar imagem');
    } finally {
      setExportandoCotacao(null);
    }
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
                              <Button size="icon" variant="ghost" onClick={() => solicitarEdicao(c)}>
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
              ) : gruposProdutor.length === 0 ? (
                <div className="py-12 text-center border rounded-lg bg-muted/30 text-muted-foreground">
                  Nenhuma cotação POD registrada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produtor</TableHead>
                        <TableHead className="text-right">Orçamentos</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="text-right">Preço/envio (faixa)</TableHead>
                        <TableHead>Última cotação</TableHead>
                        <TableHead className="w-40">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gruposProdutor.map(g => {
                        const orcamentosSet = new Set(g.cotacoes.map(c => c.orcamento_id));
                        const precos: number[] = [];
                        g.cotacoes.forEach(c => {
                          const sel = Array.isArray(c.pod_planos_selecionados) ? c.pod_planos_selecionados : [];
                          if (sel.length > 0) sel.forEach(s => precos.push(Number(s.preco_final)));
                          else if (c.pod_preco_por_envio != null) precos.push(Number(c.pod_preco_por_envio));
                        });
                        const min = precos.length ? Math.min(...precos) : null;
                        const max = precos.length ? Math.max(...precos) : null;
                        const ultima = g.cotacoes.reduce((acc, c) => c.created_at > acc ? c.created_at : acc, g.cotacoes[0].created_at);
                        return (
                          <TableRow key={g.produtor}>
                            <TableCell className="font-medium flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              {g.produtor}
                            </TableCell>
                            <TableCell className="text-right">{orcamentosSet.size}</TableCell>
                            <TableCell className="text-right">{g.cotacoes.length}</TableCell>
                            <TableCell className="text-right font-medium">
                              {min == null ? '—' : min === max ? formatBRL(min) : `${formatBRL(min)} – ${formatBRL(max)}`}
                            </TableCell>
                            <TableCell className="text-xs">{new Date(ultima).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => setProdutorAberto(g)}>
                                <Eye className="w-4 h-4 mr-2" />Ver produtos
                              </Button>
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

      {/* Senha para editar */}
      {pendingEdit && (
        <AdminPasswordDialog
          open={!!pendingEdit}
          onOpenChange={(o) => { if (!o) setPendingEdit(null); }}
          title="Editar cotação de frete"
          description="Alterar uma cotação POD exige senha do administrador."
          actionLabel="Liberar edição"
          onConfirm={() => {
            const c = pendingEdit;
            setPendingEdit(null);
            if (c) handleEditar(c);
          }}
        />
      )}

      {/* Drill-down por produtor */}
      <Dialog open={!!produtorAberto} onOpenChange={(o) => !o && setProdutorAberto(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {produtorAberto?.produtor}
            </DialogTitle>
            <DialogDescription>
              Orçamentos de frete por produto deste produtor.
            </DialogDescription>
          </DialogHeader>
          {produtorAberto && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orçamento</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Planos</TableHead>
                    <TableHead className="text-right">Preço/envio</TableHead>
                    <TableHead className="text-right">Quant. Envios Mensais médio</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-44">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtorAberto.cotacoes.map(c => {
                    const selecionados = Array.isArray(c.pod_planos_selecionados) ? c.pod_planos_selecionados : [];
                    const planoLabel = selecionados.length > 0
                      ? selecionados.map(s => s.plano).join(', ')
                      : (c.pod_plano ?? '—');
                    const precoLabel = selecionados.length > 1
                      ? `a partir de ${formatBRL(Math.min(...selecionados.map(s => Number(s.preco_final))))}`
                      : formatBRL(selecionados[0]?.preco_final ?? c.pod_preco_por_envio);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{orcamentoLabel(c.orcamento_id)}</TableCell>
                        <TableCell className="text-xs">{c.nome_produto || '—'}</TableCell>
                        <TableCell className="text-xs">{c.tipo_produto || '—'}</TableCell>
                        <TableCell className="text-right text-xs">{planoLabel}</TableCell>
                        <TableCell className="text-right font-medium">{precoLabel}</TableCell>
                        <TableCell className="text-right">{c.pod_quantidade_envios_estimada ?? '—'}</TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="Editar (senha)" onClick={() => solicitarEdicao(c)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Baixar imagem" onClick={() => baixarImagemCotacao(c)}>
                              <ImageDown className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDeletando(c)}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdutorAberto(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Container escondido para exportar PNG */}
      {exportandoCotacao && (
        <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
          <CotacaoExportCard
            ref={exportListaRef}
            cotacao={exportandoCotacao}
            produtor={orcamentos.find(o => o.id === exportandoCotacao.orcamento_id)?.nome_cliente || 'Sem produtor'}
            numeroOrc={orcamentos.find(o => o.id === exportandoCotacao.orcamento_id)?.numero_orcamento || '—'}
          />
        </div>
      )}
    </div>
  );
}

// ============ Card de exportação PNG ============

const CotacaoExportCard = forwardRef<HTMLDivElement, {
  cotacao: FreteCotacao;
  produtor: string;
  numeroOrc: string;
}>(({ cotacao, produtor, numeroOrc }, ref) => {
  const selecionados = Array.isArray(cotacao.pod_planos_selecionados) && cotacao.pod_planos_selecionados.length > 0
    ? cotacao.pod_planos_selecionados
    : cotacao.pod_plano != null
      ? [{
          plano: cotacao.pod_plano,
          preco: Number(cotacao.pod_preco_por_envio || 0),
          taxa_manuseio: 0,
          margem_percentual: Number(cotacao.margem_percentual || 0),
          imposto_percentual: Number(cotacao.imposto_percentual || IMPOSTO_POD_PADRAO),
          preco_final: Number(cotacao.pod_preco_por_envio || 0),
        } as PodPlanoSelecionado]
      : [];
  return (
    <div ref={ref} style={{ padding: 24, background: '#fff', color: '#111', width: 720, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Custo de Frete — Print on Demand</h2>
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#555' }}>
        Produtor: <strong>{produtor}</strong> · Orçamento: <strong>{numeroOrc}</strong> · Data: <strong>{new Date(cotacao.created_at).toLocaleDateString('pt-BR')}</strong>
      </p>
      <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          <span>{cotacao.nome_produto || 'Produto'}</span>
          <span style={{ color: '#666', fontWeight: 400 }}>{cotacao.tipo_produto || '—'}</span>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#555' }}>
          Quant. Envios Mensais médio: <strong>{cotacao.pod_quantidade_envios_estimada ?? '—'}</strong>
        </p>
        {selecionados.length === 0 ? (
          <p style={{ fontSize: 12, color: '#a15c00' }}>Sem planos.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ textAlign: 'center', padding: 8 }}>Plano (frascos)</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Preço / Envio</th>
              </tr>
            </thead>
            <tbody>
              {[...selecionados].sort((a, b) => a.plano - b.plano).map(s => (
                <tr key={s.plano} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ textAlign: 'center', padding: 8, fontWeight: 700 }}>{s.plano}</td>
                  <td style={{ textAlign: 'right', padding: 8, fontWeight: 700 }}>{formatBRL(s.preco_final)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});
CotacaoExportCard.displayName = 'CotacaoExportCard';

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
  const { data: todasCotacoes = [] } = useFreteCotacoes();
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
    if (editing && tipo === 'pod') {
      // Modo edição POD: carrega um único item com os planos já salvos
      const jaSelecionados = Array.isArray(editing.pod_planos_selecionados) && editing.pod_planos_selecionados.length > 0
        ? editing.pod_planos_selecionados.map(s => Number(s.plano))
        : (editing.pod_plano != null ? [Number(editing.pod_plano)] : []);
      setPodItens([{
        nome_produto: editing.nome_produto || 'Produto',
        tipo_produto: editing.tipo_produto || '',
        planos_selecionados: jaSelecionados,
        qtd_envios: editing.pod_quantidade_envios_estimada != null ? String(editing.pod_quantidade_envios_estimada) : '',
        observacoes: editing.observacoes || '',
        margem_pct: editing.margem_override ? Number(editing.margem_percentual || 0) : null,
        margem_override: !!editing.margem_override,
      }]);
      return;
    }
    if (tipo !== 'pod' || !orcamentoSelecionado) {
      setPodItens([]);
      return;
    }
    const itens = (orcamentoSelecionado.itens_producao || []) as any[];
    // Pré-carrega planos previamente selecionados por produto neste orçamento
    const cotacoesDoOrc = todasCotacoes.filter(
      c => c.orcamento_id === orcamentoSelecionado.id && c.tipo === 'pod'
    );
    setPodItens(itens.map((it: any) => {
      const nomeProd = it.nome_produto || 'Produto';
      const tp = mapTipoProduto(it.tipo_produto);
      const previa = cotacoesDoOrc.find(c => (c.nome_produto || '') === nomeProd);
      const planosPrev = previa && Array.isArray(previa.pod_planos_selecionados) && previa.pod_planos_selecionados.length > 0
        ? previa.pod_planos_selecionados.map(s => Number(s.plano))
        : (previa?.pod_plano != null ? [Number(previa.pod_plano)] : []);
      return {
        nome_produto: nomeProd,
        tipo_produto: previa?.tipo_produto || tp,
        planos_selecionados: planosPrev,
        qtd_envios: previa?.pod_quantidade_envios_estimada != null ? String(previa.pod_quantidade_envios_estimada) : '',
        observacoes: previa?.observacoes || '',
        margem_pct: previa?.margem_override ? Number(previa.margem_percentual || 0) : null,
        margem_override: !!previa?.margem_override,
      };
    }));
  }, [orcamentoSelecionado, tipo, editing, todasCotacoes]);

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
      // POD criação e edição: usam a mesma estrutura multi-plano por item
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

          {tipo === 'estoque_proprio' && (
            <div>
              <Label>Tipo de Produto *</Label>
              <Select value={tipoProduto} onValueChange={(v) => setTipoProduto(v)}>
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

          {tipo === 'pod' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">{editing ? 'Produto' : 'Produtos do orçamento'}</Label>
                {orcamentoSelecionado && !editing && (
                  <span className="text-xs text-muted-foreground">{podItens.length} item(ns)</span>
                )}
              </div>
              {!orcamentoSelecionado && !editing ? (
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => atualizarItem(idx, { planos_selecionados: planos.map(p => p.plano) })}
                              >
                                Selecionar todos
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => atualizarItem(idx, { planos_selecionados: [] })}
                              >
                                Limpar seleção
                              </Button>
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
                            <Label className="text-xs">Quant. Envios Mensais médio</Label>
                            <Input
                              type="number"
                              min="0"
                              value={it.qtd_envios}
                              onChange={(e) => atualizarItem(idx, { qtd_envios: e.target.value })}
                            />
                          </div>
                        </div>

                        {it.tipo_produto && planos.length > 0 && it.planos_selecionados.length > 0 && (() => {
                          const envios = Number(it.qtd_envios) || 0;
                          const rows = planos
                            .filter(p => it.planos_selecionados.includes(p.plano))
                            .map(p => {
                              const calc = calcularPrecoPod({ frete: Number(p.preco), manuseio: Number(p.taxa_manuseio || 0), margemPct: margem.pct, impostoPct: IMPOSTO_POD_PADRAO });
                              return { plano: p.plano, precoFinal: calc.precoFinal, total: calc.precoFinal * envios };
                            });
                          const somaMensal = rows.reduce((a, r) => a + r.total, 0);
                          return (
                            <div className="border rounded-md p-3 bg-primary/5 space-y-2">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span>Planos selecionados ({rows.length})</span>
                                {envios > 0 && (
                                  <span className="text-muted-foreground">Base: {envios} envios/mês</span>
                                )}
                              </div>
                              <div className="space-y-1">
                                {rows.map(r => (
                                  <div key={r.plano} className="flex items-center justify-between text-xs">
                                    <span className="font-semibold">Plano {r.plano}</span>
                                    <span>
                                      <span className="text-muted-foreground">{formatBRL(r.precoFinal)}/envio</span>
                                      {envios > 0 && (
                                        <span className="ml-3 font-semibold">Total: {formatBRL(r.total)}</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {envios > 0 && rows.length > 1 && (
                                <div className="border-t pt-2 flex justify-between text-xs font-semibold">
                                  <span>Soma mensal (todos os planos marcados)</span>
                                  <span>{formatBRL(somaMensal)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                        const envios = Number(it.qtd_envios) || 0;
                        const selecionadosRows = planos
                          .filter(p => it.planos_selecionados.includes(p.plano))
                          .map(p => {
                            const calc = calcularPrecoPod({ frete: Number(p.preco), manuseio: Number(p.taxa_manuseio || 0), margemPct: margem.pct, impostoPct: IMPOSTO_POD_PADRAO });
                            return { plano: p.plano, frete: Number(p.preco), manuseio: Number(p.taxa_manuseio || 0), precoFinal: calc.precoFinal, total: calc.precoFinal * envios };
                          });
                        return (
                          <div key={idx} style={{ marginBottom: 18, border: '1px solid #e5e5e5', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                              <span>{it.nome_produto}</span>
                              <span style={{ color: '#666', fontWeight: 400 }}>{it.tipo_produto || '—'}</span>
                            </div>
                            {envios > 0 && (
                              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#555' }}>
                                Quant. Envios Mensais médio: <strong>{envios}</strong>
                              </p>
                            )}
                            {selecionadosRows.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#a15c00' }}>Nenhum plano selecionado.</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                  <tr style={{ background: '#f5f5f5' }}>
                                    <th style={{ textAlign: 'center', padding: 8 }}>Plano (frascos)</th>
                                    <th style={{ textAlign: 'right', padding: 8 }}>Preço / Envio</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selecionadosRows.map(r => (
                                    <tr key={r.plano} style={{ borderTop: '1px solid #eee' }}>
                                      <td style={{ textAlign: 'center', padding: 8, fontWeight: 700 }}>{r.plano}</td>
                                      <td style={{ textAlign: 'right', padding: 8, fontWeight: 700 }}>{formatBRL(r.precoFinal)}</td>
                                    </tr>
                                  ))}
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