import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import { escadaDoProduto, indiceDaFaixa, temEscada } from '@/lib/escadaVolume';

/**
 * A escada de preço por volume de um produto, em tabela.
 *
 * Mostra as seis faixas de uma vez porque a pergunta do comercial nunca é
 * "quanto custa", é "quanto cai se eu dobrar". Com um preço só na tela, essa
 * resposta exigia abrir a planilha.
 *
 * A margem de cada degrau aparece quando se sabe o custo: é ela que diz até
 * onde dá para descer. Degrau fora dos limites da categoria sai em vermelho,
 * como na planilha.
 */

interface Props {
  precoCatalogo: number;
  tipoProduto: string | null | undefined;
  /** Custo de produção por pote. Sem ele, a tabela mostra só preço. */
  custoPorPote?: number | null;
  /** Quantidade em negociação, para destacar a faixa em que ela cai. */
  quantidadeEmFoco?: number | null;
  compacta?: boolean;
  className?: string;
}

export default function EscadaVolumeTabela({
  precoCatalogo,
  tipoProduto,
  custoPorPote,
  quantidadeEmFoco,
  compacta,
  className,
}: Props) {
  if (!temEscada(tipoProduto)) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Preço único, fora da escada de volume — a margem da goma já está no mínimo da categoria.
      </p>
    );
  }

  const degraus = escadaDoProduto(precoCatalogo, tipoProduto, custoPorPote);
  const emFoco = quantidadeEmFoco ? indiceDaFaixa(quantidadeEmFoco) : null;
  const mostrarMargem = degraus.some((d) => d.margemPercentual != null);

  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-medium">
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" /> Potes por SKU
              </span>
            </th>
            <th className="px-2 py-1.5 text-right font-medium">Preço / pote</th>
            {!compacta && <th className="px-2 py-1.5 text-right font-medium">Desconto</th>}
            {mostrarMargem && <th className="px-2 py-1.5 text-right font-medium">Margem</th>}
          </tr>
        </thead>
        <tbody>
          {degraus.map((d) => {
            const atual = emFoco === d.indice;
            const catalogo = d.indice === 1;
            return (
              <tr
                key={d.indice}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  atual && 'bg-primary/10 font-medium',
                )}
              >
                <td className="px-2 py-1.5">
                  {d.faixa.rotulo}
                  {catalogo && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">catálogo</span>
                  )}
                  {atual && (
                    <span className="ml-1.5 text-[10px] text-primary">nesta negociação</span>
                  )}
                </td>
                <td className="num px-2 py-1.5 text-right">{formatCurrency(d.precoPote)}</td>
                {!compacta && (
                  <td className="num px-2 py-1.5 text-right text-muted-foreground">
                    {d.descontoPercentual > 0 ? `−${d.descontoPercentual.toFixed(2).replace(/\.?0+$/, '')}%` : '—'}
                  </td>
                )}
                {mostrarMargem && (
                  <td
                    className={cn(
                      'num px-2 py-1.5 text-right',
                      d.foraDaFaixaDeMargem ? 'font-semibold text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {d.margemPercentual == null ? '—' : `${d.margemPercentual.toFixed(1)}%`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground">
        A faixa vale por SKU: três produtos com 100 potes cada pagam a faixa de 100 a 299 nos três.
      </p>
    </div>
  );
}
