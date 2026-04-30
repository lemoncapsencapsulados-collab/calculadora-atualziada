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
import { CalendarIcon, RefreshCw, ShoppingCart, Package } from 'lucide-react';
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

type ModoRecompra = 'novo_pedido' | 'print_on_demand';

interface LinhaProduto {
  selecionado: boolean;
  nome: string;
  precificacaoId?: string;
  quantidade: number;
  valorUnitario: number;
}

const toIso = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : undefined);

export default function AdicionarRecompraDialog({ pedido, open, onOpenChange, consultoresDisponiveis }: Props) {
  const { criarRecompraComPedido } = useRecompras();

  const snap = pedido?.orcamento_snapshot;
  const itensOrigem = useMemo<any[]>(() => snap?.itens_producao || [], [snap]);

  const [modo, setModo] = useState<ModoRecompra>('novo_pedido');
  const [consultor, setConsultor] = useState<string>(snap?.consultor_responsavel || '');
  const [dataRecompra, setDataRecompra] = useState<Date>(new Date());
  const [linhas, setLinhas] = useState<LinhaProduto[]>(() =>
    itensOrigem.map((it: any) => ({
      selecionado: true,
      nome: it.nome_produto,
      precificacaoId: it.precificacao_id,
      quantidade: it.quantidade || 1,
      valorUnitario: it.preco_unitario || 0,
    }))
  );
  const [podInicio, setPodInicio] = useState<Date | undefined>(undefined);
  const [podFim, setPodFim] = useState<Date | undefined>(undefined);
  const [condicoes, setCondicoes] = useState<CondicoesPagamento>(snap?.condicoes_pagamento || {});
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Reset quando o pedido mudar
  useMemo(() => {
    if (pedido) {
      setModo('novo_pedido');
      setConsultor(snap?.consultor_responsavel || '');
      setDataRecompra(new Date());
      setLinhas(
        (snap?.itens_producao || []).map((it: any) => ({
          selecionado: true,
          nome: it.nome_produto,
          precificacaoId: it.precificacao_id,
          quantidade: it.quantidade || 1,
          valorUnitario: it.preco_unitario || 0,
        }))
      );
      setPodInicio(undefined);
      setPodFim(undefined);
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
  const isPOD = modo === 'print_on_demand';

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

    if (isPOD) {
      if (!podInicio || !podFim) {
        toast.error('Informe o período de consumo (início e fim).');
        return;
      }
      if (podFim < podInicio) {
        toast.error('Período inválido: fim anterior ao início.');
        return;
      }
    }

    setSalvando(true);
    try {
      await criarRecompraComPedido.mutateAsync({
        pedidoOrigem: pedido,
        modo,
        consultor,
        dataRecompra: format(dataRecompra, 'yyyy-MM-dd'),
        condicoes_pagamento: isPOD ? undefined : condicoes,
        observacao: observacao.trim() || undefined,
        produtos: validas.map(l => ({
          nome: l.nome,
          quantidade: l.quantidade,
          valorUnitario: l.valorUnitario,
          modeloNegocio: isPOD ? 'print_on_demand' : 'estoque',
          precificacaoId: l.precificacaoId,
          ...(isPOD
            ? {
                podConsumoQuantidade: l.quantidade,
                podConsumoInicio: toIso(podInicio),
                podConsumoFim: toIso(podFim),
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
          {/* Filtro de Tipo */}
          <div className="space-y-2">
            <Label className="text-base">Tipo da recompra</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo('novo_pedido')}
                className={cn(
                  'border rounded-md p-3 text-left transition-colors flex items-start gap-2',
                  modo === 'novo_pedido' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                )}
              >
                <ShoppingCart className="h-5 w-5 mt-0.5 text-primary" />
                <div>
                  <div className="font-medium text-sm">Novo Pedido</div>
                  <div className="text-xs text-muted-foreground">Solicitação de novos potes (estoque) com forma de pagamento.</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setModo('print_on_demand')}
                className={cn(
                  'border rounded-md p-3 text-left transition-colors flex items-start gap-2',
                  modo === 'print_on_demand' ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500' : 'hover:bg-muted/50'
                )}
              >
                <Package className="h-5 w-5 mt-0.5 text-purple-600" />
                <div>
                  <div className="font-medium text-sm">Print on Demand</div>
                  <div className="text-xs text-muted-foreground">Registro de faturamento de consumo já ocorrido em um período.</div>
                </div>
              </button>
            </div>
          </div>

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
              <Label>Data do registro *</Label>
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

          {/* Período POD (apenas no modo POD) */}
          {isPOD && (
            <div className="border border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 rounded-md p-3 space-y-2">
              <Label className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-purple-600" />
                Período de consumo (faturamento) *
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !podInicio && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {podInicio ? format(podInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={podInicio} onSelect={(d) => setPodInicio(d || undefined)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !podFim && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {podFim ? format(podFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={podFim} onSelect={(d) => setPodFim(d || undefined)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O pagamento já ocorreu dentro deste período — não é necessário informar forma de pagamento.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-base">
              {isPOD ? 'Produtos consumidos no período' : 'Produtos do pedido original'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isPOD
                ? 'Marque os produtos consumidos, informe a quantidade e o valor unitário.'
                : 'Marque os que entram nesta recompra. Ajuste quantidade e valor.'}
            </p>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{isPOD ? 'Qtd consumida (potes)' : 'Quantidade'}</Label>
                      <Input type="number" min={0} value={l.quantidade || ''} onChange={(e) => updateLinha(idx, { quantidade: Number(e.target.value) || 0 })} disabled={!l.selecionado} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor unit. (R$)</Label>
                      <Input type="number" step="0.01" min={0} value={l.valorUnitario || ''} onChange={(e) => updateLinha(idx, { valorUnitario: Number(e.target.value) || 0 })} disabled={!l.selecionado} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forma de pagamento — apenas para Novo Pedido */}
          {!isPOD && (
            <div className="space-y-2">
              <Label className="text-base">Forma de pagamento</Label>
              <CondicoesPagamentoForm value={condicoes} onChange={setCondicoes} valorTotal={valorTotal} />
            </div>
          )}

          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Notas internas..." />
          </div>

          <div className="bg-muted/50 rounded p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {isPOD ? 'Faturamento do período' : 'Valor Total'}
            </span>
            <span className={cn('text-lg font-bold', isPOD ? 'text-purple-600' : 'text-orange-600')}>
              {formatCurrency(valorTotal)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className={cn('text-white', isPOD ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700')}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {salvando ? 'Salvando...' : (isPOD ? 'Registrar Consumo POD' : 'Salvar Recompra')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
