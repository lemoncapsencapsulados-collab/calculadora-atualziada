import { useState, useMemo } from 'react';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { ConfiguracaoCustos, MargemLucro } from '@/types/precificacao';
import { calcularPrecificacaoPorPreco, validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Sparkles, Star, Lock } from 'lucide-react';
import { toast } from 'sonner';

const SENHA_LIBERACAO_MARGEM = '0B%s8QP2Z+Do';

interface PrecificacaoComFormula {
  id: string;
  formula_id: string | null;
  preco_venda: number;
  custo_materia_prima: number;
  custo_embalagem: number;
  custo_mao_obra_direta: number;
  custo_energia: number;
  custo_depreciacao: number;
  custo_administrativo: number;
  total_custos_producao: number;
  total_impostos: number;
  margem_lucro_percentual: number;
  margem_lucro_valor: number;
  formulas: {
    nome_formula: string;
    cliente: string;
    tipo_produto: string;
  } | null;
  [key: string]: unknown;
}

interface EditarPrecificacaoDialogProps {
  precificacao: PrecificacaoComFormula;
  configuracaoAtiva: ConfiguracaoCustos | null;
  margens: MargemLucro[] | null;
  onClose: () => void;
}

export default function EditarPrecificacaoDialog({
  precificacao,
  configuracaoAtiva,
  margens,
  onClose
}: EditarPrecificacaoDialogProps) {
  const { atualizarPrecificacao } = usePrecificacao();
  const [salvando, setSalvando] = useState(false);
  
  // Estado editável - apenas preço de venda
  const [precoVenda, setPrecoVenda] = useState(Number(precificacao.preco_venda).toFixed(2));

  // Estados para liberação de margem com senha
  const [senhaMargemDialog, setSenhaMargemDialog] = useState(false);
  const [senhaMargemInput, setSenhaMargemInput] = useState('');
  const [margemLiberada, setMargemLiberada] = useState(false);

  // Valores fixos de custo
  const custoMPFixo = Number(precificacao.custo_materia_prima);
  const custoEmbalagemFixo = Number(precificacao.custo_embalagem);

  // Recálculo em tempo real
  const resultado = useMemo(() => {
    if (!configuracaoAtiva) return null;
    
    const preco = parseFloat(precoVenda) || 0;
    
    if (preco <= 0) return null;
    
    const custosBase = {
      custoMateriaPrima: custoMPFixo,
      custoEmbalagem: custoEmbalagemFixo,
    };
    
    const custosIndiretos = {
      maoObraDireta: Number(precificacao.custo_mao_obra_direta),
      energia: Number(precificacao.custo_energia),
      depreciacao: Number(precificacao.custo_depreciacao),
      administrativo: Number(precificacao.custo_administrativo),
    };
    
    try {
      return calcularPrecificacaoPorPreco(custosBase, custosIndiretos, preco, configuracaoAtiva);
    } catch {
      return null;
    }
  }, [precoVenda, custoMPFixo, custoEmbalagemFixo, configuracaoAtiva, precificacao]);

  // Validação de margem
  const validacaoMargem = useMemo(() => {
    if (!resultado || !precificacao.formulas?.tipo_produto) return null;
    return validarMargemPorTipo(resultado.margemLucroPercentual, precificacao.formulas.tipo_produto);
  }, [resultado, precificacao.formulas?.tipo_produto]);

  // Resetar liberação quando preço muda
  const handlePrecoChange = (value: string) => {
    setPrecoVenda(value);
    setMargemLiberada(false);
  };

  const handleSalvar = async () => {
    if (!resultado) return;

    // Verificar margem mínima
    if (validacaoMargem?.status === 'baixa' && !margemLiberada) {
      setSenhaMargemDialog(true);
      return;
    }
    
    setSalvando(true);
    
    try {
      await atualizarPrecificacao.mutateAsync({
        id: precificacao.id,
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
      });
      
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarSenha = () => {
    if (senhaMargemInput === SENHA_LIBERACAO_MARGEM) {
      setMargemLiberada(true);
      setSenhaMargemDialog(false);
      setSenhaMargemInput('');
      toast.success('Margem liberada! Clique em salvar novamente.');
    } else {
      toast.error('Senha incorreta!');
      setSenhaMargemInput('');
    }
  };

  // Custo da fórmula (diretos)
  const custoFormulaDiretos = custoMPFixo + custoEmbalagemFixo;

  const margemBaixaSemLiberacao = validacaoMargem?.status === 'baixa' && !margemLiberada;

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Precificação</DialogTitle>
          </DialogHeader>
          
          {/* Informações da fórmula */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="font-semibold">{precificacao.formulas?.nome_formula}</p>
              <p className="text-sm text-muted-foreground">{precificacao.formulas?.cliente}</p>
            </div>
            <Badge>{precificacao.formulas?.tipo_produto}</Badge>
          </div>
          
          {/* Custos Base - Somente leitura */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">CUSTOS BASE</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo Matéria-Prima (R$)</Label>
                <Input
                  type="number"
                  value={custoMPFixo.toFixed(5)}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Custo Embalagem (R$)</Label>
                <Input
                  type="number"
                  value={custoEmbalagemFixo.toFixed(5)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Custo Fórmula (Diretos):</span>{' '}
                <span className="font-semibold">R$ {custoFormulaDiretos.toFixed(2)}</span>
              </p>
            </div>
          </div>

          {/* Preço de Venda */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">PREÇO DE VENDA</h4>
            <div className="space-y-2">
              <Label>Preço de Venda (R$)</Label>
              <Input
                type="number"
                step="0.00001"
                value={precoVenda}
                onChange={(e) => handlePrecoChange(e.target.value)}
                className="text-lg font-semibold"
              />
            </div>
          </div>
          
          {/* Resultado recalculado */}
          {resultado && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">RESULTADO (Recalculado em tempo real)</h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground text-xs">Custo Total Produção</p>
                  <p className="font-semibold text-lg">R$ {resultado.totalCustosProducao.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground text-xs">Total Impostos</p>
                  <p className="font-semibold text-lg">R$ {resultado.totalImpostos.toFixed(2)}</p>
                </div>
              </div>
              
              {/* Destaque da margem */}
              <div className={`relative p-4 rounded-lg text-center border-2 overflow-hidden
                ${validacaoMargem?.borderColor || 'border-muted'}
                ${validacaoMargem?.status === 'excelente' ? 'gold-shimmer' : validacaoMargem?.bgColor || 'bg-muted'}
              `}>
                {validacaoMargem?.status === 'excelente' && (
                  <>
                    <Sparkles className="absolute top-2 left-2 w-4 h-4 text-amber-400 sparkle" />
                    <Sparkles className="absolute top-2 right-2 w-3 h-3 text-yellow-400 sparkle sparkle-delay-1" />
                    <Sparkles className="absolute bottom-2 left-4 w-3 h-3 text-amber-300 sparkle sparkle-delay-2" />
                    <Star className="absolute bottom-2 right-4 w-4 h-4 text-yellow-500 sparkle sparkle-delay-3" />
                  </>
                )}
                
                <p className={`text-sm font-medium mb-2 ${validacaoMargem?.color || 'text-foreground'}`}>
                  💰 Margem de Lucro
                </p>
                <div className="flex items-center justify-center gap-4">
                  <span className={`text-3xl font-bold ${validacaoMargem?.color || 'text-foreground'}`}>
                    {resultado.margemLucroPercentual.toFixed(1)}%
                  </span>
                  <span className={`text-xl font-semibold ${validacaoMargem?.color || 'text-foreground'}`}>
                    R$ {resultado.margemLucroValor.toFixed(2)}
                  </span>
                </div>
                
                {validacaoMargem?.status === 'excelente' && (
                  <p className="mt-3 text-lg font-bold text-amber-700 animate-pulse">
                    VOCÊ VAI FAZER A LEMON RICA
                  </p>
                )}
              </div>
              
              {validacaoMargem && validacaoMargem.status !== 'excelente' && (
                <p className={`text-sm font-medium text-center ${validacaoMargem.color}`}>
                  {validacaoMargem.mensagem}
                </p>
              )}
            </div>
          )}
          
          {/* Ações */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSalvar} 
              disabled={!resultado || salvando}
              variant={margemBaixaSemLiberacao ? 'destructive' : 'default'}
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : margemBaixaSemLiberacao ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Liberar com senha
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de senha para liberar margem */}
      <Dialog open={senhaMargemDialog} onOpenChange={setSenhaMargemDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Liberação de Margem</DialogTitle>
            <DialogDescription>
              A margem está abaixo do mínimo permitido. Digite a senha para liberar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Senha de liberação</Label>
              <Input
                type="password"
                value={senhaMargemInput}
                onChange={(e) => setSenhaMargemInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmarSenha()}
                placeholder="Digite a senha..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSenhaMargemDialog(false); setSenhaMargemInput(''); }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarSenha}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}