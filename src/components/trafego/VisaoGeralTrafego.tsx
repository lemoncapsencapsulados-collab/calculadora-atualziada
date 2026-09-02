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
      {neutro ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
    </span>
  );
}

function Cartao({
  label,
  valor,
  delta,
  menorMelhor,
  formula,
  destaque,
}: {
  label: string;
  valor: string;
  delta?: { atual: number; anterior: number };
  menorMelhor?: boolean;
  formula: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 ${
        destaque ? 'border-primary/40' : 'border-border'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-mono text-xl">{valor}</div>
      <div className="mt-1 flex items-center gap-2">
        {delta && <Delta {...delta} menorMelhor={menorMelhor} />}
      </div>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground/70">{formula}</p>
    </div>
  );
}

const int = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number | null) => (n != null ? `${n.toFixed(2)}%` : '—');
const brl = (n: number | null) => (n != null ? formatBRL(n) : '—');

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
  const d = (a: number, b: number | null | undefined) =>
    ant ? { atual: a, anterior: b ?? 0 } : undefined;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Visão geral</h2>

      {/* Dinheiro e volume */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          label="Investimento"
          valor={formatBRL(atual.investimento)}
          delta={d(atual.investimento, ant?.investimento)}
          formula="Soma de spend por anúncio/dia"
          destaque
        />
        <Cartao
          label="Contatos gerados"
          valor={int(atual.leads)}
          delta={d(atual.leads, ant?.leads)}
          formula="Leads de formulário + conversas iniciadas"
          destaque
        />
        <Cartao
          label="Custo por contato"
          valor={brl(atual.cpl)}
          delta={d(atual.cpl ?? 0, ant?.cpl)}
          menorMelhor
          formula="Investimento ÷ contatos"
          destaque
        />
        <Cartao
          label="Anúncios / campanhas"
          valor={`${int(atual.anuncios)} / ${int(atual.campanhas)}`}
          formula="Distintos com entrega no período"
        />
      </div>

      {/* Os dois funis, separados. Somá-los num número só apaga as duas
          leituras: o custo e a qualidade de cada um são diferentes. */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Os dois funis, separados
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cartao
            label="Conversas no WhatsApp"
            valor={int(atual.conversas)}
            delta={d(atual.conversas, ant?.conversas)}
            formula="Click-to-WhatsApp: conversa iniciada pelo anúncio"
          />
          <Cartao
            label="Custo por conversa"
            valor={brl(atual.custo_por_conversa)}
            delta={d(atual.custo_por_conversa ?? 0, ant?.custo_por_conversa)}
            menorMelhor
            formula="Investimento ÷ conversas"
          />
          <Cartao
            label="Leads de formulário"
            valor={int(atual.leads_formulario)}
            delta={d(atual.leads_formulario, ant?.leads_formulario)}
            formula="Pixel na landing (evento lead)"
          />
          <Cartao
            label="Visitas na landing"
            valor={int(atual.visitas_landing)}
            delta={d(atual.visitas_landing, ant?.visitas_landing)}
            formula="landing_page_view, do Pixel"
          />
        </div>
      </div>

      {/* Entrega e engajamento */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Entrega
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cartao
            label="Impressões"
            valor={int(atual.impressoes)}
            delta={d(atual.impressoes, ant?.impressoes)}
            formula="Soma por anúncio/dia"
          />
          <Cartao
            label="Cliques no link"
            valor={int(atual.cliques_link)}
            delta={d(atual.cliques_link, ant?.cliques_link)}
            formula="link_click — só o clique que leva ao destino"
          />
          <Cartao
            label="CTR do link"
            valor={pct(atual.ctr_link)}
            delta={d(atual.ctr_link ?? 0, ant?.ctr_link)}
            formula="Cliques no link ÷ impressões"
          />
          <Cartao
            label="CTR total"
            valor={pct(atual.ctr)}
            delta={d(atual.ctr ?? 0, ant?.ctr)}
            formula="Todos os cliques ÷ impressões"
          />
          <Cartao
            label="CPM"
            valor={brl(atual.cpm)}
            delta={d(atual.cpm ?? 0, ant?.cpm)}
            menorMelhor
            formula="Custo por mil impressões"
          />
          <Cartao
            label="CPC"
            valor={brl(atual.cpc)}
            delta={d(atual.cpc ?? 0, ant?.cpc)}
            menorMelhor
            formula="Investimento ÷ cliques"
          />
          <Cartao
            label="Chegada na landing"
            valor={pct(atual.taxa_chegada_landing)}
            delta={d(atual.taxa_chegada_landing ?? 0, ant?.taxa_chegada_landing)}
            formula="Visitas ÷ cliques no link. Queda aqui é velocidade ou destino, não criativo"
          />
          <Cartao
            label="Views de vídeo"
            valor={int(atual.video_views)}
            delta={d(atual.video_views, ant?.video_views)}
            formula="video_view"
          />
        </div>
      </div>

      {/* O que ainda não pode ser medido */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoBloqueado
          label="CAC"
          motivo="Requer ligar venda ao anúncio que a originou. Sem atribuição, só daria coincidência temporal."
        />
        <CartaoBloqueado
          label="ROAS"
          motivo="Mesma dependência do CAC: sem receita atribuída à campanha, não há retorno a dividir pelo gasto."
        />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        <span className="font-medium">Alcance e frequência do período não são exibidos:</span>{' '}
        alcance não é somável — a mesma pessoa atingida em dois dias conta uma vez no alcance
        real e duas ao somar linhas diárias. A frequência média diária aparece por anúncio na
        tabela abaixo.
      </p>
    </section>
  );
}
