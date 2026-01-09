import { useState, useMemo, useRef } from 'react';
import { useFormulas } from '@/hooks/useFormulas';
import { useConfiguracaoCustos } from '@/hooks/useConfiguracaoCustos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, FileText, Trash2, Download, Calculator as CalcIcon, DollarSign, TrendingUp, Package, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
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
import { GerarPedidoDialog } from '@/components/GerarPedidoDialog';
import { usePedidos } from '@/hooks/usePedidos';
import { gerarPDFOrdemProducao } from '@/lib/pdfGenerator';
import { Pedido, Formula } from '@/types/formula';
import { VerFormulaDialog } from '@/components/VerFormulaDialog';
import { calcularPrecificacaoPorPreco } from '@/lib/precificacaoCalculator';
import { PrecificacaoCalculada, ConfiguracaoCustos } from '@/types/precificacao';
import { toast } from 'sonner';

const Cotacoes = () => {
  const { formulas, loading, deleteFormula, updateFormula } = useFormulas();
  const { configuracoes, isLoading: loadingConfig } = useConfiguracaoCustos();
  const { createPedido } = usePedidos();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');
  const navigate = useNavigate();

  // Estado para precificação
  const [formulaParaPrecificar, setFormulaParaPrecificar] = useState<Formula | null>(null);
  const [precoVendaInput, setPrecoVendaInput] = useState('');
  const [resultado, setResultado] = useState<PrecificacaoCalculada | null>(null);
  const precificacaoRef = useRef<HTMLDivElement>(null);

  // Configuração ativa
  const configAtiva = useMemo(() => {
    return configuracoes.find(c => c.ativa) || configuracoes[0];
  }, [configuracoes]);

  const handleGerarPedido = async (formula: any, dados: any) => {
    const numeroPedido = `OP-${format(new Date(), 'yyyyMMddHHmmss')}`;
    
    const novoPedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'> = {
      formula_id: formula.id,
      numero_pedido: numeroPedido,
      data_pedido: dados.data_pedido,
      data_entrega: dados.data_entrega,
      quantidade_produto: dados.quantidade_produto,
      unidade_produto: dados.unidade_produto,
      status: 'aguardando_producao',
      formula_snapshot: formula,
      observacoes: dados.observacoes,
    };

    try {
      await createPedido(novoPedido);
      
      gerarPDFOrdemProducao({
        ...novoPedido,
        id: numeroPedido,
        created_at: new Date(),
        updated_at: new Date(),
      } as Pedido);
    } catch (error) {
      console.error('Erro ao gerar pedido:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredFormulas = useMemo(() => {
    return formulas.filter((formula) => {
      const matchesSearch =
        formula.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formula.nome_formula.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTipo = filterTipo === 'Todos' || formula.tipo_produto === filterTipo;

      return matchesSearch && matchesTipo;
    });
  }, [formulas, searchTerm, filterTipo]);

  const handleExport = (formula: any) => {
    let csv = `COTAÇÃO - ${formula.nome_formula}\n`;
    csv += `Cliente: ${formula.cliente}\n`;
    csv += `Data: ${format(new Date(formula.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}\n`;
    csv += `Tipo: ${formula.tipo_produto}\n`;
    csv += `Quantidade: ${formula.qtd_capsulas}\n\n`;

    csv += 'MATÉRIA-PRIMA\n';
    csv += 'Insumo,Quantidade,Unidade,Custo\n';
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

  const handleLoadToCalculator = (formula: any) => {
    // Salvar dados no localStorage para carregar no calculador
    localStorage.setItem('loadFormula', JSON.stringify(formula));
    navigate('/');
  };

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'Encapsulados':
        return 'default';
      case 'Pó':
        return 'secondary';
      case 'Gummy':
        return 'outline';
      default:
        return 'default';
    }
  };

  // Função para converter valores de mg para a unidade original (mg ou g)
  const getValorExibicao = (formula: Formula, valor: number) => {
    if (formula.tipo_produto !== 'Pó') return valor;
    const unidade = formula.unidade_po || 'mg';
    return unidade === 'g' ? valor / 1000 : valor;
  };

  const getUnidadeExibicao = (formula: Formula) => {
    if (formula.tipo_produto !== 'Pó') {
      if (formula.tipo_produto === 'Encapsulados') return 'cápsulas';
      if (formula.tipo_produto === 'Gummy') return 'gummies';
      if (formula.tipo_produto === 'Líquido') return 'mL';
      return 'unidades';
    }
    return formula.unidade_po || 'mg';
  };

  // Fazer precificação final
  const handleFazerPrecificacao = (formula: Formula) => {
    if (!configAtiva) {
      toast.error('Configure os custos antes de fazer a precificação');
      return;
    }
    setFormulaParaPrecificar(formula);
    setPrecoVendaInput('');
    setResultado(null);
    
    // Scroll suave para a seção de precificação
    setTimeout(() => {
      precificacaoRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 200);
  };

  // Calcular precificação quando o preço de venda muda
  const calcularPrecificacao = () => {
    if (!formulaParaPrecificar || !configAtiva || !precoVendaInput) return;

    const precoVenda = parseFloat(precoVendaInput);
    if (isNaN(precoVenda) || precoVenda <= 0) {
      toast.error('Informe um preço de venda válido');
      return;
    }

    const custosBase = {
      custoMateriaPrima: formulaParaPrecificar.total_mp,
      custoEmbalagem: formulaParaPrecificar.total_embalagem,
    };

    const custosIndiretos = {
      maoObraDireta: configAtiva.mao_obra_direta,
      energia: configAtiva.energia_eletrica,
      depreciacao: configAtiva.depreciacao_maquinas,
      administrativo: configAtiva.despesas_administrativas,
    };

    const resultadoCalculo = calcularPrecificacaoPorPreco(
      custosBase,
      custosIndiretos,
      precoVenda,
      configAtiva
    );

    setResultado(resultadoCalculo);
  };

  // Calcular sugestão de preço (30% de margem como padrão)
  const precoSugerido = useMemo(() => {
    if (!formulaParaPrecificar || !configAtiva) return 0;
    
    const custoTotal = formulaParaPrecificar.custo_total +
      configAtiva.mao_obra_direta +
      configAtiva.energia_eletrica +
      configAtiva.depreciacao_maquinas +
      configAtiva.despesas_administrativas;
    
    // Margem de segurança 20%
    const custoComSeguranca = custoTotal * 1.2;
    
    // Sugestão com 30% de margem líquida (simplificado)
    return custoComSeguranca * 1.5;
  }, [formulaParaPrecificar, configAtiva]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando cotações...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Cotações Salvas
          </CardTitle>
          <CardDescription>
            Gerencie e visualize todas as suas cotações salvas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou fórmula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {['Todos', 'Encapsulados', 'Pó', 'Gummy', 'Líquido'].map((tipo) => (
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

      {/* Lista de Cotações */}
      <div className="space-y-4">
        {filteredFormulas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchTerm || filterTipo !== 'Todos'
                ? 'Nenhuma cotação encontrada com os filtros aplicados.'
                : 'Nenhuma cotação salva ainda. Crie uma no Calculador!'}
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
                            {formula.tipo_produto === 'Pó' 
                              ? `${getValorExibicao(formula, formula.qtd_capsulas)} ${getUnidadeExibicao(formula)}`
                              : `${formula.qtd_capsulas} ${
                                  formula.tipo_produto === 'Encapsulados'
                                    ? 'cápsulas'
                                    : formula.tipo_produto === 'Gummy'
                                    ? 'gummies'
                                    : formula.tipo_produto === 'Líquido'
                                    ? 'mL'
                                    : 'unidades'
                                }`
                            }
                          </span>
                          {formula.unidades_por_dose && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {formula.tipo_produto === 'Pó'
                                  ? `${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses`
                                  : `${Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses`
                                }
                              </span>
                            </>
                          )}
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
                      {/* Informações de Dosagem */}
                      {formula.unidades_por_dose && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Informações de Dosagem</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Quantidade total:</p>
                              <p className="font-medium">
                                {formula.tipo_produto === 'Pó' 
                                  ? `${getValorExibicao(formula, formula.qtd_capsulas)} ${getUnidadeExibicao(formula)}`
                                  : `${formula.qtd_capsulas} ${getUnidadeExibicao(formula)}`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Dosagem:</p>
                              <p className="font-medium">
                                {formula.tipo_produto === 'Pó'
                                  ? `${getValorExibicao(formula, formula.unidades_por_dose)} ${getUnidadeExibicao(formula)}`
                                  : `${formula.unidades_por_dose} ${getUnidadeExibicao(formula)}`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Número de doses:</p>
                              <p className="font-medium">
                                {Math.floor(formula.qtd_capsulas / formula.unidades_por_dose)} doses
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Matéria-Prima */}
                      <div>
                        <h4 className="font-semibold mb-2">Matéria-Prima</h4>
                        <div className="space-y-2">
                          {formula.itens.map((item, idx) => (
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
                        <h4 className="font-semibold mb-2">Embalagens</h4>
                        <div className="space-y-2">
                          {formula.embalagens.map((item, idx) => (
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
                          variant="default"
                          size="sm"
                          onClick={() => handleFazerPrecificacao(formula)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Fazer precificação final
                        </Button>
                        <GerarPedidoDialog 
                          formula={formula} 
                          onConfirm={(dados) => handleGerarPedido(formula, dados)} 
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadToCalculator(formula)}
                        >
                          <CalcIcon className="h-4 w-4 mr-2" />
                          Carregar no Calculador
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
                                Tem certeza que deseja excluir a cotação "{formula.nome_formula}" do
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

      {/* Seção de Precificação */}
      {formulaParaPrecificar && configAtiva && (
        <div ref={precificacaoRef} className="space-y-6 pt-6">
          <div className="border-t pt-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Precificação: {formulaParaPrecificar.cliente} - {formulaParaPrecificar.nome_formula}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Custos Diretos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Custos Diretos (por unidade)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Matéria-Prima</span>
                  <span className="font-medium">{formatCurrency(formulaParaPrecificar.total_mp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Embalagem</span>
                  <span className="font-medium">{formatCurrency(formulaParaPrecificar.total_embalagem)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mão de Obra Direta</span>
                  <span className="font-medium">{formatCurrency(configAtiva.mao_obra_direta)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Subtotal Custos Diretos</span>
                  <span>{formatCurrency(
                    formulaParaPrecificar.total_mp + 
                    formulaParaPrecificar.total_embalagem + 
                    configAtiva.mao_obra_direta
                  )}</span>
                </div>
              </CardContent>
            </Card>

            {/* Custos Indiretos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Custos Indiretos (por unidade)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Energia Elétrica</span>
                  <span className="font-medium">{formatCurrency(configAtiva.energia_eletrica)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depreciação Máquinas</span>
                  <span className="font-medium">{formatCurrency(configAtiva.depreciacao_maquinas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Despesas Administrativas</span>
                  <span className="font-medium">{formatCurrency(configAtiva.despesas_administrativas)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Subtotal Custos Indiretos</span>
                  <span>{formatCurrency(
                    configAtiva.energia_eletrica + 
                    configAtiva.depreciacao_maquinas + 
                    configAtiva.despesas_administrativas
                  )}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cálculo de Precificação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalcIcon className="h-5 w-5" />
                Cálculo de Precificação
              </CardTitle>
              <CardDescription>
                Defina o preço de venda desejado para calcular a margem de lucro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sugestão de Preço */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Sugestão de Preço</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(precoSugerido)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Baseado em ~30% de margem de lucro líquida
                </p>
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="precoVenda">Preço de Venda Desejado (R$)</Label>
                  <Input
                    id="precoVenda"
                    type="number"
                    step="0.01"
                    min="0"
                    value={precoVendaInput}
                    onChange={(e) => setPrecoVendaInput(e.target.value)}
                    placeholder="Digite o preço de venda"
                    className="mt-1"
                  />
                </div>
                <Button onClick={calcularPrecificacao}>
                  Calcular Margem
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Precificação Final */}
          {resultado && (
            <Card className="border-2 border-primary">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-xl flex items-center gap-2">
                  <DollarSign className="h-6 w-6" />
                  Precificação Final
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Preço de Venda</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(resultado.precoVenda)}
                    </p>
                  </div>
                  <div className={`text-center p-4 rounded-lg ${
                    resultado.margemLucroPercentual >= 25 
                      ? 'bg-green-100 dark:bg-green-950' 
                      : resultado.margemLucroPercentual >= 15 
                        ? 'bg-yellow-100 dark:bg-yellow-950'
                        : 'bg-red-100 dark:bg-red-950'
                  }`}>
                    <p className="text-sm text-muted-foreground mb-1">Margem de Lucro</p>
                    <p className={`text-3xl font-bold ${
                      resultado.margemLucroPercentual >= 25 
                        ? 'text-green-600' 
                        : resultado.margemLucroPercentual >= 15 
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}>
                      {resultado.margemLucroPercentual.toFixed(1)}%
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {formatCurrency(resultado.margemLucroValor)} por unidade
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Markup Bruto</p>
                    <p className="text-3xl font-bold">
                      {resultado.markupBruto.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Detalhamento */}
                <div className="mt-6 pt-6 border-t space-y-3">
                  <h4 className="font-semibold">Resumo dos Custos e Impostos</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Custos Produção</p>
                      <p className="font-medium">{formatCurrency(resultado.totalCustosProducao)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Impostos</p>
                      <p className="font-medium">{formatCurrency(resultado.totalImpostos)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Margem Segurança (20%)</p>
                      <p className="font-medium">{formatCurrency(resultado.margemSeguranca)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lucro Líquido</p>
                      <p className="font-medium text-green-600">{formatCurrency(resultado.margemLucroValor)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Cotacoes;