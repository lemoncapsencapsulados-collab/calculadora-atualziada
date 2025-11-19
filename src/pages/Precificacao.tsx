import { useState, useEffect } from 'react';
import { useFormulas } from '@/hooks/useFormulas';
import { useConfiguracaoCustos } from '@/hooks/useConfiguracaoCustos';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { Formula } from '@/types/formula';
import {
  calcularPrecificacaoPorPreco,
  calcularPrecificacaoPorMarkup,
  validarMargem,
} from '@/lib/precificacaoCalculator';
import { PrecificacaoCalculada } from '@/types/precificacao';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Lock, Unlock, Save, FileDown, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function Precificacao() {
  const { formulas, loading: isLoadingFormulas } = useFormulas();
  const { configuracaoAtiva, margens, verificarSenha, updateConfiguracao } = useConfiguracaoCustos();
  const { salvarPrecificacao } = usePrecificacao();

  // Estados principais
  const [formulaSelecionada, setFormulaSelecionada] = useState<Formula | null>(null);
  const [metodoCalculo, setMetodoCalculo] = useState<'preco' | 'markup'>('markup');
  const [valorInput, setValorInput] = useState('');
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
      const calc =
        metodoCalculo === 'preco'
          ? calcularPrecificacaoPorPreco(custosBase, custosIndiretos, valor, configuracaoAtiva)
          : calcularPrecificacaoPorMarkup(custosBase, custosIndiretos, valor, configuracaoAtiva);

      setResultado(calc);
    } catch (error) {
      console.error('Erro ao calcular:', error);
      setResultado(null);
    }
  }, [formulaSelecionada, configuracaoAtiva, custosIndiretos, valorInput, metodoCalculo]);

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
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const margemProduto = margens?.find((m) => m.tipo_produto === formulaSelecionada?.tipo_produto);
  const validacaoMargem = resultado && margemProduto
    ? validarMargem(resultado.margemLucroPercentual, margemProduto.margem_ideal, margemProduto.margem_minima)
    : null;

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

      {/* Seleção de Fórmula */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Fórmula</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Fórmula para Precificar</Label>
            <Select
              value={formulaSelecionada?.id || ''}
              onValueChange={(value) => {
                const formula = formulas?.find((f) => f.id === value);
                setFormulaSelecionada(formula || null);
                setValorInput('');
                setObservacoes('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma fórmula salva" />
              </SelectTrigger>
              <SelectContent>
                {formulas?.map((formula) => (
                  <SelectItem key={formula.id} value={formula.id}>
                    {formula.nome_formula} - {formula.cliente} ({formula.tipo_produto})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formulaSelecionada && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{formulaSelecionada.cliente}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{formulaSelecionada.tipo_produto}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quantidade</p>
                <p className="font-medium">{formulaSelecionada.qtd_capsulas} unidades</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {formulaSelecionada && (
        <>
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
                  step="0.01"
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
                    Desbloquear para Editar
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
                        Salvar permanentemente
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Energia Elétrica</Label>
                  <Input
                    type="number"
                    step="0.01"
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
                    step="0.01"
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
                    step="0.01"
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

          {/* Total Custos de Produção */}
          <Card className="border-primary/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Total Custos de Produção</p>
                <p className="text-3xl font-bold text-primary">
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
              </div>
            </CardContent>
          </Card>

          {/* Precificação */}
          <Card>
            <CardHeader>
              <CardTitle>💰 Cálculo de Precificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Label>Método de Cálculo</Label>
                <RadioGroup value={metodoCalculo} onValueChange={(value: any) => setMetodoCalculo(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="preco" id="preco" />
                    <Label htmlFor="preco" className="cursor-pointer">
                      Informar Preço de Venda Desejado (R$)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="markup" id="markup" />
                    <Label htmlFor="markup" className="cursor-pointer">
                      Informar Markup Bruto (%)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>{metodoCalculo === 'preco' ? 'Preço de Venda (R$)' : 'Markup Bruto (%)'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  placeholder={metodoCalculo === 'preco' ? '0.00' : '0.00'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          {resultado && (
            <>
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
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Lucro Líquido</p>
                      <p className="font-bold">R$ {resultado.margemLucroValor.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{resultado.margemLucroPercentual.toFixed(1)}%</p>
                    </div>
                  </div>

                  {validacaoMargem && (
                    <div className={`p-4 rounded-lg ${validacaoMargem.status === 'baixa' ? 'bg-red-50' : validacaoMargem.status === 'aceitavel' ? 'bg-yellow-50' : 'bg-green-50'}`}>
                      <p className={`font-medium ${validacaoMargem.color}`}>{validacaoMargem.mensagem}</p>
                      {margemProduto && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Ideal: {margemProduto.margem_ideal}% | Mínima: {margemProduto.margem_minima}%
                        </p>
                      )}
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
                    <Button variant="outline" className="flex-1">
                      <FileDown className="w-4 h-4 mr-2" />
                      Exportar PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

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
