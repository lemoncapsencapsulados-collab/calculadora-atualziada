import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/unitConversion';
import { arredondarReais } from '@/lib/utils';
import { useFormulas } from '@/hooks/useFormulas';
import { useConfiguracaoCustos } from '@/hooks/useConfiguracaoCustos';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { Formula } from '@/types/formula';
import {
  calcularPrecificacaoPorPreco,
  validarMargemPorTipo,
} from '@/lib/precificacaoCalculator';
import { PrecificacaoCalculada } from '@/types/precificacao';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Lock, Unlock, Save, Search, Package, Calculator, FileText, Sparkles, Star, Trash2, Download, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import PrecificacoesSalvas from '@/components/PrecificacoesSalvas';
import { VerFormulaDialog } from '@/components/VerFormulaDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Precificacao() {
  const { formulas, loading: loadingFormulas, deleteFormula, updateFormula } = useFormulas();
  const { configuracaoAtiva, margens, verificarSenha, updateConfiguracao } = useConfiguracaoCustos();
  const { salvarPrecificacao } = usePrecificacao();

  // Estado da aba ativa
  const [abaAtiva, setAbaAtiva] = useState('produtos');

  // Busca e filtros para "Produtos Criados"
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');

  // Estados principais de precificação
  const [formulaSelecionada, setFormulaSelecionada] = useState<Formula | null>(null);
  const [modalAberta, setModalAberta] = useState(false);
  const [valorInput, setValorInput] = useState('30');
  const [observacoes, setObservacoes] = useState('');

  // Estados de custos editáveis
  const [custosIndiretos, setCustosIndiretos] = useState({
    maoObraDireta: 0,
    energia: 0,
    depreciacao: 0,
    administrativo: 0,
  });

  // Estados de bloqueio
  const [camposBloqueados, setCamposBloqueados] = useState(true);
  const [senhaDialog, setSenhaDialog] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [salvarPermanente, setSalvarPermanente] = useState(false);

  // Estado de cálculo
  const [resultado, setResultado] = useState<PrecificacaoCalculada | null>(null);

  // Carregar custos da configuração ativa
  useEffect(() => {
    if (configuracaoAtiva) {
      setCustosIndiretos({
        maoObraDireta: Number(configuracaoAtiva.mao_obra_direta),
        energia: Number(configuracaoAtiva.energia_eletrica),
        depreciacao: Number(configuracaoAtiva.depreciacao_maquinas),
        administrativo: Number(configuracaoAtiva.despesas_administrativas),
      });
    }
  }, [configuracaoAtiva]);

  // Recalcular quando mudar inputs
  useEffect(() => {
    if (!formulaSelecionada || !configuracaoAtiva || !valorInput) {
      setResultado(null);
      return;
    }

    const valor = parseFloat(valorInput);
    if (isNaN(valor) || valor <= 0) {
      setResultado(null);
      return;
    }

    const custosBase = {
      custoMateriaPrima: Number(formulaSelecionada.total_mp),
      custoEmbalagem: Number(formulaSelecionada.total_embalagem),
    };

    try {
      const calc = calcularPrecificacaoPorPreco(custosBase, custosIndiretos, valor, configuracaoAtiva);
      setResultado(calc);
    } catch (error) {
      console.error('Erro ao calcular:', error);
      setResultado(null);
    }
  }, [formulaSelecionada, configuracaoAtiva, custosIndiretos, valorInput]);

  // Filtro de fórmulas
  const filteredFormulas = useMemo(() => {
    return formulas.filter((formula) => {
      const matchesSearch =
        formula.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formula.nome_formula.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo = filterTipo === 'Todos' || formula.tipo_produto === filterTipo;
      return matchesSearch && matchesTipo;
    });
  }, [formulas, searchTerm, filterTipo]);

  const handleDesbloquear = () => {
    setSenhaDialog(true);
  };

  const handleVerificarSenha = () => {
    if (verificarSenha(senhaInput)) {
      setCamposBloqueados(false);
      setSenhaDialog(false);
      setSenhaInput('');
      toast.success('Campos desbloqueados!');
    } else {
      toast.error('Senha incorreta!');
    }
  };

  const handleBloquear = async () => {
    if (salvarPermanente && configuracaoAtiva) {
      try {
        await updateConfiguracao.mutateAsync({
          id: configuracaoAtiva.id,
          mao_obra_direta: custosIndiretos.maoObraDireta,
          energia_eletrica: custosIndiretos.energia,
          depreciacao_maquinas: custosIndiretos.depreciacao,
          despesas_administrativas: custosIndiretos.administrativo,
        });
        toast.success('Alterações salvas permanentemente!');
      } catch (error) {
        toast.error('Erro ao salvar alterações');
      }
    } else {
      if (configuracaoAtiva) {
        setCustosIndiretos({
          maoObraDireta: Number(configuracaoAtiva.mao_obra_direta),
          energia: Number(configuracaoAtiva.energia_eletrica),
          depreciacao: Number(configuracaoAtiva.depreciacao_maquinas),
          administrativo: Number(configuracaoAtiva.despesas_administrativas),
        });
      }
      toast.info('Alterações descartadas');
    }
    setCamposBloqueados(true);
    setSalvarPermanente(false);
  };

  const handleSalvar = async () => {
    if (!resultado || !formulaSelecionada || !configuracaoAtiva) {
      toast.error('Complete todos os campos antes de salvar');
      return;
    }

    try {
      await salvarPrecificacao.mutateAsync({
        formula_id: formulaSelecionada.id,
        configuracao_custos_id: configuracaoAtiva.id,
        custo_materia_prima: resultado.custoMateriaPrima,
        custo_embalagem: resultado.custoEmbalagem,
        custo_mao_obra_direta: resultado.custoMaoObraDireta,
        custo_energia: resultado.custoEnergia,
        custo_depreciacao: resultado.custoDepreciacao,
        custo_administrativo: resultado.custoAdministrativo,
        subtotal_custos_diretos: resultado.subtotalCustosDiretos,
        subtotal_custos_indiretos: resultado.subtotalCustosIndiretos,
        margem_seguranca: resultado.margemSeguranca,
        total_custos_producao: resultado.totalCustosProducao,
        icms_credito_nf: resultado.icmsCreditoNF,
        icms_saida: resultado.icmsSaida,
        icms_credito_prodeic: resultado.icmsCreditoProdeic,
        fundeb_fundes: resultado.fundebFundes,
        icms_recolher: resultado.icmsRecolher,
        pis_cofins_saida: resultado.pisCOFINSSaida,
        pis_cofins_credito: resultado.pisCOFINSCredito,
        pis_cofins_recolher: resultado.pisCOFINSRecolher,
        ipi_valor: resultado.ipiValor,
        base_calculo_irpj_csll: resultado.baseCalculoIRPJCSLL,
        irpj_csll_valor: resultado.irpjCsllValor,
        total_impostos: resultado.totalImpostos,
        preco_venda: resultado.precoVenda,
        markup_bruto: resultado.markupBruto,
        margem_lucro_percentual: resultado.margemLucroPercentual,
        margem_lucro_valor: resultado.margemLucroValor,
        observacoes,
      });

      setModalAberta(false);
      setFormulaSelecionada(null);
      setValorInput('30');
      setObservacoes('');
      setAbaAtiva('salvas');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const validacaoMargem = resultado && formulaSelecionada
    ? validarMargemPorTipo(resultado.margemLucroPercentual, formulaSelecionada.tipo_produto)
    : null;

  const handleSelectFormula = (formula: Formula) => {
    setFormulaSelecionada(formula);
    setValorInput('');
    setObservacoes('');
    setModalAberta(true);
  };

  const handleCloseModal = () => {
    setModalAberta(false);
    setFormulaSelecionada(null);
    setResultado(null);
    setValorInput('30');
    setObservacoes('');
  };

  const handleExport = (formula: any) => {
    let csv = `COTAÇÃO - ${formula.nome_formula}\n`;
    csv += `Cliente: ${formula.cliente}\n`;
    csv += `Data: ${format(new Date(formula.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}\n`;
    csv += `Tipo: ${formula.tipo_produto}\n`;
    csv += `Quantidade: ${formula.quantidade_por_pote}\n\n`;
    csv += 'MATÉRIA-PRIMA\n';
    csv += 'Matéria-Prima,Quantidade,Unidade,Custo\n';
    formula.itens.forEach((item: any) => {
      csv += `${item.nome_insumo_snapshot},${item.qtd_informada},${item.unidade_informada},${formatCurrency(item.custo_calculado)}\n`;
    });
    csv += `TOTAL MP,,,${formatCurrency(formula.total_mp)}\n\n`;
    csv += 'EMBALAGEM\n';
    csv += 'Item,Descrição,Custo\n';
    formula.embalagens.forEach((item: any) => {
      csv += `${item.descricao_snapshot},,${formatCurrency(item.custo_calculado)}\n`;
    });
    csv += `TOTAL EMBALAGEM,,${formatCurrency(formula.total_embalagem)}\n\n`;
    csv += `CUSTO TOTAL,,${formatCurrency(formula.custo_total)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cotacao_${formula.cliente}_${formula.nome_formula}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'Encapsulados': return 'default';
      case 'Solúvel': return 'secondary';
      case 'Gummy': return 'outline';
      default: return 'default';
    }
  };

  const getQuantidadeLabel = (formula: Formula) => {
    if (formula.tipo_produto === 'Solúvel') {
      return formula.unidade_soluvel === 'g'
        ? `${(formula.quantidade_por_pote / 1000).toFixed(0)} g`
        : `${formula.quantidade_por_pote} mg`;
    }
    if (formula.tipo_produto === 'Encapsulados') return `${formula.quantidade_por_pote} cápsulas`;
    if (formula.tipo_produto === 'Gummy') return `${formula.quantidade_por_pote} gummies`;
    if (formula.tipo_produto === 'Líquido') return `${formula.quantidade_por_pote} mL`;
    return `${formula.quantidade_por_pote} un`;
  };

  if (loadingFormulas) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Precificação de Produto</h1>
          <p className="text-muted-foreground">Gerencie seus produtos e calcule preços de venda</p>
        </div>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Produtos Criados
          </TabsTrigger>
          <TabsTrigger value="salvas" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Precificações Salvas
          </TabsTrigger>
        </TabsList>

        {/* ===== ABA 1: PRODUTOS CRIADOS ===== */}
        <TabsContent value="produtos" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Produtos Criados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cliente ou fórmula..."
                  className="pl-10"
                />
              </div>

              {/* Filtros por tipo */}
              <div className="flex gap-2 flex-wrap">
                {['Todos', 'Encapsulados', 'Solúvel', 'Gummy', 'Líquido'].map((tipo) => (
                  <Button
                    key={tipo}
                    variant={filterTipo === tipo ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterTipo(tipo)}
                  >
                    {tipo}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Produtos */}
          <div className="space-y-4">
            {filteredFormulas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {searchTerm || filterTipo !== 'Todos'
                    ? 'Nenhum produto encontrado com os filtros aplicados.'
                    : 'Nenhum produto criado ainda. Crie um na tela de Criação de Produto!'}
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="space-y-4">
                {filteredFormulas.map((formula) => (
                  <AccordionItem key={formula.id} value={formula.id} className="border rounded-lg">
                    <Card>
                      <AccordionTrigger className="hover:no-underline px-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formula.cliente}</span>
                              <span className="text-muted-foreground">•</span>
                              <span>{formula.nome_formula}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getTipoBadgeVariant(formula.tipo_produto)}>
                                {formula.tipo_produto}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {getQuantidadeLabel(formula)}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(formula.data), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          <div className="text-xl font-bold text-primary">
                            {formatCurrency(formula.custo_total)}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent>
                        <CardContent className="space-y-6 pt-4">
                          {/* Matéria-Prima */}
                          <div>
                            <h4 className="font-semibold mb-2">Custo de Matéria-Prima</h4>
                            <div className="space-y-2">
                              {formula.itens.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {item.nome_insumo_snapshot} ({item.qtd_informada} {item.unidade_informada})
                                  </span>
                                  <span>{formatCurrency(item.custo_calculado)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-semibold pt-2 border-t">
                                <span>Total MP:</span>
                                <span>{formatCurrency(formula.total_mp)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Embalagens */}
                          <div>
                            <h4 className="font-semibold mb-2">Custo de Embalagem</h4>
                            <div className="space-y-2">
                              {formula.embalagens.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{item.descricao_snapshot}</span>
                                  <span>{formatCurrency(item.custo_calculado)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-semibold pt-2 border-t">
                                <span>Total Embalagem:</span>
                                <span>{formatCurrency(formula.total_embalagem)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex gap-2 flex-wrap pt-4 border-t">
                            <VerFormulaDialog
                              formula={formula as Formula}
                              onUpdateFormula={updateFormula}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSelectFormula(formula as Formula)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Precificar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleExport(formula)}>
                              <Download className="h-4 w-4 mr-2" />
                              Exportar CSV
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir "{formula.nome_formula}" do
                                    cliente {formula.cliente}? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteFormula(formula.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>

        {/* ===== ABA 2: PRECIFICAÇÕES SALVAS ===== */}
        <TabsContent value="salvas" className="mt-6">
          <PrecificacoesSalvas
            configuracaoAtiva={configuracaoAtiva}
            margens={margens}
          />
        </TabsContent>
      </Tabs>

      {/* Modal Fullscreen de Precificação */}
      <Dialog open={modalAberta} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[95vh] p-0 gap-0">
          {formulaSelecionada && (
            <>
              {/* Header fixo */}
              <div className="px-6 py-4 border-b bg-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">{formulaSelecionada.nome_formula}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{formulaSelecionada.tipo_produto}</Badge>
                      <Badge variant="outline">{formulaSelecionada.cliente}</Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {format(formulaSelecionada.data, 'dd/MM/yyyy HH:mm')}
                      </Badge>
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        Custo Total: R$ {arredondarReais(Number(formulaSelecionada.total_mp) + Number(formulaSelecionada.total_embalagem)).toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conteúdo scrollável */}
              <ScrollArea className="flex-1 px-6 py-6">
                <div className="space-y-6 pb-6">
                  {/* Custos Diretos e Indiretos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Custos Diretos */}
                    <Card>
                      <CardHeader>
                        <CardTitle>💊 Custos Diretos (por unidade)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Matéria-Prima</Label>
                            <Input
                              value={`R$ ${arredondarReais(Number(formulaSelecionada.total_mp)).toFixed(2)}`}
                              disabled
                              className="bg-muted"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Embalagem</Label>
                            <Input
                              value={`R$ ${arredondarReais(Number(formulaSelecionada.total_embalagem)).toFixed(2)}`}
                              disabled
                              className="bg-muted"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Mão de Obra Direta</Label>
                            {camposBloqueados ? (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Unlock className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <Input
                            type="number"
                            step="0.00001"
                            value={custosIndiretos.maoObraDireta}
                            onChange={(e) =>
                              setCustosIndiretos({ ...custosIndiretos, maoObraDireta: parseFloat(e.target.value) || 0 })
                            }
                            disabled={camposBloqueados}
                          />
                        </div>

                        <div className="p-3 bg-primary/5 rounded-lg">
                          <p className="text-sm font-medium">
                            Subtotal Diretos: R${' '}
                            {arredondarReais(
                              Number(formulaSelecionada.total_mp) +
                              Number(formulaSelecionada.total_embalagem) +
                              custosIndiretos.maoObraDireta
                            ).toFixed(2)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Custos Indiretos */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>🏭 Custos Indiretos (por unidade)</CardTitle>
                          {camposBloqueados ? (
                            <Button variant="outline" size="sm" onClick={handleDesbloquear}>
                              <Lock className="w-4 h-4 mr-2" />
                              Desbloquear
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="salvar-permanente-modal"
                                  checked={salvarPermanente}
                                  onChange={(e) => setSalvarPermanente(e.target.checked)}
                                  className="rounded"
                                />
                                <Label htmlFor="salvar-permanente-modal" className="text-sm cursor-pointer">
                                  Salvar
                                </Label>
                              </div>
                              <Button variant="outline" size="sm" onClick={handleBloquear}>
                                <Unlock className="w-4 h-4 mr-2" />
                                Bloquear
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Energia Elétrica</Label>
                            <Input
                              type="number"
                              step="0.00001"
                              value={custosIndiretos.energia}
                              onChange={(e) =>
                                setCustosIndiretos({ ...custosIndiretos, energia: parseFloat(e.target.value) || 0 })
                              }
                              disabled={camposBloqueados}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Depreciação de Máquinas</Label>
                            <Input
                              type="number"
                              step="0.00001"
                              value={custosIndiretos.depreciacao}
                              onChange={(e) =>
                                setCustosIndiretos({ ...custosIndiretos, depreciacao: parseFloat(e.target.value) || 0 })
                              }
                              disabled={camposBloqueados}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Despesas Administrativas</Label>
                            <Input
                              type="number"
                              step="0.00001"
                              value={custosIndiretos.administrativo}
                              onChange={(e) =>
                                setCustosIndiretos({ ...custosIndiretos, administrativo: parseFloat(e.target.value) || 0 })
                              }
                              disabled={camposBloqueados}
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-primary/5 rounded-lg">
                          <p className="text-sm font-medium">
                            Subtotal Indiretos: R${' '}
                            {arredondarReais(custosIndiretos.energia + custosIndiretos.depreciacao + custosIndiretos.administrativo).toFixed(2)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Custos Base, Margem e Total */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-muted-foreground mb-2">Custos Base</p>
                        <p className="text-sm text-muted-foreground text-xs mb-1">(Diretos + Indiretos)</p>
                        <p className="text-2xl font-semibold">
                          R${' '}
                          {arredondarReais(
                            Number(formulaSelecionada.total_mp) +
                            Number(formulaSelecionada.total_embalagem) +
                            custosIndiretos.maoObraDireta +
                            custosIndiretos.energia +
                            custosIndiretos.depreciacao +
                            custosIndiretos.administrativo
                          ).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-muted-foreground mb-2">Margem de Segurança</p>
                        <p className="text-sm text-muted-foreground text-xs mb-1">(20%)</p>
                        <p className="text-2xl font-semibold text-orange-600">
                          R${' '}
                          {arredondarReais(
                            (Number(formulaSelecionada.total_mp) +
                            Number(formulaSelecionada.total_embalagem) +
                            custosIndiretos.maoObraDireta +
                            custosIndiretos.energia +
                            custosIndiretos.depreciacao +
                            custosIndiretos.administrativo) * 0.20
                          ).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/50">
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-muted-foreground mb-2">Total Custos de Produção</p>
                        <p className="text-sm text-muted-foreground text-xs mb-1">(Base + Margem)</p>
                        <p className="text-2xl font-bold text-primary">
                          R${' '}
                          {arredondarReais(
                            (Number(formulaSelecionada.total_mp) +
                            Number(formulaSelecionada.total_embalagem) +
                            custosIndiretos.maoObraDireta +
                            custosIndiretos.energia +
                            custosIndiretos.depreciacao +
                            custosIndiretos.administrativo) * 1.20
                          ).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Cálculo de Precificação */}
                  <Card>
                    <CardHeader>
                      <CardTitle>💰 Cálculo de Precificação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Preço de Venda (R$)</Label>
                        <Input
                          type="number"
                          step="0.00001"
                          value={valorInput}
                          onChange={(e) => setValorInput(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Resultado - Impostos e Precificação Final */}
                  {resultado && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Impostos Calculados */}
                      <Card>
                        <CardHeader>
                          <CardTitle>📝 Impostos Calculados</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="font-medium">ICMS:</p>
                              <div className="pl-4 space-y-1 text-sm">
                                <p>Crédito NF ({configuracaoAtiva?.icms_credito_nf}%): R$ {resultado.icmsCreditoNF.toFixed(2)}</p>
                                <p>Saída ({configuracaoAtiva?.icms_saida}%): R$ {resultado.icmsSaida.toFixed(2)}</p>
                                <p>Crédito PRODEIC ({configuracaoAtiva?.credito_prodeic}%): R$ {resultado.icmsCreditoProdeic.toFixed(2)}</p>
                                <p>FUNDEB/FUNDES ({configuracaoAtiva?.fundeb_fundes}%): R$ {resultado.fundebFundes.toFixed(2)}</p>
                                <p className="font-medium text-primary">→ ICMS a Recolher: R$ {resultado.icmsRecolher.toFixed(2)}</p>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="font-medium">PIS/COFINS:</p>
                              <div className="pl-4 space-y-1 text-sm">
                                <p>Saída ({configuracaoAtiva?.pis_cofins_saida}%): R$ {resultado.pisCOFINSSaida.toFixed(2)}</p>
                                <p>Crédito ({configuracaoAtiva?.pis_cofins_credito}%): R$ {resultado.pisCOFINSCredito.toFixed(2)}</p>
                                <p className="font-medium text-primary">→ PIS/COFINS a Recolher: R$ {resultado.pisCOFINSRecolher.toFixed(2)}</p>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="font-medium">IPI ({configuracaoAtiva?.ipi_saida}%): R$ {resultado.ipiValor.toFixed(2)}</p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-medium">Base Cálculo IR/CS: R$ {resultado.baseCalculoIRPJCSLL.toFixed(2)}</p>
                              <p className="font-medium">IRPJ e CSLL ({configuracaoAtiva?.irpj_csll}%): R$ {resultado.irpjCsllValor.toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <p className="text-lg font-bold text-primary">TOTAL IMPOSTOS: R$ {resultado.totalImpostos.toFixed(2)}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Precificação Final */}
                      <Card className={validacaoMargem?.status === 'baixa' ? 'border-red-500' : validacaoMargem?.status === 'aceitavel' ? 'border-yellow-500' : 'border-green-500'}>
                        <CardHeader>
                          <CardTitle>✅ Precificação Final</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-center p-6 bg-primary/5 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-2">💵 Preço de Venda</p>
                            <p className="text-4xl font-bold text-primary">R$ {resultado.precoVenda.toFixed(2)}</p>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Custos Produção</p>
                              <p className="font-bold">R$ {resultado.totalCustosProducao.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {((resultado.totalCustosProducao / resultado.precoVenda) * 100).toFixed(1)}%
                              </p>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Impostos</p>
                              <p className="font-bold">R$ {resultado.totalImpostos.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {((resultado.totalImpostos / resultado.precoVenda) * 100).toFixed(1)}%
                              </p>
                            </div>

                            <div className={`relative text-center p-6 rounded-lg border-2 overflow-hidden
                              ${validacaoMargem?.borderColor || 'border-muted'}
                              ${validacaoMargem?.status === 'excelente' ? 'gold-shimmer' : validacaoMargem?.bgColor || 'bg-muted'}
                            `}>
                              {validacaoMargem?.status === 'excelente' && (
                                <>
                                  <Sparkles className="absolute top-2 left-2 w-5 h-5 text-amber-400 sparkle" />
                                  <Sparkles className="absolute top-3 right-3 w-4 h-4 text-yellow-400 sparkle sparkle-delay-1" />
                                  <Sparkles className="absolute bottom-3 left-3 w-4 h-4 text-amber-300 sparkle sparkle-delay-2" />
                                  <Star className="absolute bottom-2 right-2 w-5 h-5 text-yellow-500 sparkle sparkle-delay-3" />
                                  <Star className="absolute top-1/2 left-1 w-3 h-3 text-amber-400 sparkle sparkle-delay-4" />
                                </>
                              )}

                              <p className={`text-sm font-medium mb-2 ${validacaoMargem?.color || 'text-foreground'}`}>
                                💰 Margem de Lucro
                              </p>
                              <p className={`text-3xl font-bold ${validacaoMargem?.color || 'text-foreground'}`}>
                                {resultado.margemLucroPercentual.toFixed(1)}%
                              </p>
                              <p className={`text-sm font-semibold mt-1 ${validacaoMargem?.color || 'text-foreground'}`}>
                                R$ {resultado.margemLucroValor.toFixed(2)}
                              </p>

                              {validacaoMargem?.status === 'excelente' && (
                                <p className="mt-3 text-lg font-bold text-amber-700 animate-pulse">
                                  VOCÊ VAI FAZER A LEMON RICA
                                </p>
                              )}
                            </div>
                          </div>

                          {validacaoMargem && validacaoMargem.status !== 'excelente' && (
                            <div className={`p-4 rounded-lg ${validacaoMargem.bgColor}`}>
                              <p className={`font-medium ${validacaoMargem.color}`}>{validacaoMargem.mensagem}</p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                              value={observacoes}
                              onChange={(e) => setObservacoes(e.target.value)}
                              placeholder="Observações sobre esta precificação..."
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-3">
                            <Button onClick={handleSalvar} className="w-full" disabled={salvarPrecificacao.isPending}>
                              <Save className="w-4 h-4 mr-2" />
                              Salvar Precificação
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Senha */}
      <Dialog open={senhaDialog} onOpenChange={setSenhaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desbloquear Custos Fixos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Senha da Empresa</Label>
              <Input
                type="password"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="Digite a senha"
                onKeyDown={(e) => e.key === 'Enter' && handleVerificarSenha()}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVerificarSenha} className="flex-1">
                Confirmar
              </Button>
              <Button variant="outline" onClick={() => setSenhaDialog(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
