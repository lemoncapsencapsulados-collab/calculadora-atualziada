import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import {
  BONUS_MARGEM_VOLUME_TOPO,
  escadaDoProduto,
  FAIXAS_VOLUME,
  indiceDaFaixa,
  INDICE_FAIXA_TOPO,
} from '@/lib/escadaVolume';

/**
 * As faixas de volume como CONTROLE, e não como consulta.
 *
 * A escada já aparecia no orçamento em dois lugares -- a tabela de preços e o
 * aviso de "está perdendo dinheiro" --, mas os dois só informavam: para
 * aproveitar um degrau o vendedor tinha que ler o preço, digitar a quantidade
 * num campo e digitar o preço noutro. Três passos e duas chances de errar,
 * no meio de uma conversa com o cliente.
 *
 * Aqui cada degrau é um botão: um clique acerta quantidade e preço juntos. É
 * o mesmo dado das outras duas telas, só que acionável -- e por isso também
 * resolve "deixar claras as variáveis de preço", porque o vendedor vê as seis
 * opções lado a lado com o preço de cada uma.
 *
 * Só vale para o CATÁLOGO 2026: a escada é a tabela daquela prateleira, e
 * oferecer esses degraus numa fórmula personalizada prometeria um desconto
 * que a fábrica não combinou para ela.
 */

interface Props {
  /** Preço de catálogo do produto -- a faixa de 300 a 499. */
  precoCatalogo: number;
  /** `tipo_produto`: Encapsulados, Líquido, Solúvel ou Gummy. */
  tipoProduto: string | null | undefined;
  /** Custo de produção por pote, para a margem e para o degrau do topo. */
  custoPorPote?: number | null;
  /** Quantidade do item agora. */
  quantidade: number;
  /** O que está sendo cobrado, para avisar quando foge do programado. */
  precoCobrado?: number | null;
  /** Aplica faixa: quantidade e preço de uma vez. */
  onEscolherFaixa: (potes: number, preco: number) => void;
  className?: string;
}

export default function EscadaVolumeSeletor({
  precoCatalogo,
  tipoProduto,
  custoPorPote,
  quantidade,
  precoCobrado,
  onEscolherFaixa,
  className,
}: Props) {
  if (!(Number(precoCatalogo) > 0)) return null;

  const degraus = escadaDoProduto(precoCatalogo, tipoProduto, custoPorPote);
  const atual = indiceDaFaixa(quantidade);
  const degrauAtual = degraus[atual];

  const cobrado = Number(precoCobrado);
  const foraDoProgramado =
    Number.isFinite(cobrado) && cobrado > 0 && Math.abs(cobrado - degrauAtual.precoPote) >= 0.005;

  const irPara = (indice: number) => {
    const d = degraus[indice];
    if (!d) return;
    onEscolherFaixa(d.faixa.de, d.precoPote);
  };

  return (
    <div className={cn('rounded border border-border bg-muted/20 px-2.5 py-2', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3 w-3" /> Preço por volume · por SKU
        </span>

        {/* Subir e descer um degrau. O campo de quantidade continua aceitando
            qualquer número; isto é o atalho para os valores que já têm preço
            programado. */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6"
            disabled={atual <= 0}
            title="Um degrau abaixo"
            onClick={() => irPara(atual - 1)}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6"
            disabled={atual >= FAIXAS_VOLUME.length - 1}
            title="Um degrau acima"
            onClick={() => irPara(atual + 1)}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1 sm:grid-cols-6">
        {degraus.map((d) => {
          const selecionado = d.indice === atual;
          return (
            <button
              key={d.indice}
              type="button"
              onClick={() => irPara(d.indice)}
              title={[
                `${d.faixa.rotulo} potes por SKU`,
                d.margemPercentual == null ? null : `margem ${d.margemPercentual.toFixed(1)}%`,
                d.bonusDeVolume
                  ? `inclui ${(BONUS_MARGEM_VOLUME_TOPO * 100).toFixed(0)} pontos de margem que a fábrica abre acima de 4.999 potes`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              className={cn(
                'rounded border px-1.5 py-1 text-left transition-colors',
                selecionado
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'num block text-[10px] leading-tight',
                  selecionado ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {d.faixa.de.toLocaleString('pt-BR')}
                {d.faixa.ate ? '' : '+'}
              </span>
              <span
                className={cn(
                  'num block text-xs font-semibold leading-tight',
                  d.bonusDeVolume && !selecionado && 'text-emerald-700 dark:text-emerald-400',
                )}
              >
                {formatCurrency(d.precoPote)}
              </span>
              {d.indice === INDICE_FAIXA_TOPO && (
                <span className="block text-[9px] leading-tight text-emerald-700 dark:text-emerald-400">
                  +{(BONUS_MARGEM_VOLUME_TOPO * 100).toFixed(0)} pts
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {quantidade.toLocaleString('pt-BR')} {quantidade === 1 ? 'pote' : 'potes'} cai na faixa de{' '}
        <span className="num font-medium text-foreground">{degrauAtual.faixa.rotulo}</span> —{' '}
        <span className="num font-medium text-foreground">
          {formatCurrency(degrauAtual.precoPote)}
        </span>{' '}
        por pote
        {degrauAtual.margemPercentual != null && (
          <>
            , margem <span className="num">{degrauAtual.margemPercentual.toFixed(1)}%</span>
          </>
        )}
        .
      </p>

      {foraDoProgramado && (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
          O item está em <span className="num font-medium">{formatCurrency(cobrado)}</span>, fora do
          preço programado desta faixa. Clique no degrau para voltar ao{' '}
          <span className="num font-medium">{formatCurrency(degrauAtual.precoPote)}</span>.
        </p>
      )}
    </div>
  );
}
