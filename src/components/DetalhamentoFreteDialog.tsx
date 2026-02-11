import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DetalhamentoFrete, PlanoFreteCustomizado, DetalhamentoEnvio, TABELA_FRETE, TipoProdutoFrete } from '@/types/orcamento';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Truck, Plus, Trash2, Info, PackageCheck } from 'lucide-react';

interface DetalhamentoFreteDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
}

export default function DetalhamentoFreteDialog({
  orcamento,
  onClose,
}: DetalhamentoFreteDialogProps) {
  const { updateDetalhamentoFrete } = useOrcamentos();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [freteLemonCaps, setFreteLemonCaps] = useState<boolean>(true);
  const [usaTabelaTradicional, setUsaTabelaTradicional] = useState<boolean>(true);
  const [planosCustomizados, setPlanosCustomizados] = useState<PlanoFreteCustomizado[]>([]);
  
  // Detalhamento de envio
  const [detalhamentoEnvio, setDetalhamentoEnvio] = useState<DetalhamentoEnvio>({
    tipo: 'total_lemoncaps',
    descricao_parcial: '',
  });
  
  // Novo plano sendo adicionado
  const [novoPlano, setNovoPlano] = useState({
    tipo_produto: '',
    plano: '',
    valor: 0,
  });

  useEffect(() => {
    if (orcamento.detalhamento_frete) {
      setFreteLemonCaps(orcamento.detalhamento_frete.frete_lemon_caps ?? true);
      setUsaTabelaTradicional(orcamento.detalhamento_frete.usa_tabela_tradicional ?? true);
      setPlanosCustomizados(orcamento.detalhamento_frete.planos_customizados || []);
      if (orcamento.detalhamento_frete.detalhamento_envio) {
        setDetalhamentoEnvio(orcamento.detalhamento_frete.detalhamento_envio);
      }
    }
  }, [orcamento]);

  const tiposProduto = Object.keys(TABELA_FRETE) as TipoProdutoFrete[];

  const getPlanosForTipo = (tipo: string) => {
    const tabela = TABELA_FRETE[tipo as TipoProdutoFrete];
    return tabela || [];
  };

  const handleAddPlano = () => {
    if (!novoPlano.tipo_produto || !novoPlano.plano || novoPlano.valor <= 0) return;
    
    setPlanosCustomizados(prev => [...prev, { ...novoPlano }]);
    setNovoPlano({ tipo_produto: '', plano: '', valor: 0 });
  };

  const handleRemovePlano = (index: number) => {
    setPlanosCustomizados(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const detalhamento: DetalhamentoFrete = {
        frete_lemon_caps: freteLemonCaps,
        usa_tabela_tradicional: usaTabelaTradicional,
        planos_customizados: planosCustomizados,
        detalhamento_envio: detalhamentoEnvio,
      };

      await updateDetalhamentoFrete.mutateAsync({
        id: orcamento.id,
        detalhamento_frete: detalhamento,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar detalhamento de frete:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Detalhamento de Frete
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detalhamento de Envio - NOVA SEÇÃO */}
          <div className="space-y-3">
            <Label className="text-base flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              Como será feita a logística?
            </Label>
            <RadioGroup
              value={detalhamentoEnvio.tipo}
              onValueChange={(value) => setDetalhamentoEnvio(prev => ({ 
                ...prev, 
                tipo: value as DetalhamentoEnvio['tipo'],
                descricao_parcial: value !== 'parcial' ? '' : prev.descricao_parcial,
              }))}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total_produtor" id="envio-produtor" />
                <Label htmlFor="envio-produtor" className="font-normal cursor-pointer">
                  Todo envio para o Produtor
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total_lemoncaps" id="envio-lemoncaps" />
                <Label htmlFor="envio-lemoncaps" className="font-normal cursor-pointer">
                  Toda logística via Lemon Caps
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="parcial" id="envio-parcial" />
                <Label htmlFor="envio-parcial" className="font-normal cursor-pointer">
                  Envio Parcial
                </Label>
              </div>
            </RadioGroup>

            {/* Campo para descrição do envio parcial */}
            {detalhamentoEnvio.tipo === 'parcial' && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Descreva a divisão:
                </Label>
                <Textarea
                  value={detalhamentoEnvio.descricao_parcial || ''}
                  onChange={(e) => setDetalhamentoEnvio(prev => ({ 
                    ...prev, 
                    descricao_parcial: e.target.value 
                  }))}
                  placeholder="Ex: 50 potes para produtor, 100 potes logística Lemon Caps"
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Pergunta principal */}
          <div className="space-y-3">
            <Label className="text-base">
              Frete com a Lemon Caps fazendo direto para o cliente final do produtor?
            </Label>
            <RadioGroup
              value={freteLemonCaps ? 'sim' : 'nao'}
              onValueChange={(value) => setFreteLemonCaps(value === 'sim')}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sim" id="frete-sim" />
                <Label htmlFor="frete-sim" className="font-normal cursor-pointer">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao" id="frete-nao" />
                <Label htmlFor="frete-nao" className="font-normal cursor-pointer">Não</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Se SIM, perguntar sobre tabela tradicional */}
          {freteLemonCaps && (
            <div className="space-y-3">
              <Label className="text-base">
                Usar tabela tradicional de envio?
              </Label>
              <RadioGroup
                value={usaTabelaTradicional ? 'sim' : 'nao'}
                onValueChange={(value) => setUsaTabelaTradicional(value === 'sim')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="tabela-sim" />
                  <Label htmlFor="tabela-sim" className="font-normal cursor-pointer">
                    Sim - Tabela padrão aplicada
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="tabela-nao" />
                  <Label htmlFor="tabela-nao" className="font-normal cursor-pointer">
                    Não - Definir valores personalizados
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Mostrar tabela tradicional se usar */}
          {freteLemonCaps && usaTabelaTradicional && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Tabela tradicional de envio aplicada automaticamente:
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {tiposProduto.map((tipo) => (
                    <div key={tipo}>
                      <p className="font-semibold mb-1">{tipo}</p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {getPlanosForTipo(tipo).map((plano, idx) => (
                          <li key={idx}>
                            {plano.plano}: {plano.valor ? formatCurrency(plano.valor) : 'Personalizado'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Planos customizados (quando NÃO usa tabela tradicional OU quando não é frete Lemon Caps) */}
          {(!freteLemonCaps || !usaTabelaTradicional) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Planos de Envio Personalizados</Label>
              </div>

              {/* Form para adicionar novo plano */}
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de Produto</Label>
                      <Select
                        value={novoPlano.tipo_produto}
                        onValueChange={(value) => {
                          setNovoPlano(prev => ({ ...prev, tipo_produto: value, plano: '' }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposProduto.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Plano de Envio</Label>
                      <Select
                        value={novoPlano.plano}
                        onValueChange={(value) => setNovoPlano(prev => ({ ...prev, plano: value }))}
                        disabled={!novoPlano.tipo_produto}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {novoPlano.tipo_produto && getPlanosForTipo(novoPlano.tipo_produto).map((p, idx) => (
                            <SelectItem key={idx} value={p.plano}>{p.plano}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.00001"
                        value={novoPlano.valor || ''}
                        onChange={(e) => setNovoPlano(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                        placeholder="0,00"
                      />
                    </div>
                    
                    <Button
                      type="button"
                      onClick={handleAddPlano}
                      disabled={!novoPlano.tipo_produto || !novoPlano.plano || novoPlano.valor <= 0}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de planos customizados */}
              {planosCustomizados.length === 0 ? (
                <div className="py-6 text-center border rounded-lg bg-muted/30">
                  <Truck className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano personalizado adicionado.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {planosCustomizados.map((plano, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{plano.tipo_produto}</span>
                          <span className="text-muted-foreground">-</span>
                          <span>{plano.plano}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatCurrency(plano.valor)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePlano(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
