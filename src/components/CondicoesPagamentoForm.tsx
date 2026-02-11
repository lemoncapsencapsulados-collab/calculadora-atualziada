import { useState } from 'react';
import { CondicoesPagamento, FormaPagamentoTipo } from '@/types/orcamento';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  Building2, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Wallet
} from 'lucide-react';

interface CondicoesPagamentoFormProps {
  value: CondicoesPagamento;
  onChange: (value: CondicoesPagamento) => void;
  valorTotal?: number;
  isRequired?: boolean;
}

const FORMAS_PAGAMENTO: { value: FormaPagamentoTipo; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard },
  { value: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard },
  { value: 'boleto', label: 'Boleto', icon: FileText },
  { value: 'transferencia', label: 'Transferência', icon: Building2 },
  { value: 'outro', label: 'Outro', icon: MoreHorizontal },
];

export function getFormaPagamentoLabel(tipo?: FormaPagamentoTipo): string {
  const forma = FORMAS_PAGAMENTO.find(f => f.value === tipo);
  return forma?.label || tipo || '';
}

export default function CondicoesPagamentoForm({
  value,
  onChange,
  valorTotal = 0,
  isRequired = false,
}: CondicoesPagamentoFormProps) {
  const [isOpen, setIsOpen] = useState(
    !!(value.valor_entrada || value.forma_pagamento_entrada || value.valor_termino || value.forma_pagamento_termino)
  );

  const handleChange = (field: keyof CondicoesPagamento, fieldValue: any) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const valorTerminoCalculado = value.usa_valor_restante 
    ? Math.max(0, valorTotal - (value.valor_entrada || 0))
    : value.valor_termino || 0;

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border ${isRequired ? 'border-primary' : 'border-dashed'}`}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  Detalhamento de Pagamento
                  {!isRequired && <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(value.valor_entrada || value.forma_pagamento_entrada) && (
                  <span className="text-xs text-muted-foreground">
                    Entrada: {value.valor_entrada ? formatCurrency(value.valor_entrada) : 'definida'}
                  </span>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-6">
            {/* ENTRADA */}
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                Entrada
              </h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Qual é o valor da entrada?</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.00001"
                      value={value.valor_entrada || ''}
                      onChange={(e) => handleChange('valor_entrada', parseFloat(e.target.value) || undefined)}
                      placeholder="0,00"
                      className="max-w-[200px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Como será pago?</Label>
                  <div className="flex flex-wrap gap-2">
                    {FORMAS_PAGAMENTO.map((forma) => {
                      const Icon = forma.icon;
                      const isSelected = value.forma_pagamento_entrada === forma.value;
                      return (
                        <Button
                          key={forma.value}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className="gap-2"
                          onClick={() => handleChange('forma_pagamento_entrada', forma.value)}
                        >
                          <Icon className="w-4 h-4" />
                          {forma.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Detalhes adicionais (opcional)</Label>
                  <Input
                    value={value.descricao_entrada || ''}
                    onChange={(e) => handleChange('descricao_entrada', e.target.value)}
                    placeholder='Ex: "em 3x sem juros", "à vista", "após aprovação da arte"'
                  />
                </div>
              </div>
            </div>

            {/* TÉRMINO */}
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                No Término da Produção
              </h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Qual é o valor no término?</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.00001"
                        value={value.usa_valor_restante ? valorTerminoCalculado : (value.valor_termino || '')}
                        onChange={(e) => handleChange('valor_termino', parseFloat(e.target.value) || undefined)}
                        placeholder="0,00"
                        className="max-w-[200px]"
                        disabled={value.usa_valor_restante}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="usa_restante"
                        checked={value.usa_valor_restante || false}
                        onCheckedChange={(checked) => {
                          handleChange('usa_valor_restante', checked);
                          if (checked && valorTotal > 0 && value.valor_entrada) {
                            handleChange('valor_termino', Math.max(0, valorTotal - value.valor_entrada));
                          }
                        }}
                      />
                      <Label htmlFor="usa_restante" className="text-sm font-normal cursor-pointer">
                        Restante
                        {value.usa_valor_restante && valorTotal > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({formatCurrency(valorTerminoCalculado)})
                          </span>
                        )}
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Como será pago?</Label>
                  <div className="flex flex-wrap gap-2">
                    {FORMAS_PAGAMENTO.map((forma) => {
                      const Icon = forma.icon;
                      const isSelected = value.forma_pagamento_termino === forma.value;
                      return (
                        <Button
                          key={forma.value}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className="gap-2"
                          onClick={() => handleChange('forma_pagamento_termino', forma.value)}
                        >
                          <Icon className="w-4 h-4" />
                          {forma.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Detalhes adicionais (opcional)</Label>
                  <Input
                    value={value.descricao_termino || ''}
                    onChange={(e) => handleChange('descricao_termino', e.target.value)}
                    placeholder='Ex: "após entrega", "em 2x no cartão", "boleto 30 dias"'
                  />
                </div>
              </div>
            </div>

            {/* Resumo */}
            {(value.valor_entrada || value.valor_termino || value.usa_valor_restante) && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium mb-2">Resumo do Pagamento</p>
                <div className="space-y-1 text-sm">
                  {value.valor_entrada !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Entrada ({getFormaPagamentoLabel(value.forma_pagamento_entrada) || 'não definido'})
                        {value.descricao_entrada && ` - ${value.descricao_entrada}`}
                      </span>
                      <span className="font-medium">{formatCurrency(value.valor_entrada)}</span>
                    </div>
                  )}
                  {(value.valor_termino !== undefined || value.usa_valor_restante) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Término ({getFormaPagamentoLabel(value.forma_pagamento_termino) || 'não definido'})
                        {value.descricao_termino && ` - ${value.descricao_termino}`}
                      </span>
                      <span className="font-medium">{formatCurrency(valorTerminoCalculado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t font-medium">
                    <span>Total</span>
                    <span>{formatCurrency((value.valor_entrada || 0) + valorTerminoCalculado)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Função de validação
export function validarCondicoesPagamento(condicoes?: CondicoesPagamento): string[] {
  const erros: string[] = [];
  
  if (!condicoes) {
    erros.push('Informe as condições de pagamento');
    return erros;
  }
  
  if (condicoes.valor_entrada === undefined || condicoes.valor_entrada === null) {
    erros.push('Informe o valor da entrada');
  }
  if (!condicoes.forma_pagamento_entrada) {
    erros.push('Selecione a forma de pagamento da entrada');
  }
  if (!condicoes.valor_termino && !condicoes.usa_valor_restante) {
    erros.push('Informe o valor no término ou marque "Restante"');
  }
  if (!condicoes.forma_pagamento_termino) {
    erros.push('Selecione a forma de pagamento no término');
  }
  
  return erros;
}
