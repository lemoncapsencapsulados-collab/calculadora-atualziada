import { useState, useMemo } from 'react';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { ConfiguracaoCustos, MargemLucro } from '@/types/precificacao';
import { calcularPrecificacaoPorPreco, validarMargem } from '@/lib/precificacaoCalculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2 } from 'lucide-react';

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
  
  // Estados editáveis
  const [precoVenda, setPrecoVenda] = useState(Number(precificacao.preco_venda).toFixed(2));
  const [custoMP, setCustoMP] = useState(Number(precificacao.custo_materia_prima).toFixed(2));
  const [custoEmbalagem, setCustoEmbalagem] = useState(Number(precificacao.custo_embalagem).toFixed(2));

  // Recálculo em tempo real
  const resultado = useMemo(() => {
    if (!configuracaoAtiva) return null;
    
    const preco = parseFloat(precoVenda) || 0;
    const mp = parseFloat(custoMP) || 0;
    const emb = parseFloat(custoEmbalagem) || 0;
    
    if (preco <= 0) return null;
    
    const custosBase = {
      custoMateriaPrima: mp,
      custoEmbalagem: emb,
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
  }, [precoVenda, custoMP, custoEmbalagem, configuracaoAtiva, precificacao]);

  // Validação de margem
  const validacaoMargem = useMemo(() => {
    if (!resultado || !margens) return null;
    const margem = margens.find(m => m.tipo_produto === precificacao.formulas?.tipo_produto);
    if (!margem) return null;
    return validarMargem(resultado.margemLucroPercentual, margem.margem_ideal, margem.margem_minima);
  }, [resultado, margens, precificacao.formulas?.tipo_produto]);

  // Cor da margem
  const getMargemBg = () => {
    if (!validacaoMargem) return 'bg-muted';
    switch (validacaoMargem.status) {
      case 'ideal': return 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500';
      case 'aceitavel': return 'bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-500';
      case 'baixa': return 'bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-500';
      default: return 'bg-muted';
    }
  };

  const getMargemTextColor = () => {
    if (!validacaoMargem) return 'text-foreground';
    switch (validacaoMargem.status) {
      case 'ideal': return 'text-green-600';
      case 'aceitavel': return 'text-yellow-600';
      case 'baixa': return 'text-red-600';
      default: return 'text-foreground';
    }
  };

  const handleSalvar = async () => {
    if (!resultado) return;
    
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

  // Custo da fórmula (diretos)
  const custoFormulaDiretos = useMemo(() => {
    const mp = parseFloat(custoMP) || 0;
    const emb = parseFloat(custoEmbalagem) || 0;
    return mp + emb;
  }, [custoMP, custoEmbalagem]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
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
        
        {/* Custos Base Editáveis */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground">CUSTOS BASE (Editáveis)</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Custo Matéria-Prima (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={custoMP}
                onChange={(e) => setCustoMP(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Custo Embalagem (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={custoEmbalagem}
                onChange={(e) => setCustoEmbalagem(e.target.value)}
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
              step="0.01"
              value={precoVenda}
              onChange={(e) => setPrecoVenda(e.target.value)}
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
            <div className={`p-4 rounded-lg text-center ${getMargemBg()}`}>
              <p className={`text-sm font-medium mb-2 ${getMargemTextColor()}`}>💰 Margem de Lucro</p>
              <div className="flex items-center justify-center gap-4">
                <span className={`text-3xl font-bold ${getMargemTextColor()}`}>
                  {resultado.margemLucroPercentual.toFixed(1)}%
                </span>
                <span className={`text-xl font-semibold ${getMargemTextColor()}`}>
                  R$ {resultado.margemLucroValor.toFixed(2)}
                </span>
              </div>
            </div>
            
            {/* Validação */}
            {validacaoMargem && (
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
          <Button onClick={handleSalvar} disabled={!resultado || salvando}>
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
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
  );
}
