import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import {
  compararComProximoDegrau,
  indiceDaFaixa,
  precoDaFaixa,
} from '@/lib/escadaVolume';

/**
 * O que o produtor deixa na mesa por não subir de faixa.
 *
 * Aparece ONDE A QUANTIDADE É DIGITADA, e não na tela de preço: a escada na
 * tela de preço é consulta, e quem decide o volume é o vendedor no meio do
 * orçamento. É ali que a conta precisa estar.
 *
 * Abaixo de 300 potes o aviso é vermelho e nomeado -- 300 é onde começa o
 * preço de catálogo, e abaixo disso o produtor paga a tabela de entrada, 15%
 * acima. Nos degraus seguintes o mesmo gancho aparece em tom neutro: ainda é
 * oportunidade, não prejuízo.
 *
 * A conta vem em três ângulos porque é assim que o produtor pergunta:
 * "quanto eu economizo?", "quanto eu gasto a mais?" e "quanto estou pagando a
 * mais agora?".
 */

interface Props {
  /** Potes deste SKU. A faixa é por SKU, não pelo pedido inteiro. */
  quantidade: number;
  /** Preço de catálogo do produto -- a faixa de 300 a 499. */
  precoCatalogo: number;
  /** `tipo_produto`: Encapsulados, Líquido, Solúvel ou Gummy. */
  tipoProduto: string | null | undefined;
  /** O que está sendo cobrado no item agora. */
  precoCobrado?: number | null;
  /** Aplica o preço da faixa no item. Sem isto, o aviso só informa. */
  onAplicarPreco?: (preco: number) => void;
  className?: string;
}

export default function EscadaVolumeAviso({
  quantidade,
  precoCatalogo,
  tipoProduto,
  precoCobrado,
  onAplicarPreco,
  className,
}: Props) {
  const c = compararComProximoDegrau(quantidade, precoCatalogo, tipoProduto);
  if (!c) return null;

  // O preco que a faixa manda cobrar nesta quantidade. Abaixo de 300 ele e'
  // MAIOR que o do catalogo -- a tabela de entrada e' 15% acima --, entao
  // cobrar o preco de catalogo num pedido pequeno tira margem da fabrica.
  const precoDaVez = precoDaFaixa(precoCatalogo, tipoProduto, indiceDaFaixa(quantidade));
  const cobrado = Number(precoCobrado);
  const precisaAjustar =
    Number.isFinite(cobrado) && cobrado > 0 && Math.abs(cobrado - precoDaVez) >= 0.005;

  const alerta = c.abaixoDoCatalogo;
  const num = (v: number) => v.toLocaleString('pt-BR');

  return (
    <div
      className={cn(
        'rounded border px-2.5 py-2 text-xs leading-relaxed',
        alerta
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-amber-500/30 bg-amber-500/10',
        className,
      )}
    >
      <p
        className={cn(
          'flex items-center gap-1.5 font-semibold',
          alerta ? 'text-destructive' : 'text-amber-700 dark:text-amber-400',
        )}
      >
        {alerta ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
        )}
        {alerta
          ? 'O produtor está perdendo dinheiro'
          : `Falta pouco para o próximo degrau (${num(c.potesProximo)} potes)`}
      </p>

      <p className="mt-1 text-foreground/90">
        Com <span className="num font-medium">{num(c.potesAtuais)}</span> potes o pote sai por{' '}
        <span className="num font-medium">{formatCurrency(c.precoAtual)}</span> — total{' '}
        <span className="num font-medium">{formatCurrency(c.totalAtual)}</span>. A partir de{' '}
        <span className="num font-medium">{num(c.potesProximo)}</span> potes ele cai para{' '}
        <span className="num font-medium">{formatCurrency(c.precoProximo)}</span> (
        <span className="num">−{c.quedaPercentual.toFixed(1)}%</span>).
      </p>

      <ul className="mt-1.5 space-y-0.5 text-foreground/80">
        <li>
          • Os mesmos <span className="num">{num(c.potesProximo)}</span> potes custariam{' '}
          <span className="num">{formatCurrency(c.totalProximoAoPrecoAtual)}</span> nesta faixa e
          saem por <span className="num">{formatCurrency(c.totalProximo)}</span> —{' '}
          <span className={cn('num font-semibold', alerta ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')}>
            {formatCurrency(c.economiaNoProximoVolume)} de economia
          </span>
          .
        </li>
        <li>
          • Leva <span className="num">{num(c.potesExtras)}</span> potes a mais pagando só{' '}
          <span className="num">{formatCurrency(c.desembolsoExtra)}</span> a mais.
        </li>
        <li>
          • Nos <span className="num">{num(c.potesAtuais)}</span> potes de agora, paga{' '}
          <span className="num font-medium">{formatCurrency(c.perdaNoVolumeAtual)}</span> a mais do
          que pagaria na faixa de <span className="num">{num(c.potesProximo)}</span>.
        </li>
      </ul>

      {precisaAjustar && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-1.5">
          <span className="text-foreground/80">
            A faixa de <span className="num">{num(c.potesAtuais)}</span> potes cobra{' '}
            <span className="num font-medium">{formatCurrency(precoDaVez)}</span> por pote; o item
            está em <span className="num font-medium">{formatCurrency(cobrado)}</span>.
          </span>
          {onAplicarPreco && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-[11px]"
              onClick={() => onAplicarPreco(precoDaVez)}
            >
              Aplicar {formatCurrency(precoDaVez)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
