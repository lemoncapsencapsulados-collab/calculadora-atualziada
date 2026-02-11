import { useState, useEffect, useRef } from 'react';
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
import { Lock, Unlock, Save, FileDown, Settings, Loader2, Search, Package, Calculator, FileText, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { gerarPropostaPDF } from '@/lib/propostaGenerator';
import PrecificacoesSalvas from '@/components/PrecificacoesSalvas';

export default function Precificacao() {
  const { formulas, loading: isLoadingFormulas } = useFormulas();
  const { configuracaoAtiva, margens, verificarSenha, updateConfiguracao } = useConfiguracaoCustos();
  const { salvarPrecificacao } = usePrecificacao();

  // Estado da aba ativa
  const [abaAtiva, setAbaAtiva] = useState('nova');
  
  // Estados principais
  const [formulaSelecionada, setFormulaSelecionada] = useState<Formula | null>(null);
  const [valorInput, setValorInput] = useState('30');
  const [observacoes, setObservacoes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para dialog de proposta
  const [propostaDialog, setPropostaDialog] = useState(false);
  const [quantidadeFrascos, setQuantidadeFrascos] = useState('');
  const [temServicosExtras, setTemServicosExtras] = useState(false);
  const [valorServicosExtras, setValorServicosExtras] = useState('');
  const [gerandoPDF, setGerandoPDF] = useState(false);

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

  // Refs para scroll automático
  const precificacaoRef = useRef<HTMLDivElement>(null);
  const margemRef = useRef<HTMLDivElement>(null);

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
      // Restaurar valores originais
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
      
      // Redirecionar para aba de precificações salvas
      setFormulaSelecionada(null);
      setValorInput('30');
      setObservacoes('');
      setAbaAtiva('salvas');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  // Validação de margem usando a nova função por tipo
  const validacaoMargem = resultado && formulaSelecionada
    ? validarMargemPorTipo(resultado.margemLucroPercentual, formulaSelecionada.tipo_produto)
    : null;

  // Filtrar fórmulas pelo termo de pesquisa
  const formulasFiltradas = formulas?.filter(formula => {
    const termo = searchTerm.toLowerCase().trim();
    if (!termo) return true;
    return (
      formula.nome_formula.toLowerCase().includes(termo) ||
      formula.cliente.toLowerCase().includes(termo)
    );
  }) || [];

  const handleSelectFormula = (formula: Formula) => {
    setFormulaSelecionada(formula);
    setValorInput('');
    setObservacoes('');
    
    // Scroll suave para a seção de precificação
    setTimeout(() => {
      precificacaoRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  if (isLoadingFormulas) {
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
          <h1 className="text-3xl font-bold text-foreground">Precificação Final</h1>
          <p className="text-muted-foreground">Calcule o preço de venda com impostos e margem de lucro</p>
        </div>
        <Button variant="outline" size="icon">
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Sistema de Abas */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="nova" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Nova Precificação
          </TabsTrigger>
          <TabsTrigger value="salvas" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Precificações Salvas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="nova" className="space-y-6 mt-6">
          {/* Todas as Fórmulas */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Todas as Fórmulas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campo de Pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome da fórmula ou cliente..."
              className="pl-10"
            />
          </div>

          {/* Grid de Fórmulas */}
          {formulasFiltradas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'Nenhuma fórmula encontrada.' : 'Nenhuma fórmula cadastrada.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {formulasFiltradas.map((formula) => {
                const custoTotal = Number(formula.total_mp) + Number(formula.total_embalagem);
                const isSelected = formulaSelecionada?.id === formula.id;
                
                return (
                  <Card
                    key={formula.id}
                    className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                      isSelected ? 'border-primary bg-primary/5 shadow-md' : ''
                    }`}
                    onClick={() => handleSelectFormula(formula)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground line-clamp-2">{formula.nome_formula}</h3>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {formula.tipo_produto}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{formula.cliente}</p>
                      <p className="text-lg font-bold text-primary">
                        R$ {custoTotal.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP: R$ {Number(formula.total_mp).toFixed(2)} + Emb: R$ {Number(formula.total_embalagem).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {formulaSelecionada && (
        <div ref={precificacaoRef}>
          {/* Custos Diretos e Indiretos - Lado a Lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                      value={`R$ ${Number(formulaSelecionada.total_mp).toFixed(2)}`}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Embalagem</Label>
                    <Input
                      value={`R$ ${Number(formulaSelecionada.total_embalagem).toFixed(2)}`}
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
                    {(
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
                          id="salvar-permanente"
                          checked={salvarPermanente}
                          onChange={(e) => setSalvarPermanente(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="salvar-permanente" className="text-sm cursor-pointer">
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
                    {(custosIndiretos.energia + custosIndiretos.depreciacao + custosIndiretos.administrativo).toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Custos Base, Margem e Total - Lado a Lado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Custos Base</p>
                <p className="text-sm text-muted-foreground text-xs mb-1">(Diretos + Indiretos)</p>
                <p className="text-2xl font-semibold">
                  R${' '}
                  {(
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
                  {(
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
                  {(
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
                  onChange={(e) => {
                    setValorInput(e.target.value);
                    // Scroll suave para a seção de margem quando digitar o preço
                    if (e.target.value) {
                      setTimeout(() => {
                        margemRef.current?.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'center' 
                        });
                      }, 300);
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Resultado - Impostos e Precificação Final lado a lado */}
          {resultado && (
            <div ref={margemRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    
                    {/* Bloco de Margem com cores dinâmicas e celebração */}
                    <div className={`relative text-center p-6 rounded-lg border-2 overflow-hidden
                      ${validacaoMargem?.borderColor || 'border-muted'}
                      ${validacaoMargem?.status === 'excelente' ? 'gold-shimmer' : validacaoMargem?.bgColor || 'bg-muted'}
                    `}>
                      {/* Estrelinhas de celebração quando excelente */}
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
                      
                      {/* Mensagem de celebração */}
                      {validacaoMargem?.status === 'excelente' && (
                        <p className="mt-3 text-lg font-bold text-amber-700 animate-pulse">
                          VOCÊ VAI FAZER A LEMON RICA
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mensagem de validação */}
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
                    <Button onClick={handleSalvar} className="flex-1" disabled={salvarPrecificacao.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Precificação
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setPropostaDialog(true)}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Gerar Proposta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
        </TabsContent>
        
        <TabsContent value="salvas" className="mt-6">
          <PrecificacoesSalvas 
            configuracaoAtiva={configuracaoAtiva}
            margens={margens}
          />
        </TabsContent>
      </Tabs>

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

      {/* Dialog de Gerar Proposta */}
      <Dialog open={propostaDialog} onOpenChange={setPropostaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Proposta Comercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantidade de Frascos</Label>
              <Input
                type="number"
                value={quantidadeFrascos}
                onChange={(e) => setQuantidadeFrascos(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="servicos-extras"
                  checked={temServicosExtras}
                  onChange={(e) => setTemServicosExtras(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="servicos-extras" className="cursor-pointer">
                  Algum outro serviço adquirido? (Ex: pacote de brand, etc)
                </Label>
              </div>
              
              {temServicosExtras && (
                <div className="space-y-2 pl-6">
                  <Label>Valor dos Serviços Extras (R$)</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={valorServicosExtras}
                    onChange={(e) => setValorServicosExtras(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={async () => {
                  if (!quantidadeFrascos || !formulaSelecionada || !resultado) {
                    toast.error('Preencha todos os campos obrigatórios');
                    return;
                  }
                  
                  setGerandoPDF(true);
                  
                  try {
                    // Pequeno delay para mostrar o loading
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    await gerarPropostaPDF({
                      formula: formulaSelecionada,
                      precoUnitario: resultado.precoVenda,
                      quantidadeFrascos: parseInt(quantidadeFrascos),
                      valorServicosExtras: temServicosExtras ? parseFloat(valorServicosExtras) || 0 : 0,
                    });
                    
                    setPropostaDialog(false);
                    setQuantidadeFrascos('');
                    setTemServicosExtras(false);
                    setValorServicosExtras('');
                    toast.success('Proposta gerada com sucesso!');
                  } catch (error) {
                    toast.error('Erro ao gerar proposta');
                    console.error(error);
                  } finally {
                    setGerandoPDF(false);
                  }
                }} 
                className="flex-1"
                disabled={gerandoPDF}
              >
                {gerandoPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  'Gerar PDF'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setPropostaDialog(false);
                  setQuantidadeFrascos('');
                  setTemServicosExtras(false);
                  setValorServicosExtras('');
                }} 
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
