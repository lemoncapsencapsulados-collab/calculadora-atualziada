import { useState } from 'react';
import { CondicoesPagamento, MetodoPagamentoPrincipal, FormaPagamentoAvista } from '@/types/orcamento';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  Building2, 
  Wallet,
  Banknote,
  SplitSquareHorizontal,
  CreditCard as CreditCard2
} from 'lucide-react';

interface CondicoesPagamentoFormProps {
  value: CondicoesPagamento;
  onChange: (value: CondicoesPagamento) => void;
  valorTotal?: number;
  isRequired?: boolean;
}

const JUROS_PARCELAS: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0.07, 5: 0.08, 6: 0.09,
};

function calcularComJuros(valor: number, parcelas: number) {
  const taxa = JUROS_PARCELAS[parcelas] || 0;
  const totalComJuros = valor * (1 + taxa);
  const valorParcela = totalComJuros / parcelas;
  return { totalComJuros, valorParcela, taxa };
}

const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FORMAS_AVISTA: { value: FormaPagamentoAvista; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'transferencia', label: 'Transferência', icon: Building2 },
  { value: 'debito', label: 'Débito', icon: CreditCard },
  { value: 'boleto', label: 'Boleto', icon: FileText },
];

const METODOS: { value: MetodoPagamentoPrincipal; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'avista', label: 'À vista', icon: Banknote },
  { value: 'cartao_credito', label: 'Cartão de Crédito', icon: CreditCard },
  { value: 'fracionado', label: 'Fracionado', icon: SplitSquareHorizontal },
  { value: 'dois_cartoes', label: '2 Cartões diferentes', icon: CreditCard2 },
];

function ParcelasSelector({ parcelas, onChange, valor }: { parcelas?: number; onChange: (p: number) => void; valor: number }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">Parcelas</Label>
      <Select value={parcelas?.toString() || ''} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger><SelectValue placeholder="Selecione as parcelas" /></SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5, 6].map(p => {
            const { valorParcela, taxa } = calcularComJuros(valor, p);
            const jurosLabel = taxa > 0 ? ` (+${(taxa * 100).toFixed(0)}% juros)` : ' (sem juros)';
            return (
              <SelectItem key={p} value={p.toString()}>
                {p}x de {formatCurrency(valorParcela)}{jurosLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {parcelas && (
        <div className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
          {(() => {
            const { totalComJuros, valorParcela, taxa } = calcularComJuros(valor, parcelas);
            return (
              <>
                <span>{parcelas}x de <strong>{formatCurrency(valorParcela)}</strong></span>
                {taxa > 0 && <span className="text-destructive"> — Juros: +{(taxa * 100).toFixed(0)}%</span>}
                <span> — Total: <strong>{formatCurrency(totalComJuros)}</strong></span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function FormaAvistaSelector({ value, onChange }: { value?: FormaPagamentoAvista; onChange: (v: FormaPagamentoAvista) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">Forma de pagamento</Label>
      <div className="flex flex-wrap gap-2">
        {FORMAS_AVISTA.map((forma) => {
          const Icon = forma.icon;
          const isSelected = value === forma.value;
          return (
            <Button
              key={forma.value}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => onChange(forma.value)}
            >
              <Icon className="w-4 h-4" />
              {forma.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default function CondicoesPagamentoForm({
  value,
  onChange,
  valorTotal = 0,
}: CondicoesPagamentoFormProps) {
  const metodo = value.metodo_principal;

  const handleChange = (updates: Partial<CondicoesPagamento>) => {
    onChange({ ...value, ...updates });
  };

  const setMetodo = (m: MetodoPagamentoPrincipal) => {
    // Reset fields when switching method
    onChange({ metodo_principal: m });
  };

  // Compute totals for summary
  const computeTotal = () => {
    if (!metodo) return { total: valorTotal, detalhes: '' };
    
    if (metodo === 'avista') return { total: valorTotal };
    
    if (metodo === 'cartao_credito' && value.parcelas_cartao) {
      const { totalComJuros } = calcularComJuros(valorTotal, value.parcelas_cartao);
      return { total: totalComJuros };
    }
    
    if (metodo === 'fracionado') {
      const avista = value.valor_avista || 0;
      const restante = Math.max(0, valorTotal - avista);
      const parcelas = value.parcelas_cartao_fracionado || 1;
      const { totalComJuros } = calcularComJuros(restante, parcelas);
      return { total: avista + totalComJuros };
    }
    
    if (metodo === 'dois_cartoes') {
      const v1 = value.valor_cartao1 || 0;
      const v2 = Math.max(0, valorTotal - v1);
      const p1 = value.parcelas_cartao1 || 1;
      const p2 = value.parcelas_cartao2 || 1;
      const { totalComJuros: t1 } = calcularComJuros(v1, p1);
      const { totalComJuros: t2 } = calcularComJuros(v2, p2);
      return { total: t1 + t2 };
    }
    
    return { total: valorTotal };
  };

  const { total: totalFinal } = computeTotal();

  return (
    <Card className="border border-primary">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="font-medium">Condições de Pagamento</span>
        </div>

        {/* Método Principal */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Método de Pagamento <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map((m) => {
              const Icon = m.icon;
              const isSelected = metodo === m.value;
              return (
                <Button
                  key={m.value}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 justify-start"
                  onClick={() => setMetodo(m.value)}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* À vista */}
        {metodo === 'avista' && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
            <FormaAvistaSelector
              value={value.forma_avista}
              onChange={(v) => handleChange({ forma_avista: v })}
            />
            <div className="text-sm p-2 rounded bg-primary/5 border border-primary/20">
              Valor total: <strong>{formatCurrency(valorTotal)}</strong>
            </div>
          </div>
        )}

        {/* Cartão de Crédito */}
        {metodo === 'cartao_credito' && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
            <ParcelasSelector
              parcelas={value.parcelas_cartao}
              onChange={(p) => handleChange({ parcelas_cartao: p })}
              valor={valorTotal}
            />
          </div>
        )}

        {/* Fracionado */}
        {metodo === 'fracionado' && (
          <div className="space-y-4">
            {/* Parte à vista */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">1</span>
                Parte à vista
              </h4>
              <div className="space-y-2">
                <Label className="text-sm">Valor à vista</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    min={0}
                    max={valorTotal}
                    step="0.01"
                    value={value.valor_avista || ''}
                    onChange={(e) => handleChange({ valor_avista: parseFloat(e.target.value) || undefined })}
                    placeholder="0,00"
                    className="max-w-[200px]"
                  />
                </div>
              </div>
              <FormaAvistaSelector
                value={value.forma_avista_fracionado}
                onChange={(v) => handleChange({ forma_avista_fracionado: v })}
              />
            </div>

            {/* Parte no cartão */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">2</span>
                Parte no Cartão de Crédito
              </h4>
              {value.valor_avista ? (
                <>
                  <div className="text-xs text-muted-foreground">
                    Valor restante: <strong>{formatCurrency(Math.max(0, valorTotal - (value.valor_avista || 0)))}</strong>
                  </div>
                  <ParcelasSelector
                    parcelas={value.parcelas_cartao_fracionado}
                    onChange={(p) => handleChange({ parcelas_cartao_fracionado: p })}
                    valor={Math.max(0, valorTotal - (value.valor_avista || 0))}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Informe o valor à vista primeiro.</p>
              )}
            </div>
          </div>
        )}

        {/* 2 Cartões diferentes */}
        {metodo === 'dois_cartoes' && (
          <div className="space-y-4">
            {/* Cartão 1 */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">1</span>
                Cartão 1
              </h4>
              <div className="space-y-2">
                <Label className="text-sm">Valor no Cartão 1</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    min={0}
                    max={valorTotal}
                    step="0.01"
                    value={value.valor_cartao1 || ''}
                    onChange={(e) => handleChange({ valor_cartao1: parseFloat(e.target.value) || undefined })}
                    placeholder="0,00"
                    className="max-w-[200px]"
                  />
                </div>
              </div>
              {value.valor_cartao1 ? (
                <ParcelasSelector
                  parcelas={value.parcelas_cartao1}
                  onChange={(p) => handleChange({ parcelas_cartao1: p })}
                  valor={value.valor_cartao1}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Informe o valor do Cartão 1.</p>
              )}
            </div>

            {/* Cartão 2 */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">2</span>
                Cartão 2
              </h4>
              {value.valor_cartao1 ? (
                <>
                  <div className="text-xs text-muted-foreground">
                    Valor restante: <strong>{formatCurrency(Math.max(0, valorTotal - (value.valor_cartao1 || 0)))}</strong>
                  </div>
                  <ParcelasSelector
                    parcelas={value.parcelas_cartao2}
                    onChange={(p) => handleChange({ parcelas_cartao2: p })}
                    valor={Math.max(0, valorTotal - (value.valor_cartao1 || 0))}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Informe o valor do Cartão 1 primeiro.</p>
              )}
            </div>
          </div>
        )}

        {/* Resumo Final */}
        {metodo && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <p className="text-sm font-medium">Resumo do Pagamento</p>
            <div className="space-y-1 text-sm">
              {metodo === 'avista' && value.forma_avista && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">À vista ({FORMAS_AVISTA.find(f => f.value === value.forma_avista)?.label})</span>
                  <span className="font-medium">{formatCurrency(valorTotal)}</span>
                </div>
              )}

              {metodo === 'cartao_credito' && value.parcelas_cartao && (
                <>
                  {(() => {
                    const { totalComJuros, valorParcela, taxa } = calcularComJuros(valorTotal, value.parcelas_cartao);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cartão {value.parcelas_cartao}x{taxa > 0 ? ` (+${(taxa*100).toFixed(0)}%)` : ''}</span>
                          <span className="font-medium">{value.parcelas_cartao}x de {formatCurrency(valorParcela)}</span>
                        </div>
                        {taxa > 0 && (
                          <div className="flex justify-between text-xs text-destructive">
                            <span>Juros</span>
                            <span>+{formatCurrency(totalComJuros - valorTotal)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}

              {metodo === 'fracionado' && value.valor_avista && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">À vista ({FORMAS_AVISTA.find(f => f.value === value.forma_avista_fracionado)?.label || '—'})</span>
                    <span className="font-medium">{formatCurrency(value.valor_avista)}</span>
                  </div>
                  {value.parcelas_cartao_fracionado && (() => {
                    const restante = Math.max(0, valorTotal - value.valor_avista);
                    const { totalComJuros, valorParcela, taxa } = calcularComJuros(restante, value.parcelas_cartao_fracionado);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cartão {value.parcelas_cartao_fracionado}x{taxa > 0 ? ` (+${(taxa*100).toFixed(0)}%)` : ''}</span>
                          <span className="font-medium">{value.parcelas_cartao_fracionado}x de {formatCurrency(valorParcela)}</span>
                        </div>
                        {taxa > 0 && (
                          <div className="flex justify-between text-xs text-destructive">
                            <span>Juros cartão</span>
                            <span>+{formatCurrency(totalComJuros - restante)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}

              {metodo === 'dois_cartoes' && value.valor_cartao1 && (
                <>
                  {value.parcelas_cartao1 && (() => {
                    const { totalComJuros, valorParcela, taxa } = calcularComJuros(value.valor_cartao1!, value.parcelas_cartao1!);
                    return (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cartão 1 — {value.parcelas_cartao1}x{taxa > 0 ? ` (+${(taxa*100).toFixed(0)}%)` : ''}</span>
                        <span className="font-medium">{value.parcelas_cartao1}x de {formatCurrency(valorParcela)}</span>
                      </div>
                    );
                  })()}
                  {value.parcelas_cartao2 && (() => {
                    const v2 = Math.max(0, valorTotal - (value.valor_cartao1 || 0));
                    const { totalComJuros, valorParcela, taxa } = calcularComJuros(v2, value.parcelas_cartao2!);
                    return (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cartão 2 — {value.parcelas_cartao2}x{taxa > 0 ? ` (+${(taxa*100).toFixed(0)}%)` : ''}</span>
                        <span className="font-medium">{value.parcelas_cartao2}x de {formatCurrency(valorParcela)}</span>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="flex justify-between pt-2 border-t font-medium">
                <span>Total Final</span>
                <span className={totalFinal > valorTotal ? 'text-destructive' : ''}>
                  {formatCurrency(totalFinal)}
                </span>
              </div>
              {totalFinal > valorTotal && (
                <div className="text-xs text-destructive">
                  Acréscimo de juros: {formatCurrency(totalFinal - valorTotal)}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper for labels
export function getFormaPagamentoLabel(tipo?: string): string {
  const map: Record<string, string> = {
    pix: 'PIX', transferencia: 'Transferência', debito: 'Débito', boleto: 'Boleto',
    cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', outro: 'Outro',
  };
  return map[tipo || ''] || tipo || '';
}

// Validation
export function validarCondicoesPagamento(condicoes?: CondicoesPagamento): string[] {
  const erros: string[] = [];
  if (!condicoes?.metodo_principal) {
    erros.push('Selecione o método de pagamento');
    return erros;
  }
  const m = condicoes.metodo_principal;
  if (m === 'avista' && !condicoes.forma_avista) {
    erros.push('Selecione a forma de pagamento à vista');
  }
  if (m === 'cartao_credito' && !condicoes.parcelas_cartao) {
    erros.push('Selecione o número de parcelas');
  }
  if (m === 'fracionado') {
    if (!condicoes.valor_avista) erros.push('Informe o valor à vista');
    if (!condicoes.forma_avista_fracionado) erros.push('Selecione a forma de pagamento à vista');
    if (!condicoes.parcelas_cartao_fracionado) erros.push('Selecione as parcelas do cartão');
  }
  if (m === 'dois_cartoes') {
    if (!condicoes.valor_cartao1) erros.push('Informe o valor do Cartão 1');
    if (!condicoes.parcelas_cartao1) erros.push('Selecione as parcelas do Cartão 1');
    if (!condicoes.parcelas_cartao2) erros.push('Selecione as parcelas do Cartão 2');
  }
  return erros;
}
