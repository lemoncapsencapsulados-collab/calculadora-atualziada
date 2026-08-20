import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatBRL } from '@/lib/anuncios';
import type { KpisAnuncios } from '@/hooks/useAnunciosDados';

function useCounter(target: number, duration = 600) {
  const [valor, setValor] = useState(0);
  const anterior = useRef(0);
  useEffect(() => {
    const inicio = performance.now();
    const de = anterior.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - inicio) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValor(de + (target - de) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else anterior.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return valor;
}

function Delta({ atual, anterior, menorMelhor }: { atual: number; anterior: number; menorMelhor?: boolean }) {
  const delta = atual - anterior;
  const pct = anterior !== 0 ? (delta / anterior) * 100 : atual !== 0 ? 100 : 0;
  const neutro = delta === 0 || (anterior === 0 && atual === 0);
  const melhora = menorMelhor ? delta < 0 : delta > 0;
  const Icon = neutro ? Minus : melhora ? ArrowUpRight : ArrowDownRight;
  const cor = neutro ? 'text-muted-foreground' : melhora ? 'text-success' : 'text-destructive';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cor}`}>
      <Icon className="w-3.5 h-3.5" />
      {neutro ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs. anterior`}
    </span>
  );
}

interface CardProps {
  label: string;
  valor: number;
  formato: 'brl' | 'int';
  anterior: number;
  formula: string;
  menorMelhor?: boolean;
  index: number;
}

function KpiCard({ label, valor, formato, anterior, formula, menorMelhor, index }: CardProps) {
  const animado = useCounter(valor);
  const texto = formato === 'brl' ? formatBRL(animado) : Math.round(animado).toLocaleString('pt-BR');
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="surface anim-rise p-5" style={{ animationDelay: `${index * 40}ms` }}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{texto}</p>
            <div className="mt-2">
              <Delta atual={valor} anterior={anterior} menorMelhor={menorMelhor} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="backdrop-blur">{formula}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function AnunciosKpis({ kpis, anterior }: { kpis: KpisAnuncios; anterior: KpisAnuncios }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard index={0} label="Total investido" valor={kpis.invest} formato="brl" anterior={anterior.invest} formula="Soma do investimento das campanhas no período" />
      <KpiCard index={1} label="Leads gerados" valor={kpis.leads} formato="int" anterior={anterior.leads} formula="Soma dos leads atribuídos aos consultores" />
      <KpiCard index={2} label="CPL médio" valor={kpis.cpl} formato="brl" anterior={anterior.cpl} formula="CPL = Investimento ÷ Leads" menorMelhor />
      <KpiCard index={3} label="CAC (custo por venda)" valor={kpis.cac} formato="brl" anterior={anterior.cac} formula="CAC = Investimento ÷ Vendas" menorMelhor />
    </div>
  );
}
