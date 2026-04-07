import { useState, useEffect, useMemo } from 'react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import ConsultorCombobox from '@/components/ConsultorCombobox';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import { Orcamento, ItemProducao, ServicoMarca, OrcamentoInsert, InsumoSnapshot, DetalhamentoEnvio, CondicoesPagamento, TipoOrcamento, Entregavel } from '@/types/orcamento';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Package, 
  Palette,
  Check,
  X,
  UserCircle,
  User,
  Truck,
  Settings2,
  AlertTriangle,
  Pencil,
  Lock,
  LockOpen
} from 'lucide-react';
import { DadosCliente, DetalhamentoFrete } from '@/types/orcamento';
import CondicoesPagamentoForm from './CondicoesPagamentoForm';

// ── Setup cost types ──
interface SetupItem {
  id: string;
  nome: string;
  selecionado: boolean;
  custoUnitario: number;
  quantidade: number;
}

interface SetupImpressaoItem {
  tipoProduto: string;
  custoUnitario: number;
  quantidade: number;
}

const CUSTOS_IMPRESSAO: Record<string, number> = {
  'Encapsulados': 940,
  'Gummy': 1340,
  'Líquido': 740,
  'Solúvel': 1590,
};

interface GerarOrcamentoDialogProps {
  orcamentoExistente?: Orcamento | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GerarOrcamentoDialog({ 
  orcamentoExistente, 
  onClose,
  onSuccess 
}: GerarOrcamentoDialogProps) {
  const { createOrcamento, updateOrcamento, getNextNumeroOrcamento } = useOrcamentos();
  const { precificacoes } = usePrecificacao();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Informações básicas
  const [tipoOrcamento, setTipoOrcamento] = useState<TipoOrcamento>('novo_produtor');
  const [nomeCliente, setNomeCliente] = useState('');
  const [consultorResponsavel, setConsultorResponsavel] = useState('');
  const [validadeDias, setValidadeDias] = useState(30);
  const [observacoes, setObservacoes] = useState('');
  
  // Step 2: Itens de produção
  const [itensProducao, setItensProducao] = useState<ItemProducao[]>([]);
  const [showPrecificacaoSelector, setShowPrecificacaoSelector] = useState(false);
  const [buscaPrecificacao, setBuscaPrecificacao] = useState('');
  const [selectedPrecificacoes, setSelectedPrecificacoes] = useState<string[]>([]);
  
  // Step 3: Setup costs
  const [setupItems, setSetupItems] = useState<SetupItem[]>([
    { id: 'codigo_barras', nome: 'Código de barras', selecionado: false, custoUnitario: 5.70, quantidade: 0 },
    { id: 'design_rotulos', nome: 'Design de rótulos', selecionado: false, custoUnitario: 200, quantidade: 0 },
    { id: 'pagina_vendas', nome: 'Página de vendas', selecionado: false, custoUnitario: 300, quantidade: 0 },
    { id: 'registro_inpi', nome: 'Registro de Marca no INPI', selecionado: false, custoUnitario: 880, quantidade: 1 },
  ]);
  const [setupImpressaoSelecionado, setSetupImpressaoSelecionado] = useState(false);
  const [setupImpressaoItens, setSetupImpressaoItens] = useState<SetupImpressaoItem[]>([]);
  const [margemSetup, setMargemSetup] = useState(20);
  const [senhaSetupDialog, setSenhaSetupDialog] = useState(false);
  const [senhaSetupInput, setSenhaSetupInput] = useState('');
  const [setupMargemLiberada, setSetupMargemLiberada] = useState(false);

  // Edição de custo de impressão protegida por senha
  const [impressaoEdicaoLiberada, setImpressaoEdicaoLiberada] = useState(false);
  const [senhaImpressaoDialog, setSenhaImpressaoDialog] = useState(false);
  const [senhaImpressaoInput, setSenhaImpressaoInput] = useState('');

  // Modo de cálculo: margem ou valor fixo
  const [modoCalculoSetup, setModoCalculoSetup] = useState<'margem' | 'valor_fixo'>('margem');
  const [valorFixoSetup, setValorFixoSetup] = useState(0);

  // Step 5: Dados opcionais (cliente e frete)
  const [dadosClienteTemp, setDadosClienteTemp] = useState<DadosCliente>({});
  const [detalhamentoFreteTemp, setDetalhamentoFreteTemp] = useState<DetalhamentoFrete | null>(null);
  const [showInfoClienteInline, setShowInfoClienteInline] = useState(false);
  const [showFreteInline, setShowFreteInline] = useState(false);

  // Condições de pagamento (step 4)
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicoesPagamento>({});

  // Estado para liberação de margem mínima com senha
  const [senhaMargemOrcDialog, setSenhaMargemOrcDialog] = useState(false);
  const [senhaMargemOrcInput, setSenhaMargemOrcInput] = useState('');
  const [margemOrcLiberadaIds, setMargemOrcLiberadaIds] = useState<string[]>([]);
  const SENHA_LIBERACAO_MARGEM = '0B%s8QP2Z+Do';

  // ── Derive setup quantities from products ──
  const numProdutos = itensProducao.length;

  const produtosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    itensProducao.forEach(item => {
      const tipo = item.segmento || 'Encapsulados';
      map[tipo] = (map[tipo] || 0) + 1;
    });
    return map;
  }, [itensProducao]);

  // Sync setup quantities when products change
  useEffect(() => {
    setSetupItems(prev => prev.map(item => {
      if (item.id === 'registro_inpi') return item;
      return { ...item, quantidade: numProdutos };
    }));

    // Update impressao items
    const tipos = Object.entries(produtosPorTipo);
    setSetupImpressaoItens(
      tipos.map(([tipo, qty]) => ({
        tipoProduto: tipo,
        custoUnitario: CUSTOS_IMPRESSAO[tipo] || 940,
        quantidade: qty,
      }))
    );
  }, [numProdutos, produtosPorTipo]);

  // ── Setup cost calculations ──
  const custoTotalSetup = useMemo(() => {
    let total = 0;
    setupItems.forEach(item => {
      if (item.selecionado) total += item.custoUnitario * item.quantidade;
    });
    if (setupImpressaoSelecionado) {
      setupImpressaoItens.forEach(item => {
        total += item.custoUnitario * item.quantidade;
      });
    }
    return total;
  }, [setupItems, setupImpressaoSelecionado, setupImpressaoItens]);

  const precoVendaSetup = useMemo(() => {
    if (custoTotalSetup === 0) return 0;
    if (modoCalculoSetup === 'valor_fixo') return valorFixoSetup;
    const divisor = 1 - 0.06 - 0.05 - 0.05 - (margemSetup / 100);
    if (divisor <= 0) return 0;
    return custoTotalSetup / divisor;
  }, [custoTotalSetup, margemSetup, modoCalculoSetup, valorFixoSetup]);

  // Margem derivada no modo valor fixo
  const margemEfetiva = useMemo(() => {
    if (modoCalculoSetup === 'margem') return margemSetup;
    if (valorFixoSetup <= 0 || custoTotalSetup <= 0) return 0;
    return (1 - (custoTotalSetup / valorFixoSetup) - 0.06 - 0.05 - 0.05) * 100;
  }, [modoCalculoSetup, margemSetup, valorFixoSetup, custoTotalSetup]);

  const validacaoMargemSetup = validarMargemPorTipo(margemEfetiva, 'Setup');

  // Carregar dados se editando
  useEffect(() => {
    if (orcamentoExistente) {
      setTipoOrcamento(orcamentoExistente.tipo_orcamento || 'novo_produtor');
      setNomeCliente(orcamentoExistente.nome_cliente);
      setConsultorResponsavel(orcamentoExistente.consultor_responsavel || '');
      setValidadeDias(orcamentoExistente.validade_dias);
      setObservacoes(orcamentoExistente.observacoes || '');
      setItensProducao(orcamentoExistente.itens_producao || []);
      setCondicoesPagamento(orcamentoExistente.condicoes_pagamento || {});
      if (orcamentoExistente.dados_cliente) {
        setDadosClienteTemp(orcamentoExistente.dados_cliente);
      }
      if (orcamentoExistente.detalhamento_frete) {
        setDetalhamentoFreteTemp(orcamentoExistente.detalhamento_frete);
      }
      // Restore setup from servicos_marca
      const setupServico = (orcamentoExistente.servicos_marca || []).find(
        (s: any) => s.nome_plano === 'Setup'
      );
      if (setupServico) {
        const detalhes = (setupServico as any).setup_detalhes;
        if (detalhes) {
          if (detalhes.items) setSetupItems(detalhes.items);
          if (detalhes.impressao_selecionado !== undefined) setSetupImpressaoSelecionado(detalhes.impressao_selecionado);
          if (detalhes.impressao_itens) setSetupImpressaoItens(detalhes.impressao_itens);
          if (detalhes.margem !== undefined) setMargemSetup(detalhes.margem);
          if (detalhes.modo_calculo) setModoCalculoSetup(detalhes.modo_calculo);
          if (detalhes.valor_fixo !== undefined) setValorFixoSetup(detalhes.valor_fixo);
        }
      }
    }
  }, [orcamentoExistente]);

  // Cálculos
  const subtotalProducao = itensProducao.reduce((acc, item) => acc + item.subtotal, 0);
  const subtotalServicos = precoVendaSetup;
  const valorTotal = subtotalProducao + subtotalServicos;

  // Build servicos_marca for saving
  const buildServicosMarca = (): ServicoMarca[] => {
    if (custoTotalSetup === 0) return [];
    const entregaveis: Entregavel[] = [];
    setupItems.filter(i => i.selecionado).forEach(item => {
      entregaveis.push({ nome: `${item.nome} (${item.quantidade}x)`, incluso: true, quantidade: item.quantidade });
    });
    if (setupImpressaoSelecionado) {
      setupImpressaoItens.forEach(item => {
        entregaveis.push({ nome: `Impressão de rótulos - ${item.tipoProduto} (${item.quantidade}x)`, incluso: true, quantidade: item.quantidade });
      });
    }
    return [{
      nome_plano: 'Setup',
      descricao: 'Serviços de setup para início da produção',
      valor: precoVendaSetup,
      entregaveis,
      setup_detalhes: {
        items: setupItems,
        impressao_selecionado: setupImpressaoSelecionado,
        impressao_itens: setupImpressaoItens,
        margem: margemEfetiva,
        custo_total: custoTotalSetup,
        modo_calculo: modoCalculoSetup,
        valor_fixo: valorFixoSetup,
      },
    } as any];
  };

  // Handlers
  const handleAddPrecificacoes = async () => {
    const novasItems: ItemProducao[] = await Promise.all(
      selectedPrecificacoes.map(async (precId) => {
        const prec = (precificacoes as any[])?.find(p => p.id === precId);
        
        let insumos_formula: InsumoSnapshot[] = [];
        const formulaData: Record<string, any> = {};

        if (prec?.formula_id) {
          const { data: formula } = await supabase
            .from('formulas')
            .select('itens, tipo_produto, quantidade_por_pote, unidades_por_dose, unidade_soluvel')
            .eq('id', prec.formula_id)
            .maybeSingle();
          
          if (formula?.itens && Array.isArray(formula.itens)) {
            insumos_formula = (formula.itens as any[]).map(item => ({
              nome: item.nome_insumo_snapshot || '',
              quantidade: item.qtd_informada || 0,
              unidade: item.unidade_informada || '',
            }));
          }

          if (formula) {
            const deriveUnidade = (tipo: string, unidadeSoluvel?: string | null): string => {
              switch (tipo) {
                case 'Encapsulados': return 'capsulas';
                case 'Gummy': return 'gummies';
                case 'Líquido': return 'ml';
                case 'Solúvel': return unidadeSoluvel || 'g';
                default: return 'capsulas';
              }
            };

            const tipoProd = formula.tipo_produto || '';
            const qtdPote = Number(formula.quantidade_por_pote) || undefined;
            const qtdDose = Number(formula.unidades_por_dose) || undefined;
            const unidade = deriveUnidade(tipoProd, formula.unidade_soluvel);
            const qtdDoses = qtdPote && qtdDose ? Math.floor(qtdPote / qtdDose) : undefined;
            const doseTexto = qtdDose ? `${qtdDose} ${unidade}/dia` : undefined;

            Object.assign(formulaData, {
              tipo_produto: tipoProd,
              quantidade_por_pote: qtdPote,
              unidade_por_pote: unidade,
              quantidade_por_dose: qtdDose,
              unidade_por_dose: unidade,
              quantidade_doses: qtdDoses,
              dose_diaria_sugerida: doseTexto,
            });
          }
        }

        return {
          tipo: 'precificacao' as const,
          precificacao_id: precId,
          nome_produto: prec?.formulas?.nome_formula || 'Produto',
          segmento: prec?.formulas?.tipo_produto || '',
          preco_unitario: Number(prec?.preco_venda) || 0,
          quantidade: 1,
          subtotal: Number(prec?.preco_venda) || 0,
          insumos_formula,
          ...formulaData,
        } as ItemProducao;
      })
    );
    
    setItensProducao(prev => [...prev, ...novasItems]);
    setSelectedPrecificacoes([]);
    setShowPrecificacaoSelector(false);
  };

  const handleUpdateItemQuantidade = (index: number, quantidade: number) => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantidade,
          subtotal: item.modelo_negocio === 'print_on_demand' ? 0 : item.preco_unitario * quantidade,
        };
      }
      return item;
    }));
  };

  const handleUpdateModeloNegocio = (index: number, modelo: 'estoque' | 'print_on_demand') => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        const quantidade = modelo === 'print_on_demand' ? 0 : (item.quantidade || 1);
        return {
          ...item,
          modelo_negocio: modelo,
          quantidade,
          subtotal: modelo === 'print_on_demand' ? 0 : item.preco_unitario * quantidade,
        };
      }
      return item;
    }));
  };

  const handleUpdateItemField = (index: number, field: keyof ItemProducao, value: any) => {
    setItensProducao(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (index: number) => {
    setItensProducao(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!nomeCliente.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const hasDadosCliente = Object.values(dadosClienteTemp).some(v => v && v.toString().trim() !== '');
      const hasCondicoesPagamento = Object.values(condicoesPagamento).some(v => v !== undefined && v !== null && v !== '');
      const servicosMarcaFinal = buildServicosMarca();
      
      if (orcamentoExistente) {
        await updateOrcamento.mutateAsync({
          id: orcamentoExistente.id,
          updates: {
            nome_cliente: nomeCliente,
            consultor_responsavel: consultorResponsavel,
            tipo_orcamento: tipoOrcamento,
            validade_dias: validadeDias,
            observacoes,
            itens_producao: itensProducao,
            servicos_marca: servicosMarcaFinal,
            subtotal_producao: subtotalProducao,
            subtotal_servicos: subtotalServicos,
            valor_total: valorTotal,
            ...(hasDadosCliente && { dados_cliente: dadosClienteTemp }),
            ...(detalhamentoFreteTemp && { detalhamento_frete: detalhamentoFreteTemp }),
            ...(hasCondicoesPagamento && { condicoes_pagamento: condicoesPagamento }),
          },
        });
      } else {
        const numeroOrcamento = await getNextNumeroOrcamento();
        const novoOrcamento: OrcamentoInsert = {
          numero_orcamento: numeroOrcamento,
          nome_cliente: nomeCliente,
          consultor_responsavel: consultorResponsavel,
          tipo_orcamento: tipoOrcamento,
          validade_dias: validadeDias,
          observacoes,
          itens_producao: itensProducao,
          servicos_marca: servicosMarcaFinal,
          subtotal_producao: subtotalProducao,
          subtotal_servicos: subtotalServicos,
          valor_total: valorTotal,
          status: 'rascunho',
          ...(hasDadosCliente && { dados_cliente: dadosClienteTemp }),
          ...(detalhamentoFreteTemp && { detalhamento_frete: detalhamentoFreteTemp }),
          ...(hasCondicoesPagamento && { condicoes_pagamento: condicoesPagamento }),
        };
        
        await createOrcamento.mutateAsync(novoOrcamento);
      }
      
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (step === 1) return nomeCliente.trim().length > 0 && consultorResponsavel.trim().length > 0;
    if (step === 2) return itensProducao.length > 0;
    if (step === 3) {
      // Block if margin is below minimum and not unlocked
      if (custoTotalSetup > 0 && validacaoMargemSetup.status === 'baixa' && !setupMargemLiberada) return false;
    }
    return true;
  };

  // Precificações disponíveis
  const precificacoesDisponiveis = (precificacoes as any[])?.filter(p => {
    if (itensProducao.some(item => item.precificacao_id === p.id)) return false;
    
    if (buscaPrecificacao.trim()) {
      const termo = buscaPrecificacao.toLowerCase();
      const nomeFormula = (p.formulas?.nome_formula || '').toLowerCase();
      const cliente = (p.formulas?.cliente || '').toLowerCase();
      return nomeFormula.includes(termo) || cliente.includes(termo);
    }
    return true;
  }) || [];

  const isMargemBaixa = (p: any) => {
    const tipoProduto = p.formulas?.tipo_produto || 'Encapsulados';
    const margem = Number(p.margem_lucro_percentual);
    const validacao = validarMargemPorTipo(margem, tipoProduto);
    return validacao.status === 'baixa';
  };

  const handleSetupSenhaConfirm = () => {
    if (senhaSetupInput === SENHA_LIBERACAO_MARGEM) {
      setSetupMargemLiberada(true);
      setSenhaSetupDialog(false);
      setSenhaSetupInput('');
      toast.success('Margem de setup liberada!');
    } else {
      toast.error('Senha incorreta!');
      setSenhaSetupInput('');
    }
  };

  const handleImpressaoSenhaConfirm = () => {
    if (senhaImpressaoInput === SENHA_LIBERACAO_MARGEM) {
      setImpressaoEdicaoLiberada(true);
      setSenhaImpressaoDialog(false);
      setSenhaImpressaoInput('');
      toast.success('Edição de custos de impressão liberada!');
    } else {
      toast.error('Senha incorreta!');
      setSenhaImpressaoInput('');
    }
  };

  return (
    <>
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {orcamentoExistente ? 'Editar Orçamento' : 'Gerar Orçamento'} - Passo {step} de 5
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* STEP 1: Informações Básicas */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Tipo de Orçamento */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipo de Orçamento *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoOrcamento('novo_produtor')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                      tipoOrcamento === 'novo_produtor'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <User className="w-4 h-4" />
                    Novo Produtor
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoOrcamento('recompra')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                      tipoOrcamento === 'recompra'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-400'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <Package className="w-4 h-4" />
                    Recompra
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultor" className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4" />
                  Consultor Responsável *
                </Label>
                <ConsultorCombobox
                  value={consultorResponsavel}
                  onChange={setConsultorResponsavel}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente">Nome do Cliente *</Label>
                <Input
                  id="cliente"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Ex: Farmácia ABC"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="validade">Validade (dias)</Label>
                <Input
                  id="validade"
                  type="number"
                  min={1}
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(parseInt(e.target.value) || 30)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Itens de Produção */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Custos de Produção
                </h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPrecificacaoSelector(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Precificação Salva
                  </Button>
                </div>
              </div>

              {/* Seletor de Precificações */}
              {showPrecificacaoSelector && (
                <Card className="border-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Selecionar Precificações</Label>
                      <Button variant="ghost" size="sm" onClick={() => { setShowPrecificacaoSelector(false); setBuscaPrecificacao(''); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <Input
                      value={buscaPrecificacao}
                      onChange={(e) => setBuscaPrecificacao(e.target.value)}
                      placeholder="Buscar por fórmula ou cliente..."
                      className="h-9"
                    />
                    
                    {precificacoesDisponiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma precificação disponível.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {precificacoesDisponiveis.map((prec: any) => {
                          const margemBaixa = isMargemBaixa(prec);
                          const liberada = margemOrcLiberadaIds.includes(prec.id);
                          return (
                            <label 
                              key={prec.id}
                              className={cn(
                                "flex items-center gap-3 p-2 border rounded-lg hover:bg-muted cursor-pointer",
                                margemBaixa && !liberada && "border-destructive/50 bg-destructive/5"
                              )}
                            >
                              <Checkbox
                                checked={selectedPrecificacoes.includes(prec.id)}
                                onCheckedChange={(checked) => {
                                  if (checked && margemBaixa && !liberada) {
                                    setSenhaMargemOrcDialog(true);
                                    (window as any).__pendingMargemPrecId = prec.id;
                                    return;
                                  }
                                  if (checked) {
                                    setSelectedPrecificacoes(prev => [...prev, prec.id]);
                                  } else {
                                    setSelectedPrecificacoes(prev => prev.filter(id => id !== prec.id));
                                  }
                                }}
                              />
                              <div className="flex-1">
                                <p className="font-medium text-sm">{prec.formulas?.nome_formula}</p>
                                <p className="text-xs text-muted-foreground">{prec.formulas?.cliente}</p>
                              </div>
                              {margemBaixa && !liberada && (
                                <Badge variant="destructive" className="text-xs">Margem baixa</Badge>
                              )}
                              {margemBaixa && liberada && (
                                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Liberada</Badge>
                              )}
                              <Badge variant="secondary">{prec.formulas?.tipo_produto}</Badge>
                              <span className="font-semibold">{formatCurrency(Number(prec.preco_venda))}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    {selectedPrecificacoes.length > 0 && (
                      <Button onClick={handleAddPrecificacoes} className="w-full">
                        <Check className="w-4 h-4 mr-2" />
                        Adicionar {selectedPrecificacoes.length} item(ns)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Lista de Itens */}
              {itensProducao.length === 0 ? (
                <div className="py-8 text-center border rounded-lg bg-muted/30">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum produto adicionado.</p>
                  <p className="text-xs text-destructive mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Adicione pelo menos um produto para continuar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {itensProducao.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{item.nome_produto}</p>
                              <Badge variant={item.tipo === 'precificacao' ? 'default' : 'outline'} className="text-xs">
                                {item.tipo === 'precificacao' ? 'Salvo' : 'Avulso'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.segmento}</p>
                          </div>
                          
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">{formatCurrency(item.preco_unitario)}/un</p>
                          </div>

                          <div className="flex rounded-lg border overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateModeloNegocio(index, 'estoque')}
                              className={cn(
                                'px-2.5 py-1 text-xs font-medium transition-all',
                                item.modelo_negocio !== 'print_on_demand'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              )}
                            >
                              Estoque
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateModeloNegocio(index, 'print_on_demand')}
                              className={cn(
                                'px-2.5 py-1 text-xs font-medium transition-all',
                                item.modelo_negocio === 'print_on_demand'
                                  ? 'bg-purple-600 text-white'
                                  : 'hover:bg-muted'
                              )}
                            >
                              POD
                            </button>
                          </div>
                          
                          {item.modelo_negocio !== 'print_on_demand' ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                className="w-20"
                                value={item.quantidade}
                                onChange={(e) => handleUpdateItemQuantidade(index, parseInt(e.target.value) || 1)}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Qtd: 0</span>
                          )}
                          
                          <div className="text-right min-w-[100px]">
                            <p className="font-semibold">
                              {item.modelo_negocio === 'print_on_demand' ? 'R$ 0,00' : formatCurrency(item.subtotal)}
                            </p>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>

                        {item.modelo_negocio !== 'print_on_demand' && (
                          <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Qtd por Pote</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantidade_por_pote || ''}
                                onChange={(e) => handleUpdateItemField(index, 'quantidade_por_pote', parseInt(e.target.value) || undefined)}
                                placeholder="60"
                                readOnly={item.tipo === 'precificacao'}
                                disabled={item.tipo === 'precificacao'}
                                className={item.tipo === 'precificacao' ? 'bg-muted cursor-not-allowed' : ''}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Unidade</Label>
                              {item.tipo === 'precificacao' ? (
                                <Input
                                  value={item.unidade_por_pote === 'capsulas' ? 'Cápsulas' : item.unidade_por_pote === 'gummies' ? 'Gummies' : item.unidade_por_pote === 'ml' ? 'ML' : item.unidade_por_pote === 'g' ? 'Gramas' : item.unidade_por_pote || ''}
                                  readOnly
                                  disabled
                                  className="bg-muted cursor-not-allowed"
                                />
                              ) : (
                                <Select
                                  value={item.unidade_por_pote || ''}
                                  onValueChange={(value) => handleUpdateItemField(index, 'unidade_por_pote', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="capsulas">Cápsulas</SelectItem>
                                    <SelectItem value="gummies">Gummies</SelectItem>
                                    <SelectItem value="ml">ML</SelectItem>
                                    <SelectItem value="g">Gramas</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Qtd por Dose</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantidade_por_dose || ''}
                                onChange={(e) => handleUpdateItemField(index, 'quantidade_por_dose', parseInt(e.target.value) || undefined)}
                                placeholder="2"
                                readOnly={item.tipo === 'precificacao'}
                                disabled={item.tipo === 'precificacao'}
                                className={item.tipo === 'precificacao' ? 'bg-muted cursor-not-allowed' : ''}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Total Doses</Label>
                              <Input
                                type="number"
                                value={item.quantidade_doses || ''}
                                readOnly
                                disabled
                                className="bg-muted cursor-not-allowed"
                                placeholder="—"
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Subtotal */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal Produção</p>
                  <p className="text-xl font-bold">{formatCurrency(subtotalProducao)}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Custo de Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Custo de Setup
              </h3>
              <p className="text-sm text-muted-foreground">
                Selecione os itens de setup e ajuste as quantidades. As quantidades são pré-preenchidas com base nos produtos adicionados.
              </p>

              {/* Setup items */}
              <div className="space-y-2">
                {setupItems.map((item, idx) => (
                  <Card key={item.id} className={cn(item.selecionado && 'border-primary')}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={item.selecionado}
                          onCheckedChange={(checked) => {
                            setSetupItems(prev => prev.map((si, i) =>
                              i === idx ? { ...si, selecionado: !!checked } : si
                            ));
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.custoUnitario)}/un</p>
                        </div>
                        {item.selecionado && (
                          <>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={item.quantidade}
                              onChange={(e) => {
                                setSetupItems(prev => prev.map((si, i) =>
                                  i === idx ? { ...si, quantidade: parseInt(e.target.value) || 0 } : si
                                ));
                              }}
                            />
                            <span className="text-sm font-semibold min-w-[80px] text-right">
                              {formatCurrency(item.custoUnitario * item.quantidade)}
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Impressão de rótulos */}
                <Card className={cn(setupImpressaoSelecionado && 'border-primary')}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={setupImpressaoSelecionado}
                        onCheckedChange={(checked) => setSetupImpressaoSelecionado(!!checked)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Impressão de rótulos</p>
                        <p className="text-xs text-muted-foreground">Custo varia por tipo de produto</p>
                      </div>
                      {setupImpressaoSelecionado && !impressaoEdicaoLiberada && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSenhaImpressaoDialog(true)}
                          title="Editar custos de impressão (requer senha)"
                        >
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      {setupImpressaoSelecionado && impressaoEdicaoLiberada && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <LockOpen className="w-3 h-3" />
                          Editável
                        </Badge>
                      )}
                    </div>

                    {setupImpressaoSelecionado && setupImpressaoItens.length > 0 && (
                      <div className="ml-7 space-y-2 border-l-2 border-primary/20 pl-3">
                        {setupImpressaoItens.map((imp, idx) => (
                          <div key={imp.tipoProduto} className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="text-sm">{imp.tipoProduto}</p>
                              {impressaoEdicaoLiberada ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">R$</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={10}
                                    className="w-24 h-6 text-xs"
                                    value={imp.custoUnitario}
                                    onChange={(e) => {
                                      setSetupImpressaoItens(prev => prev.map((si, i) =>
                                        i === idx ? { ...si, custoUnitario: parseFloat(e.target.value) || 0 } : si
                                      ));
                                    }}
                                  />
                                  <span className="text-xs text-muted-foreground">/un</span>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">{formatCurrency(imp.custoUnitario)}/un</p>
                              )}
                            </div>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={imp.quantidade}
                              onChange={(e) => {
                                setSetupImpressaoItens(prev => prev.map((si, i) =>
                                  i === idx ? { ...si, quantidade: parseInt(e.target.value) || 0 } : si
                                ));
                              }}
                            />
                            <span className="text-sm font-semibold min-w-[80px] text-right">
                              {formatCurrency(imp.custoUnitario * imp.quantidade)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {setupImpressaoSelecionado && setupImpressaoItens.length === 0 && (
                      <p className="ml-7 text-xs text-muted-foreground">
                        Nenhum produto adicionado no passo anterior.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Custo total e margem */}
              {custoTotalSetup > 0 && (() => {
                const taxaAntecipacao = precoVendaSetup * 0.06;
                const impostoSetup = precoVendaSetup * 0.05;
                const comissaoSetup = precoVendaSetup * 0.05;
                const margemLucroValor = precoVendaSetup * (margemEfetiva / 100);

                return (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      {/* Detalhamento do Custo */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Detalhamento do Custo</h4>
                        {setupItems.filter(si => si.selecionado && si.quantidade > 0).map((si, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{si.nome} ({si.quantidade}x)</span>
                            <span>{formatCurrency(si.custoUnitario * si.quantidade)}</span>
                          </div>
                        ))}
                        {setupImpressaoSelecionado && setupImpressaoItens.filter(si => si.quantidade > 0).map((si, idx) => (
                          <div key={`imp-${idx}`} className="flex justify-between text-sm">
                            <span>Impressão - {si.tipoProduto} ({si.quantidade}x)</span>
                            <span>{formatCurrency(si.custoUnitario * si.quantidade)}</span>
                          </div>
                        ))}
                        <Separator className="my-2" />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Custo Total do Setup</span>
                          <span>{formatCurrency(custoTotalSetup)}</span>
                        </div>
                      </div>

                      {/* Modo de Cálculo Toggle */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Modo de Cálculo</Label>
                        <div className="flex rounded-lg border overflow-hidden w-fit">
                          <button
                            type="button"
                            onClick={() => {
                              setModoCalculoSetup('margem');
                              setSetupMargemLiberada(false);
                            }}
                            className={cn(
                              'px-4 py-2 text-sm font-medium transition-all',
                              modoCalculoSetup === 'margem'
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            Margem %
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModoCalculoSetup('valor_fixo');
                              setValorFixoSetup(precoVendaSetup > 0 ? Math.round(precoVendaSetup * 100) / 100 : 0);
                              setSetupMargemLiberada(false);
                            }}
                            className={cn(
                              'px-4 py-2 text-sm font-medium transition-all',
                              modoCalculoSetup === 'valor_fixo'
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )}
                          >
                            Valor Fixo R$
                          </button>
                        </div>

                        {modoCalculoSetup === 'margem' ? (
                          <div className="space-y-2">
                            <Label className="text-sm">Margem de Lucro (%)</Label>
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                min={0}
                                max={90}
                                step={0.5}
                                className={cn("w-24", validacaoMargemSetup.borderColor && `border-2 ${validacaoMargemSetup.borderColor}`)}
                                value={margemSetup}
                                onChange={(e) => {
                                  setMargemSetup(parseFloat(e.target.value) || 0);
                                  setSetupMargemLiberada(false);
                                }}
                              />
                              <span className="text-sm">%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-sm">Valor cobrado de Setup (R$)</Label>
                            <div className="flex items-center gap-3">
                              <span className="text-sm">R$</span>
                              <Input
                                type="number"
                                min={0}
                                step={100}
                                className={cn("w-36", validacaoMargemSetup.borderColor && `border-2 ${validacaoMargemSetup.borderColor}`)}
                                value={valorFixoSetup}
                                onChange={(e) => {
                                  setValorFixoSetup(parseFloat(e.target.value) || 0);
                                  setSetupMargemLiberada(false);
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Margem resultante: <span className="font-semibold">{margemEfetiva.toFixed(1)}%</span>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className={cn(
                        'p-2 rounded-lg text-sm',
                        validacaoMargemSetup.bgColor === 'gold-shimmer' ? 'gold-shimmer' : validacaoMargemSetup.bgColor,
                        validacaoMargemSetup.color
                      )}>
                        {validacaoMargemSetup.mensagem}
                      </div>

                      {validacaoMargemSetup.status === 'baixa' && !setupMargemLiberada && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive text-destructive"
                          onClick={() => setSenhaSetupDialog(true)}
                        >
                          Liberar com senha
                        </Button>
                      )}

                      {/* Composição do Preço de Venda */}
                      <div className="space-y-1 pt-2">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Composição do Preço de Venda</h4>
                        <div className="flex justify-between text-sm">
                          <span>Custo Base</span>
                          <span>{formatCurrency(custoTotalSetup)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Taxa de Antecipação (6%)</span>
                          <span>{formatCurrency(taxaAntecipacao)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Imposto (5%)</span>
                          <span>{formatCurrency(impostoSetup)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Comissão (5%)</span>
                          <span>{formatCurrency(comissaoSetup)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Margem de Lucro ({margemEfetiva.toFixed(1)}%)</span>
                          <span>{formatCurrency(margemLucroValor)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center font-semibold text-base">
                          <span>Preço de Venda do Setup</span>
                          <span className="text-xl font-bold">{formatCurrency(precoVendaSetup)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {custoTotalSetup === 0 && (
                <div className="py-6 text-center border rounded-lg bg-muted/30">
                  <Settings2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Selecione pelo menos um item de setup acima.</p>
                  <p className="text-xs text-muted-foreground mt-1">(Esta seção é opcional)</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Condições de Pagamento */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Condições de Pagamento</h3>

              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex justify-between text-sm">
                    <span>Valor Total do Orçamento</span>
                    <span className="font-bold text-lg">{formatCurrency(valorTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              <CondicoesPagamentoForm
                value={condicoesPagamento}
                onChange={setCondicoesPagamento}
                valorTotal={valorTotal}
                isRequired={false}
              />
            </div>
          )}

          {/* STEP 5: Resumo */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resumo do Orçamento</h3>
              
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Consultor Responsável</p>
                      <p className="font-semibold">{consultorResponsavel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="font-semibold">{nomeCliente}</p>
                    </div>
                  </div>

                  {itensProducao.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">PRODUÇÃO</p>
                      <div className="space-y-1">
                        {itensProducao.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>• {item.nome_produto} ({item.quantidade}un)</span>
                            <span>{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium pt-1 border-t">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(subtotalProducao)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {precoVendaSetup > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">SETUP</p>
                      <div className="space-y-1">
                        {setupItems.filter(i => i.selecionado).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>• {item.nome} ({item.quantidade}x)</span>
                            <span>{formatCurrency(item.custoUnitario * item.quantidade)}</span>
                          </div>
                        ))}
                        {setupImpressaoSelecionado && setupImpressaoItens.map((item, index) => (
                          <div key={`imp-${index}`} className="flex justify-between text-sm">
                            <span>• Impressão - {item.tipoProduto} ({item.quantidade}x)</span>
                            <span>{formatCurrency(item.custoUnitario * item.quantidade)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                          <span>Custo total setup:</span>
                          <span>{formatCurrency(custoTotalSetup)}</span>
                        </div>
                        <div className="flex justify-between font-medium pt-1 border-t">
                          <span>Preço de Venda Setup (margem {margemSetup}%):</span>
                          <span>{formatCurrency(precoVendaSetup)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Total */}
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg">VALOR TOTAL DO ORÇAMENTO</span>
                    <span className="text-2xl font-bold">{formatCurrency(valorTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              {observacoes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{observacoes}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Validade: {validadeDias} dias a partir da emissão
              </p>

              {/* Seção opcional de Info Cliente e Frete */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Adicionar informações (opcional):
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <Button 
                      variant={Object.values(dadosClienteTemp).some(v => v && v.toString().trim() !== '') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowInfoClienteInline(!showInfoClienteInline)}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Info Cliente
                      {Object.values(dadosClienteTemp).some(v => v && v.toString().trim() !== '') && (
                        <Check className="w-3 h-3 ml-1" />
                      )}
                    </Button>
                    <Button 
                      variant={detalhamentoFreteTemp ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowFreteInline(!showFreteInline)}
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Frete
                      {detalhamentoFreteTemp && (
                        <Check className="w-3 h-3 ml-1" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Esses dados podem ser adicionados depois na tela de orçamentos
                  </p>
                </CardContent>
              </Card>

              {/* Form inline de Info Cliente */}
              {showInfoClienteInline && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Informações do Cliente
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setShowInfoClienteInline(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome Completo</Label>
                        <Input
                          value={dadosClienteTemp.nome_completo || ''}
                          onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, nome_completo: e.target.value }))}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          value={dadosClienteTemp.email || ''}
                          onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telefone</Label>
                        <Input
                          value={dadosClienteTemp.telefone || ''}
                          onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, telefone: e.target.value }))}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CPF</Label>
                        <Input
                          value={dadosClienteTemp.cpf || ''}
                          onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, cpf: e.target.value }))}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CNPJ</Label>
                        <Input
                          value={dadosClienteTemp.cnpj || ''}
                          onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, cnpj: e.target.value }))}
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Razão Social</Label>
                        <Input
                          value={dadosClienteTemp.razao_social || ''}
                          onChange={(e) => setDadosClienteTemp(prev => ({ ...prev, razao_social: e.target.value }))}
                          placeholder="Razão social"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Form inline de Frete */}
              {showFreteInline && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Detalhamento de Frete
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setShowFreteInline(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <Label className="text-sm">Frete via Lemon Caps?</Label>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant={detalhamentoFreteTemp?.frete_lemon_caps === true ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDetalhamentoFreteTemp(prev => ({
                              frete_lemon_caps: true,
                              usa_tabela_tradicional: prev?.usa_tabela_tradicional ?? true,
                              planos_customizados: prev?.planos_customizados ?? [],
                            }))}
                          >
                            Sim
                          </Button>
                          <Button
                            type="button"
                            variant={detalhamentoFreteTemp?.frete_lemon_caps === false ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDetalhamentoFreteTemp(prev => ({
                              frete_lemon_caps: false,
                              usa_tabela_tradicional: false,
                              planos_customizados: prev?.planos_customizados ?? [],
                            }))}
                          >
                            Não
                          </Button>
                        </div>
                      </div>

                      {detalhamentoFreteTemp?.frete_lemon_caps && (
                        <div className="flex items-center gap-4">
                          <Label className="text-sm">Tabela tradicional?</Label>
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant={detalhamentoFreteTemp.usa_tabela_tradicional ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setDetalhamentoFreteTemp(prev => prev ? ({
                                ...prev,
                                usa_tabela_tradicional: true,
                              }) : null)}
                            >
                              Sim
                            </Button>
                            <Button
                              type="button"
                              variant={!detalhamentoFreteTemp.usa_tabela_tradicional ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setDetalhamentoFreteTemp(prev => prev ? ({
                                ...prev,
                                usa_tabela_tradicional: false,
                              }) : null)}
                            >
                              Não
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </Button>

            {step < 5 ? (
              <Button
                onClick={() => {
                  if (step === 2 && itensProducao.length === 0) {
                    toast.error('Adicione pelo menos um produto para continuar.');
                    return;
                  }
                  if (step === 3 && custoTotalSetup > 0 && validacaoMargemSetup.status === 'baixa' && !setupMargemLiberada) {
                    toast.error('Margem de setup abaixo do mínimo. Libere com senha para continuar.');
                    return;
                  }
                  setStep(step + 1);
                }}
                disabled={!canGoNext()}
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || valorTotal === 0}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {orcamentoExistente ? 'Salvar Alterações' : 'Salvar Orçamento'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de senha para liberação de margem no orçamento */}
    <Dialog open={senhaMargemOrcDialog} onOpenChange={setSenhaMargemOrcDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Liberar margem abaixo do mínimo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Esta precificação possui margem abaixo do mínimo permitido. Digite a senha para liberá-la.
        </p>
        <Input
          type="password"
          placeholder="Digite a senha..."
          value={senhaMargemOrcInput}
          onChange={(e) => setSenhaMargemOrcInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (senhaMargemOrcInput === SENHA_LIBERACAO_MARGEM) {
                const pendingId = (window as any).__pendingMargemPrecId;
                if (pendingId) {
                  setMargemOrcLiberadaIds(prev => [...prev, pendingId]);
                  setSelectedPrecificacoes(prev => [...prev, pendingId]);
                  delete (window as any).__pendingMargemPrecId;
                }
                setSenhaMargemOrcDialog(false);
                setSenhaMargemOrcInput('');
                toast.success('Precificação liberada!');
              } else {
                toast.error('Senha incorreta!');
                setSenhaMargemOrcInput('');
              }
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setSenhaMargemOrcDialog(false); setSenhaMargemOrcInput(''); }}>
            Cancelar
          </Button>
          <Button onClick={() => {
            if (senhaMargemOrcInput === SENHA_LIBERACAO_MARGEM) {
              const pendingId = (window as any).__pendingMargemPrecId;
              if (pendingId) {
                setMargemOrcLiberadaIds(prev => [...prev, pendingId]);
                setSelectedPrecificacoes(prev => [...prev, pendingId]);
                delete (window as any).__pendingMargemPrecId;
              }
              setSenhaMargemOrcDialog(false);
              setSenhaMargemOrcInput('');
              toast.success('Precificação liberada!');
            } else {
              toast.error('Senha incorreta!');
              setSenhaMargemOrcInput('');
            }
          }}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de senha para liberação de margem do setup */}
    <Dialog open={senhaSetupDialog} onOpenChange={setSenhaSetupDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Liberar margem de setup abaixo do mínimo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A margem de setup está abaixo do mínimo de 15%. Digite a senha para liberar.
        </p>
        <Input
          type="password"
          placeholder="Digite a senha..."
          value={senhaSetupInput}
          onChange={(e) => setSenhaSetupInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSetupSenhaConfirm();
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setSenhaSetupDialog(false); setSenhaSetupInput(''); }}>
            Cancelar
          </Button>
          <Button onClick={handleSetupSenhaConfirm}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
