import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import { formatCurrency } from '@/lib/unitConversion';
import { calcularPrecificacaoPorPreco, validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import type { ConfiguracaoCustos } from '@/types/precificacao';

interface Props {
  precificacao: {
    id: string;
    preco_venda: number;
    custo_materia_prima: number;
    custo_embalagem: number;
    formulas?: { tipo_produto?: string } | null;
    [k: string]: unknown;
  };
  configuracaoAtiva: ConfiguracaoCustos | null;
  onSalvo?: () => void;
}

/**
 * Preco de venda editavel direto no card, com a margem recalculada a cada tecla.
 *
 * Existe para o ajuste rapido -- mudar so' o preco e ver no que da'. Quem precisa
 * mexer em insumo ou embalagem continua indo pelo "Editar Produto".
 */
export default function PrecoVendaInline({ precificacao, configuracaoAtiva, onSalvo }: Props) {
  const { atualizarPrecificacao } = usePrecificacao();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(Number(precificacao.preco_venda) || 0));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editando) setValor(String(Number(precificacao.preco_venda) || 0));
  }, [editando, precificacao.preco_venda]);

  const resultado = useMemo(() => {
    const preco = parseFloat(valor);
    if (!configuracaoAtiva || !Number.isFinite(preco) || preco <= 0) return null;
    try {
      return calcularPrecificacaoPorPreco(
        {
          custoMateriaPrima: Number(precificacao.custo_materia_prima) || 0,
          custoEmbalagem: Number(precificacao.custo_embalagem) || 0,
        },
        { maoObraDireta: 0, energia: 0, depreciacao: 0, administrativo: 0 },
        preco,
        configuracaoAtiva,
      );
    } catch {
      return null;
    }
  }, [valor, configuracaoAtiva, precificacao.custo_materia_prima, precificacao.custo_embalagem]);

  const validacao = resultado
    ? validarMargemPorTipo(resultado.margemLucroPercentual, precificacao.formulas?.tipo_produto || '')
    : null;

  const salvar = async () => {
    if (!resultado) {
      toast.error('Informe um preço de venda válido.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarPrecificacao.mutateAsync({
        id: precificacao.id,
        total_custos_producao: resultado.totalCustosProducao,
        total_impostos: resultado.totalImpostos,
        preco_venda: resultado.precoVenda,
        markup_bruto: resultado.markupBruto,
        margem_lucro_percentual: resultado.margemLucroPercentual,
        margem_lucro_valor: resultado.margemLucroValor,
      } as any);
      toast.success('Preço atualizado.');
      setEditando(false);
      onSalvo?.();
    } finally {
      setSalvando(false);
    }
  };

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="group flex items-baseline gap-1 text-left"
        title="Editar preço de venda"
      >
        <span className="text-lg font-bold text-primary">
          {formatCurrency(Number(precificacao.preco_venda) || 0)}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          type="number"
          step="0.01"
          className="h-8 w-24"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void salvar();
            if (e.key === 'Escape') setEditando(false);
          }}
        />
        <Button size="icon" className="h-8 w-8" onClick={salvar} disabled={!resultado || salvando}>
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setEditando(false)}
          disabled={salvando}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {resultado && (
        <p className={cn('text-xs font-medium', validacao?.color)}>
          {resultado.margemLucroPercentual.toFixed(1)}% ({formatCurrency(resultado.margemLucroValor)})
          {validacao?.status === 'baixa' && ' — abaixo do mínimo'}
        </p>
      )}
    </div>
  );
}
