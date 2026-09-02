import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatBRL } from '@/lib/anuncios';
import { CartaoBloqueado } from './SecaoPendente';
import type { PeriodoTrafego } from '@/hooks/useFunilTrafego';

/** Variação contra o período anterior. `menorMelhor` porque cair o CPL é bom e
 *  cair o investimento não é necessariamente — a cor não pode ser só o sinal. */
function Delta({
  atual,
  anterior,
  menorMelhor,
}: {
  atual: number;
  anterior: number;
  menorMelhor?: boolean;
}) {
  const delta = atual - anterior;
  const pct = anterior !== 0 ? (delta / anterior) * 100 : atual !== 0 ? 100 : 0;
  const neutro = delta === 0 || (anterior === 0 && atual === 0);
  const melhora = menorMelhor ? delta < 0 : delta > 0;
  const Icon = neutro ? Minus : melhora ? ArrowUpRight : ArrowDownRight;
  const cor = neutro ? 'text-muted-foreground' : melhora ? 'text-success' : 'text-destructive';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cor}`}>
      <Icon className="h-3.5 w-3.5" />
      {neutro ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs. anterior`}
    </span>
  );
}

function Cartao({
  label,
  valor,
  anterior,
  menorMelhor,
  formula,
}: {
  label: string;
  valor: string;
  anterior?: { atual: number; anterior: number };
  menorMelhor?: boolean;
  formula: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl">{valor}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {anterior && <Delta {...anterior} menorMelhor={menorMelhor} />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{formula}</p>
    </div>
  );
}

interface Props {
  atual: PeriodoTrafego | null;
  anterior: PeriodoTrafego | null;
}

export function VisaoGeralTrafego({ atual, anterior }: Props) {
  if (!atual) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Sem dado coletado para este período.
      </p>
    );
  }

  const ant = anterior;
  const par = (a: number, b: number | undefined) => (ant ? { atual: a, anterior: b ?? 0 } : undefined);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Visão geral</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Cartao
          label="Investimento"
          valor={formatBRL(atual.investimento)}
          anterior={par(atual.investimento, ant?.investimento)}
          formula="Soma de spend por anúncio/dia"
        />
        <Cartao
          label="Leads"
          valor={atual.leads.toLocaleString('pt-BR')}
          anterior={par(atual.leads, ant?.leads)}
          formula="Como a Meta os conta, no anúncio"
        />
        <Cartao
          label="CPL"
          valor={atual.cpl != null ? formatBRL(atual.cpl) : '—'}
          anterior={par(atual.cpl ?? 0, ant?.cpl ?? 0)}
          menorMelhor
          formula="Investimento ÷ leads"
        />
        <Cartao
          label="CTR"
          valor={atual.ctr != null ? `${atual.ctr.toFixed(2)}%` : '—'}
          anterior={par(atual.ctr ?? 0, ant?.ctr ?? 0)}
          formula="Cliques ÷ impressões"
        />
        <Cartao
          label="Impressões"
          valor={atual.impressoes.toLocaleString('pt-BR')}
          anterior={par(atual.impressoes, ant?.impressoes)}
          formula="Soma por anúncio/dia"
        />
        <Cartao
          label="Cliques"
          valor={atual.cliques.toLocaleString('pt-BR')}
          anterior={par(atual.cliques, ant?.cliques)}
          formula="Soma por anúncio/dia"
        />

        {/* Medir isto exige ligar venda a anúncio, e não existe atribuição
            lead<->campanha neste sistema. A página de anúncios atual mostra um
            CAC que é verba do mês dividida por vendas do mês, sem vínculo entre
            elas — número que parece medição e é coincidência. Aqui fica
            bloqueado até haver o que medir. */}
        <CartaoBloqueado
          label="CAC"
          motivo="Requer ligar venda ao anúncio que a originou. Sem atribuição lead↔campanha, só daria coincidência temporal."
        />
        <CartaoBloqueado
          label="ROAS"
          motivo="Mesma dependência do CAC: sem receita atribuída à campanha, não há retorno que se possa dividir pelo gasto."
        />
      </div>

      {/* Alcance e frequência não aparecem por um motivo diferente, e ele
          precisa estar escrito em algum lugar visível. */}
      <p className="text-xs text-muted-foreground/80">
        Alcance e frequência do período não são exibidos: <span className="font-medium">alcance
        não é somável</span> — a mesma pessoa atingida em dois dias conta uma vez no alcance
        real e duas ao somar linhas diárias.
      </p>
    </section>
  );
}
