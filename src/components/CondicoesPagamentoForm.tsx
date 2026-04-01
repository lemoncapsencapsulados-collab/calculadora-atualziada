import { useMemo } from 'react';
import { CondicoesPagamento, MetodoPagamentoPrincipal, ParcelaPixBoleto, CartaoPagamento } from '@/types/orcamento';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Wallet,
  Banknote,
  Shuffle,
  Plus,
  Minus,
  Percent,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
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

const METODOS: { value: MetodoPagamentoPrincipal; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'pix_boleto', label: 'Pix / Boleto', icon: Banknote },
  { value: 'cartao_credito', label: 'Cartão de Crédito', icon: CreditCard },
  { value: 'misto', label: 'Misto', icon: Shuffle },
];

// ============= Pix/Boleto Section =============
function PixBoletoSection({
  parcelas,
  onChange,
  valorTotal,
}: {
  parcelas: ParcelaPixBoleto[];
  onChange: (p: ParcelaPixBoleto[]) => void;
  valorTotal: number;
}) {
  const addParcela = () => onChange([...parcelas, { tipo_valor: 'fixo', valor: 0 }]);
  const removeParcela = () => { if (parcelas.length > 1) onChange(parcelas.slice(0, -1)); };
  const updateParcela = (i: number, updates: Partial<ParcelaPixBoleto>) => {
    const next = parcelas.map((p, idx) => idx === i ? { ...p, ...updates } : p);
    onChange(next);
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Parcelas Pix/Boleto</Label>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={removeParcela} disabled={parcelas.length <= 1}>
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-sm w-6 text-center">{parcelas.length}</span>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={addParcela}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {parcelas.map((parcela, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded border bg-background">
          <span className="text-xs text-muted-foreground w-16">Parcela {i + 1}</span>
          <Button
            type="button"
            variant={parcela.tipo_valor === 'percentual' ? 'default' : 'outline'}
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => updateParcela(i, { tipo_valor: 'percentual', valor: 0 })}
            title="Porcentagem"
          >
            <Percent className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            variant={parcela.tipo_valor === 'fixo' ? 'default' : 'outline'}
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => updateParcela(i, { tipo_valor: 'fixo', valor: 0 })}
            title="Valor fixo"
          >
            <DollarSign className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs text-muted-foreground">{parcela.tipo_valor === 'percentual' ? '%' : 'R$'}</span>
            <Input
              type="number"
              min={0}
              step={parcela.tipo_valor === 'percentual' ? 1 : 0.01}
              value={parcela.valor || ''}
              onChange={(e) => updateParcela(i, { valor: parseFloat(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
          {parcela.tipo_valor === 'percentual' && parcela.valor > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              = {formatCurrency(valorTotal * parcela.valor / 100)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============= Cartão Section =============
function CartaoSection({
  cartoes,
  onChange,
  valorTotal,
}: {
  cartoes: CartaoPagamento[];
  onChange: (c: CartaoPagamento[]) => void;
  valorTotal: number;
}) {
  const addCartao = () => onChange([...cartoes, { tipo_valor: 'fixo', valor: 0, parcelas: 1 }]);
  const removeCartao = () => { if (cartoes.length > 1) onChange(cartoes.slice(0, -1)); };
  const updateCartao = (i: number, updates: Partial<CartaoPagamento>) => {
    const next = cartoes.map((c, idx) => idx === i ? { ...c, ...updates } : c);
    onChange(next);
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Cartões de Crédito</Label>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={removeCartao} disabled={cartoes.length <= 1}>
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-sm w-6 text-center">{cartoes.length}</span>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={addCartao}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {cartoes.map((cartao, i) => {
        const valorBase = cartao.tipo_valor === 'percentual'
          ? valorTotal * cartao.valor / 100
          : cartao.valor;
        const { totalComJuros, valorParcela, taxa } = calcularComJuros(valorBase, cartao.parcelas);

        return (
          <div key={i} className="space-y-2 p-2 rounded border bg-background">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Cartão {i + 1}</span>
              <Button
                type="button"
                variant={cartao.tipo_valor === 'percentual' ? 'default' : 'outline'}
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => updateCartao(i, { tipo_valor: 'percentual', valor: 0 })}
                title="Porcentagem"
              >
                <Percent className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                variant={cartao.tipo_valor === 'fixo' ? 'default' : 'outline'}
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => updateCartao(i, { tipo_valor: 'fixo', valor: 0 })}
                title="Valor fixo"
              >
                <DollarSign className="w-3 h-3" />
              </Button>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs text-muted-foreground">{cartao.tipo_valor === 'percentual' ? '%' : 'R$'}</span>
                <Input
                  type="number"
                  min={0}
                  step={cartao.tipo_valor === 'percentual' ? 1 : 0.01}
                  value={cartao.valor || ''}
                  onChange={(e) => updateCartao(i, { valor: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              {cartao.tipo_valor === 'percentual' && cartao.valor > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  = {formatCurrency(valorBase)}
                </span>
              )}
            </div>
            <div className="pl-16">
              <Select value={cartao.parcelas.toString()} onValueChange={(v) => updateCartao(i, { parcelas: parseInt(v) })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Parcelas" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map(p => {
                    const { valorParcela: vp, taxa: t } = calcularComJuros(valorBase, p);
                    const jurosLabel = t > 0 ? ` (+${(t * 100).toFixed(0)}%)` : ' (s/ juros)';
                    return (
                      <SelectItem key={p} value={p.toString()}>
                        {p}x de {formatCurrency(vp)}{jurosLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {taxa > 0 && valorBase > 0 && (
                <div className="text-xs text-destructive mt-1">
                  Juros: +{formatCurrency(totalComJuros - valorBase)} — Total cartão: {formatCurrency(totalComJuros)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============= Validation Summary =============
function ValidationSummary({ somaReais, valorTotal }: { somaReais: number; valorTotal: number }) {
  const diff = somaReais - valorTotal;
  const isValid = Math.abs(diff) < 0.01;

  return (
    <div className={`p-3 rounded-lg border flex items-center gap-2 text-sm ${isValid ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300'}`}>
      {isValid ? (
        <>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>✓ Valores conferem — Total: <strong>{formatCurrency(valorTotal)}</strong></span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Soma: <strong>{formatCurrency(somaReais)}</strong> — {diff > 0 ? 'Excede' : 'Faltam'} <strong>{formatCurrency(Math.abs(diff))}</strong>
          </span>
        </>
      )}
    </div>
  );
}

// ============= Helpers =============
function somaParcelasPixBoleto(parcelas: ParcelaPixBoleto[], valorTotal: number): number {
  return parcelas.reduce((acc, p) => {
    return acc + (p.tipo_valor === 'percentual' ? valorTotal * p.valor / 100 : p.valor);
  }, 0);
}

function somaCartoes(cartoes: CartaoPagamento[], valorTotal: number): number {
  return cartoes.reduce((acc, c) => {
    return acc + (c.tipo_valor === 'percentual' ? valorTotal * c.valor / 100 : c.valor);
  }, 0);
}

// ============= Main Component =============
export default function CondicoesPagamentoForm({
  value,
  onChange,
  valorTotal = 0,
}: CondicoesPagamentoFormProps) {
  const metodo = value.metodo_principal;

  const setMetodo = (m: MetodoPagamentoPrincipal) => {
    const base: CondicoesPagamento = { metodo_principal: m };
    if (m === 'pix_boleto') base.parcelas_pix_boleto = [{ tipo_valor: 'fixo', valor: 0 }];
    if (m === 'cartao_credito') base.cartoes = [{ tipo_valor: 'fixo', valor: 0, parcelas: 1 }];
    if (m === 'misto') {
      base.misto_parcelas_pix_boleto = [{ tipo_valor: 'fixo', valor: 0 }];
      base.misto_cartoes = [{ tipo_valor: 'fixo', valor: 0, parcelas: 1 }];
    }
    onChange(base);
  };

  const somaReais = useMemo(() => {
    if (!metodo) return 0;
    if (metodo === 'pix_boleto') return somaParcelasPixBoleto(value.parcelas_pix_boleto || [], valorTotal);
    if (metodo === 'cartao_credito') return somaCartoes(value.cartoes || [], valorTotal);
    if (metodo === 'misto') {
      return somaParcelasPixBoleto(value.misto_parcelas_pix_boleto || [], valorTotal) +
        somaCartoes(value.misto_cartoes || [], valorTotal);
    }
    return 0;
  }, [metodo, value, valorTotal]);

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
          <div className="grid grid-cols-3 gap-2">
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

        {/* Pix/Boleto */}
        {metodo === 'pix_boleto' && (
          <PixBoletoSection
            parcelas={value.parcelas_pix_boleto || []}
            onChange={(p) => onChange({ ...value, parcelas_pix_boleto: p })}
            valorTotal={valorTotal}
          />
        )}

        {/* Cartão de Crédito */}
        {metodo === 'cartao_credito' && (
          <CartaoSection
            cartoes={value.cartoes || []}
            onChange={(c) => onChange({ ...value, cartoes: c })}
            valorTotal={valorTotal}
          />
        )}

        {/* Misto */}
        {metodo === 'misto' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Pix / Boleto
            </h4>
            <PixBoletoSection
              parcelas={value.misto_parcelas_pix_boleto || []}
              onChange={(p) => onChange({ ...value, misto_parcelas_pix_boleto: p })}
              valorTotal={valorTotal}
            />
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Cartão de Crédito
            </h4>
            <CartaoSection
              cartoes={value.misto_cartoes || []}
              onChange={(c) => onChange({ ...value, misto_cartoes: c })}
              valorTotal={valorTotal}
            />
          </div>
        )}

        {/* Validation Summary */}
        {metodo && valorTotal > 0 && (
          <ValidationSummary somaReais={somaReais} valorTotal={valorTotal} />
        )}

        {/* Resumo com juros */}
        {metodo && (metodo === 'cartao_credito' || metodo === 'misto') && (() => {
          const allCartoes = metodo === 'cartao_credito' ? (value.cartoes || []) : (value.misto_cartoes || []);
          const totalJuros = allCartoes.reduce((acc, c) => {
            const base = c.tipo_valor === 'percentual' ? valorTotal * c.valor / 100 : c.valor;
            const { totalComJuros } = calcularComJuros(base, c.parcelas);
            return acc + (totalComJuros - base);
          }, 0);

          if (totalJuros > 0) {
            return (
              <div className="text-xs text-destructive p-2 rounded bg-destructive/5 border border-destructive/20">
                Acréscimo total de juros: <strong>{formatCurrency(totalJuros)}</strong>
              </div>
            );
          }
          return null;
        })()}
      </CardContent>
    </Card>
  );
}

// ============= Exported helpers =============
export function getFormaPagamentoLabel(tipo?: string): string {
  const map: Record<string, string> = {
    pix: 'PIX', transferencia: 'Transferência', debito: 'Débito', boleto: 'Boleto',
    cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', outro: 'Outro',
    pix_boleto: 'Pix/Boleto', misto: 'Misto',
  };
  return map[tipo || ''] || tipo || '';
}

export function validarCondicoesPagamento(condicoes?: CondicoesPagamento, valorTotal?: number): string[] {
  const erros: string[] = [];
  if (!condicoes?.metodo_principal) {
    erros.push('Selecione o método de pagamento');
    return erros;
  }
  const m = condicoes.metodo_principal;
  const vt = valorTotal || 0;

  if (m === 'pix_boleto') {
    const parcelas = condicoes.parcelas_pix_boleto || [];
    if (parcelas.length === 0) erros.push('Adicione pelo menos uma parcela');
    const soma = somaParcelasPixBoleto(parcelas, vt);
    if (vt > 0 && Math.abs(soma - vt) >= 0.01) {
      erros.push(`Soma dos pagamentos (${formatCurrency(soma)}) difere do total (${formatCurrency(vt)})`);
    }
  }

  if (m === 'cartao_credito') {
    const cartoes = condicoes.cartoes || [];
    if (cartoes.length === 0) erros.push('Adicione pelo menos um cartão');
    const soma = somaCartoes(cartoes, vt);
    if (vt > 0 && Math.abs(soma - vt) >= 0.01) {
      erros.push(`Soma dos pagamentos (${formatCurrency(soma)}) difere do total (${formatCurrency(vt)})`);
    }
  }

  if (m === 'misto') {
    const parcelas = condicoes.misto_parcelas_pix_boleto || [];
    const cartoes = condicoes.misto_cartoes || [];
    if (parcelas.length === 0 && cartoes.length === 0) erros.push('Adicione pelo menos um pagamento');
    const soma = somaParcelasPixBoleto(parcelas, vt) + somaCartoes(cartoes, vt);
    if (vt > 0 && Math.abs(soma - vt) >= 0.01) {
      erros.push(`Soma dos pagamentos (${formatCurrency(soma)}) difere do total (${formatCurrency(vt)})`);
    }
  }

  return erros;
}
