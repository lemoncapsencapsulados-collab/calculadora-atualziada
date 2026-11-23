import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import {
  BONUS_MARGEM_VOLUME_TOPO,
  escadaDoProduto,
  indiceDaFaixa,
  INDICE_FAIXA_CATALOGO as INDICE_CATALOGO,
} from '@/lib/escadaVolume';

/**
 * A escada de preço por volume de um produto, em tabela.
 *
 * Mostra as seis faixas de uma vez porque a pergunta do comercial nunca é
 * "quanto custa", é "quanto cai se eu dobrar". Com um preço só na tela, essa
 * resposta exigia abrir a planilha.
 *
 * A margem de cada degrau aparece quando se sabe o custo: é ela que diz até
 * onde dá para descer. Degrau fora dos limites da faixa sai em vermelho,
 * como na planilha.
 *
 * O degrau de 5.000 vem marcado: ele carrega dois pontos de margem que a
 * fábrica abriu para o pedido grande, e um degrau que parece só "o último da
 * lista" não vende esse diferencial.
 */

interface Props {
  precoCatalogo: number;
  tipoProduto: string | null | undefined;
  /** Custo de produção por pote. Sem ele, a tabela mostra só preço. */
  custoPorPote?: number | null;
  /** Quantidade em negociação, para destacar a faixa em que ela cai. */
  quantidadeEmFoco?: number | null;
  compacta?: boolean;
  /**
   * `linha` imprime os degraus numa linha corrida, sem moldura nem cabeçalho.
   * É o formato para o card, onde a escada é referência de leitura rápida e
   * uma tabela com borda rouba a atenção do que o card existe para mostrar.
   */
  variante?: 'tabela' | 'linha' | 'coluna';
  className?: string;
}

export default function EscadaVolumeTabela({
  precoCatalogo,
  tipoProduto,
  custoPorPote,
  quantidadeEmFoco,
  compacta,
  variante = 'tabela',
  className,
}: Props) {
  const degraus = escadaDoProduto(precoCatalogo, tipoProduto, custoPorPote);
  const emFoco = quantidadeEmFoco ? indiceDaFaixa(quantidadeEmFoco) : null;
  const mostrarMargem = degraus.some((d) => d.margemPercentual != null);

  if (variante === 'coluna') {
    // Formato para o campo "Preço de Venda", que é estreito: uma linha por
    // degrau, potes à esquerda e preço à direita. A faixa do catálogo fica
    // marcada porque é dela que as outras descem -- e é a única que alguém
    // edita.
    return (
      <div className={cn('space-y-0.5 text-xs', className)}>
        {degraus.map((d) => {
          const atual = emFoco === d.indice;
          const catalogo = d.indice === INDICE_CATALOGO;
          const bonus = d.bonusDeVolume;
          return (
            <div
              key={d.indice}
              className={cn(
                'flex items-baseline justify-between gap-2 tabular-nums',
                atual && 'text-primary',
                !atual && bonus && 'text-emerald-700 dark:text-emerald-400',
                !atual && !bonus && catalogo && 'text-foreground',
                !atual && !bonus && !catalogo && 'text-muted-foreground',
              )}
              title={[
                `${d.faixa.rotulo} potes por SKU`,
                d.margemPercentual == null ? null : `margem ${d.margemPercentual.toFixed(1)}%`,
                bonus
                  ? `inclui ${(BONUS_MARGEM_VOLUME_TOPO * 100).toFixed(0)} pontos de margem que a fábrica abre acima de 4.999 potes`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <span className="num">
                {d.faixa.de.toLocaleString('pt-BR')}
                {d.faixa.ate ? '' : '+'}
              </span>
              <span className={cn('num', (catalogo || atual || bonus) && 'font-semibold')}>
                {formatCurrency(d.precoPote)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (variante === 'linha') {
    return (
      <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs', className)}>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3 w-3" /> Por volume
        </span>
        {degraus.map((d) => {
          const atual = emFoco === d.indice;
          const catalogo = d.indice === INDICE_CATALOGO;
          return (
            <span
              key={d.indice}
              className={cn(
                'whitespace-nowrap',
                atual && 'text-primary',
                catalogo && !atual && 'text-foreground',
                !catalogo && !atual && 'text-muted-foreground',
              )}
              title={[
                `${d.faixa.rotulo} potes`,
                d.margemPercentual == null ? null : `margem ${d.margemPercentual.toFixed(1)}%`,
                d.bonusDeVolume
                  ? `inclui ${(BONUS_MARGEM_VOLUME_TOPO * 100).toFixed(0)} pontos de margem do volume`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <span className="num">
                {d.faixa.de.toLocaleString('pt-BR')}
                {d.faixa.ate ? '' : '+'}
              </span>{' '}
              <span className={cn('num', (catalogo || atual) && 'font-medium')}>
                {formatCurrency(d.precoPote)}
              </span>
            </span>
          );
        })}
      </div>
    );
  }

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
            const catalogo = d.indice === INDICE_CATALOGO;
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
                  {d.bonusDeVolume && (
                    <span className="ml-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                      +{(BONUS_MARGEM_VOLUME_TOPO * 100).toFixed(0)} pts de margem
                    </span>
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
        Acima de 4.999 potes a fábrica abre mais {(BONUS_MARGEM_VOLUME_TOPO * 100).toFixed(0)} pontos
        de margem.
      </p>
    </div>
  );
}
