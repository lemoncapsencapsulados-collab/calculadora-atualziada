import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileText, Save, Star } from 'lucide-react';
import { arredondarReais } from '@/lib/utils';
import { calcularPrecificacaoPorPreco, validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import type { PrecificacaoCalculada } from '@/types/precificacao';

/**
 * Departamento da formula.
 * `white_label` e' o Catalogo Lemon: o resto do sistema reconhece uma formula de
 * catalogo pelo cliente dela, entao a escolha aqui define o nome do cliente.
 */
export type Departamento = 'private_label' | 'white_label';

/** Nome de cliente que marca uma formula como pertencente ao catalogo. */
export const CLIENTE_CATALOGO = 'Catálogo Lemon';

export interface SalvarCalculoResultado {
  departamento: Departamento;
  precoVenda: number;
  resultado: PrecificacaoCalculada;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nomeFormula: string;
  tipoProduto: string;
  /** Custo de materia-prima por unidade. */
  totalMp: number;
  /** Custo de embalagem por unidade. */
  totalEmbalagem: number;
  configuracaoAtiva: any;
  salvando?: boolean;
  onConfirmar: (r: SalvarCalculoResultado) => void | Promise<void>;
}

export default function SalvarCalculoDialog({
  open,
  onOpenChange,
  nomeFormula,
  tipoProduto,
  totalMp,
  totalEmbalagem,
  configuracaoAtiva,
  salvando,
  onConfirmar,
}: Props) {
  const [departamento, setDepartamento] = useState<Departamento>('private_label');
  const [precoInput, setPrecoInput] = useState('30');

  useEffect(() => {
    if (open) {
      setDepartamento('private_label');
      setPrecoInput('30');
    }
  }, [open]);

  const overhead = useMemo(() => {
    const v = Number(configuracaoAtiva?.overhead_unitario);
    return Number.isFinite(v) && v > 0 ? v : 3;
  }, [configuracaoAtiva]);

  const custoProducao = arredondarReais(Number(totalMp) + Number(totalEmbalagem) + overhead);

  // Recalcula a cada tecla, igual ao fluxo de "Precificar".
  const resultado = useMemo<PrecificacaoCalculada | null>(() => {
    const preco = parseFloat(precoInput);
    if (!configuracaoAtiva || !Number.isFinite(preco) || preco <= 0) return null;
    try {
      return calcularPrecificacaoPorPreco(
        { custoMateriaPrima: Number(totalMp), custoEmbalagem: Number(totalEmbalagem) },
        { maoObraDireta: 0, energia: 0, depreciacao: 0, administrativo: 0 },
        preco,
        configuracaoAtiva,
      );
    } catch {
      return null;
    }
  }, [precoInput, configuracaoAtiva, totalMp, totalEmbalagem]);

  const validacao = resultado
    ? validarMargemPorTipo(resultado.margemLucroPercentual, tipoProduto)
    : null;

  const podeSalvar = !!resultado && !salvando;

  const opcoes: { valor: Departamento; titulo: string; descricao: string; icone: typeof FileText }[] = [
    {
      valor: 'private_label',
      titulo: 'Private Label',
      descricao: 'Fórmula personalizada, vinculada ao cliente.',
      icone: FileText,
    },
    {
      valor: 'white_label',
      titulo: 'White Label',
      descricao: 'Entra no Catálogo Lemon, disponível para qualquer cliente.',
      icone: Star,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Salvar e precificar
          </DialogTitle>
          <DialogDescription>
            {nomeFormula || 'Fórmula sem nome'} — escolha o departamento e o preço de venda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Departamento</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {opcoes.map(({ valor, titulo, descricao, icone: Icone }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setDepartamento(valor)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    departamento === valor
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icone className="h-4 w-4" />
                    {titulo}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{descricao}</span>
                </button>
              ))}
            </div>
            {departamento === 'white_label' && (
              <p className="text-xs text-muted-foreground">
                A fórmula será salva como <strong>{CLIENTE_CATALOGO}</strong>, e não no nome do
                cliente digitado na calculadora.
              </p>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Matéria-prima</span>
              <span>R$ {arredondarReais(Number(totalMp)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Embalagem</span>
              <span>R$ {arredondarReais(Number(totalEmbalagem)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overhead</span>
              <span>R$ {arredondarReais(overhead).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-sm font-semibold">
              <span>Custo de produção</span>
              <span>R$ {custoProducao.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preco-venda">Preço de Venda (R$)</Label>
            <Input
              id="preco-venda"
              type="number"
              step="0.00001"
              value={precoInput}
              onChange={(e) => setPrecoInput(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {resultado ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Impostos (12%)</span>
                <span>R$ {resultado.totalImpostos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lucro por unidade</span>
                <span className="font-medium">R$ {resultado.margemLucroValor.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-semibold">Margem de lucro</span>
                <Badge variant="outline" className={cn(validacao?.color, validacao?.borderColor)}>
                  {resultado.margemLucroPercentual.toFixed(1)}%
                </Badge>
              </div>
              {validacao?.mensagem && (
                <p className={cn('text-xs', validacao.color)}>
                  {validacao.mensagem}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Informe um preço de venda para ver a margem.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={() => resultado && onConfirmar({ departamento, precoVenda: resultado.precoVenda, resultado })}
            disabled={!podeSalvar}
          >
            <Save className="h-4 w-4 mr-1" />
            {salvando ? 'Salvando...' : 'Salvar cálculo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
