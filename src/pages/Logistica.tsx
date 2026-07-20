import { useMemo, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, Package, Lock } from 'lucide-react';
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
import { useFreteCotacoes, useCreateFreteCotacao, useUpdateFreteCotacao, useDeleteFreteCotacao, fetchFreteCotacaoByOrcamento } from '@/hooks/useFreteCotacoes';
import { useFretePodPrecos, fetchPodPrecoAtivo } from '@/hooks/useFretePodPrecos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { FRETE_TIPOS_PRODUTO, FRETE_POD_PLANOS, FreteCotacao, FreteCotacaoInsert, FreteStatus, FreteTipoProduto } from '@/types/frete';
import { formatBRL } from '@/lib/freteHelpers';
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

  const handleSalvar = async (payload: FreteCotacaoInsert) => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, updates: payload as any });
      setDialogOpen(false);
      setEditing(null);
      return;
    }
    const existente = await fetchFreteCotacaoByOrcamento(payload.orcamento_id);
    if (existente) {
      setConfirmSubstituicao({ payload });
      return;
    }
    await createMut.mutateAsync({ cotacao: payload });
    setDialogOpen(false);
  };

  const confirmarSubstituicao = async () => {
    if (!confirmSubstituicao) return;
    await createMut.mutateAsync({ cotacao: confirmSubstituicao.payload, substituir: true });
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
                        const total = (Number(c.pod_preco_por_envio) || 0) * (Number(c.pod_quantidade_envios_estimada) || 0);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs">{orcamentoLabel(c.orcamento_id)}</TableCell>
                            <TableCell>{c.tipo_produto || '—'}</TableCell>
                            <TableCell className="text-right">{c.pod_plano ?? '—'}</TableCell>
                            <TableCell className={`text-right font-medium ${c.pod_preco_editado_manualmente ? 'text-amber-600' : ''}`}>
                              {formatBRL(c.pod_preco_por_envio)}
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
  onSave: (payload: FreteCotacaoInsert) => Promise<void> | void;
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
      await onSave(payload);
    } else {
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
      await onSave(payload);
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

          <div>
            <Label>Tipo de Produto *</Label>
            <Select value={tipoProduto} onValueChange={(v) => { setTipoProduto(v); if (tipo === 'pod') carregarPrecoTabelado(v, plano); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FRETE_TIPOS_PRODUTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{editing ? 'Salvar' : 'Criar Cotação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}