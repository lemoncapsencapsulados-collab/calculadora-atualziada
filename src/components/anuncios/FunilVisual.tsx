import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { KpisAnuncios } from '@/hooks/useAnunciosDados';

export type EtapaFunil = 'leads' | 'orcamentos' | 'vendas' | null;

interface Props {
  kpis: KpisAnuncios;
  etapaSelecionada: EtapaFunil;
  onSelecionarEtapa: (etapa: EtapaFunil) => void;
}

export default function FunilVisual({ kpis, etapaSelecionada, onSelecionarEtapa }: Props) {
  const base = Math.max(kpis.leads, 1);
  const etapas = [
    {
      id: 'leads' as const,
      titulo: 'Leads recebidos',
      valor: kpis.leads,
      pct: kpis.leads > 0 ? 100 : 0,
      perda: null as number | null,
      gradiente: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))',
    },
    {
      id: 'orcamentos' as const,
      titulo: 'Orçamentos gerados',
      valor: kpis.orcamentos,
      pct: (kpis.orcamentos / base) * 100,
      perda: kpis.leads > 0 ? 100 - kpis.taxaLO : null,
      gradiente: 'linear-gradient(90deg, hsl(var(--primary) / 0.8), hsl(var(--secondary)))',
    },
    {
      id: 'vendas' as const,
      titulo: 'Vendas fechadas',
      valor: kpis.vendas,
      pct: (kpis.vendas / base) * 100,
      perda: kpis.orcamentos > 0 ? 100 - kpis.taxaOV : null,
      gradiente: 'linear-gradient(90deg, hsl(var(--secondary)), hsl(var(--destructive)))',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        {etapas.map((e, i) => {
          const ativo = etapaSelecionada === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelecionarEtapa(ativo ? null : e.id)}
              className={`w-full text-left anim-rise ${ativo ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-muted-foreground">{e.titulo}</span>
                <span className="text-2xl font-semibold tabular-nums">{e.valor.toLocaleString('pt-BR')}</span>
              </div>
              <div className="h-8 rounded-lg bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${Math.max(e.pct, 2)}%`, background: e.gradiente }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-muted-foreground">{e.pct.toFixed(1)}% do topo</span>
                {e.perda !== null && <span className="text-destructive">perda: {e.perda.toFixed(1)}%</span>}
              </div>
            </button>
          );
        })}
        <p className="text-xs text-muted-foreground">Clique em uma etapa para ordenar os consultores por ela.</p>
      </div>

      <div className="surface p-4 space-y-4 h-fit">
        <h4 className="text-sm font-medium">Eficiência do funil</h4>
        <TaxaLinha label="Lead → Orçamento" valor={kpis.taxaLO} formula="Orçamentos ÷ Leads × 100" />
        <TaxaLinha label="Orçamento → Venda" valor={kpis.taxaOV} formula="Vendas ÷ Orçamentos × 100" />
        <TaxaLinha label="Lead → Venda" valor={kpis.taxaLV} formula="Vendas ÷ Leads × 100" />
      </div>
    </div>
  );
}

function TaxaLinha({ label, valor, formula }: { label: string; valor: number; formula: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums">{valor.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(valor, 100)}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))' }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="backdrop-blur">{formula}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
