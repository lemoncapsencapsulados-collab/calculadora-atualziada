import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRecompras } from '@/hooks/useRecompras';
import { toast } from 'sonner';
import CondicoesPagamentoForm from '@/components/CondicoesPagamentoForm';
import type { CondicoesPagamento } from '@/types/orcamento';
import { formatCurrency } from '@/lib/unitConversion';

interface Props {
  pedido: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  consultoresDisponiveis: string[];
}

interface LinhaProduto {
  selecionado: boolean;
  nome: string;
  precificacaoId?: string;
  quantidade: number;
  valorUnitario: number;
  modeloNegocio: 'estoque' | 'print_on_demand';
  podConsumoQuantidade?: number;
  podConsumoInicio?: Date;
  podConsumoFim?: Date;
}

const toIso = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : undefined);

export default function AdicionarRecompraDialog({ pedido, open, onOpenChange, consultoresDisponiveis }: Props) {
  const { criarRecompraComPedido } = useRecompras();

  const snap = pedido?.orcamento_snapshot;
  const itensOrigem = useMemo<any[]>(() => snap?.itens_producao || [], [snap]);

  const [consultor, setConsultor] = useState<string>(snap?.consultor_responsavel || '');
  const [dataRecompra, setDataRecompra] = useState<Date>(new Date());
  const [linhas, setLinhas] = useState<LinhaProduto[]>(() =>
    itensOrigem.map((it: any) => ({
      selecionado: true,
      nome: it.nome_produto,
      precificacaoId: it.precificacao_id,
      quantidade: it.quantidade || 1,
      valorUnitario: it.preco_unitario || 0,
      modeloNegocio: (it.modelo_negocio || 'estoque') as 'estoque' | 'print_on_demand',
    }))
  );
  const [condicoes, setCondicoes] = useState<CondicoesPagamento>(snap?.condicoes_pagamento || {});
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Reset quando o pedido mudar
  useMemo(() => {
    if (pedido) {
      setConsultor(snap?.consultor_responsavel || '');
      setDataRecompra(new Date());
      setLinhas(
        (snap?.itens_producao || []).map((it: any) => ({
          selecionado: true,
          nome: it.nome_produto,
          precificacaoId: it.precificacao_id,
          quantidade: it.quantidade || 1,
          valorUnitario: it.preco_unitario || 0,
          modeloNegocio: (it.modelo_negocio || 'estoque') as 'estoque' | 'print_on_demand',
        }))
      );
      setCondicoes(snap?.condicoes_pagamento || {});
      setObservacao('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.id]);

  const updateLinha = (idx: number, patch: Partial<LinhaProduto>) => {
    setLinhas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const totalSelecionadas = linhas.filter(l => l.selecionado);
  const valorTotal = totalSelecionadas.reduce((s, l) => s + l.quantidade * l.valorUnitario, 0);

  const handleSalvar = async () => {
    if (!pedido) return;
    if (!consultor.trim()) {
      toast.error('Selecione o consultor responsável.');
      return;
    }
    const validas = totalSelecionadas.filter(l => l.nome.trim() && l.quantidade > 0 && l.valorUnitario >= 0);
    if (validas.length === 0) {
      toast.error('Selecione ao menos 1 produto válido.');
      return;
    }
    for (const l of validas) {
      if (l.modeloNegocio === 'print_on_demand') {
        if (!l.podConsumoInicio || !l.podConsumoFim) {
          toast.error(`Informe o período de consumo POD para "${l.nome}".`);
          return;
        }
        if (l.podConsumoFim < l.podConsumoInicio) {
          toast.error(`Período POD inválido para "${l.nome}" (fim antes do início).`);
          return;
        }
      }
    }

    setSalvando(true);
    try {
      await criarRecompraComPedido.mutateAsync({
        pedidoOrigem: pedido,
        consultor,
        dataRecompra: format(dataRecompra, 'yyyy-MM-dd'),
        condicoes_pagamento: condicoes,
        observacao: observacao.trim() || undefined,
        produtos: validas.map(l => ({
          nome: l.nome,
          quantidade: l.quantidade,
          valorUnitario: l.valorUnitario,
          modeloNegocio: l.modeloNegocio,
          precificacaoId: l.precificacaoId,
          ...(l.modeloNegocio === 'print_on_demand'
            ? {
                podConsumoQuantidade: l.podConsumoQuantidade || 0,
                podConsumoInicio: toIso(l.podConsumoInicio),
                podConsumoFim: toIso(l.podConsumoFim),
              }
            : {}),
        })),
      });
      onOpenChange(false);
    } catch (e) {
      // toast tratado no hook
    } finally {
      setSalvando(false);
    }
  };

  if (!pedido) return null;

  const nomeCliente = snap?.nome_cliente || snap?.dados_cliente?.nome_completo || pedido.formula_snapshot?.cliente || 'Cliente';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-600" />
            Adicionar Recompra — {nomeCliente}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Consultor *</Label>
              <Select value={consultor} onValueChange={setConsultor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {consultoresDisponiveis.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  {consultor && !consultoresDisponiveis.includes(consultor) && (
                    <SelectItem value={consultor}>{consultor}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data da Recompra *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dataRecompra && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dataRecompra ? format(dataRecompra, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataRecompra} onSelect={(d) => d && setDataRecompra(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Produtos do pedido original</Label>
            <p className="text-xs text-muted-foreground">Marque os que entram nesta recompra. Ajuste quantidade, valor e modelo.</p>
            <div className="space-y-3">
              {linhas.length === 0 && (
                <p className="text-sm text-muted-foreground">Pedido sem itens de produção para reaproveitar.</p>
              )}
              {linhas.map((l, idx) => (
                <div key={idx} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={l.selecionado} onCheckedChange={(v) => updateLinha(idx, { selecionado: !!v })} />
                    <Input value={l.nome} onChange={(e) => updateLinha(idx, { nome: e.target.value })} className="flex-1" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade</Label>
                      <Input type="number" min={0} value={l.quantidade || ''} onChange={(e) => updateLinha(idx, { quantidade: Number(e.target.value) || 0 })} disabled={!l.selecionado} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor unit. (R$)</Label>
                      <Input type="number" step="0.01" min={0} value={l.valorUnitario || ''} onChange={(e) => updateLinha(idx, { valorUnitario: Number(e.target.value) || 0 })} disabled={!l.selecionado} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Modelo</Label>
                      <Select value={l.modeloNegocio} onValueChange={(v: any) => updateLinha(idx, { modeloNegocio: v })} disabled={!l.selecionado}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="estoque">Estoque</SelectItem>
                          <SelectItem value="print_on_demand">Print on Demand</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {l.selecionado && l.modeloNegocio === 'print_on_demand' && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-xs">Potes consumidos</Label>
                        <Input type="number" min={0} value={l.podConsumoQuantidade || ''} onChange={(e) => updateLinha(idx, { podConsumoQuantidade: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Início do consumo</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal h-9', !l.podConsumoInicio && 'text-muted-foreground')}>
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {l.podConsumoInicio ? format(l.podConsumoInicio, 'dd/MM/yyyy') : 'Início'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={l.podConsumoInicio} onSelect={(d) => updateLinha(idx, { podConsumoInicio: d || undefined })} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fim do consumo</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal h-9', !l.podConsumoFim && 'text-muted-foreground')}>
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {l.podConsumoFim ? format(l.podConsumoFim, 'dd/MM/yyyy') : 'Fim'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={l.podConsumoFim} onSelect={(d) => updateLinha(idx, { podConsumoFim: d || undefined })} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Forma de pagamento</Label>
            <CondicoesPagamentoForm value={condicoes} onChange={setCondicoes} valorTotal={valorTotal} />
          </div>

          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Notas internas..." />
          </div>

          <div className="bg-muted/50 rounded p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor Total</span>
            <span className="text-lg font-bold text-orange-600">{formatCurrency(valorTotal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando} className="bg-orange-600 hover:bg-orange-700 text-white">
            <RefreshCw className="h-4 w-4 mr-1" />
            {salvando ? 'Salvando...' : 'Salvar Recompra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}