import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Palette, FileBadge, Printer, Barcode } from 'lucide-react';
import { CATEGORIAS_ENTREGAVEIS, DemandaEntregavel, EntregavelCategoria } from '@/lib/entregaveis';
import { cn } from '@/lib/utils';

const ICONS: Record<EntregavelCategoria, React.ElementType> = {
  pagina_vendas: Globe,
  design_rotulos: Palette,
  registro_inpi: FileBadge,
  impressao_rotulos: Printer,
  codigo_barras: Barcode,
};

interface Props {
  demandas: DemandaEntregavel[];
  onAbrirAba: (categoria: EntregavelCategoria) => void;
}

const DemandasSetupResumo = ({ demandas, onAbrirAba }: Props) => {
  const stats = useMemo(() => {
    const m = new Map<EntregavelCategoria, { pendentes: number; entregues: number; atrasados: number; total: number }>();
    CATEGORIAS_ENTREGAVEIS.forEach((c) =>
      m.set(c.value, { pendentes: 0, entregues: 0, atrasados: 0, total: 0 }),
    );
    demandas.forEach((d) => {
      const s = m.get(d.categoria)!;
      s.total += d.quantidade;
      if (d.status_entregavel === 'entregue') s.entregues += d.quantidade;
      else if (d.status_entregavel === 'pendente') {
        s.pendentes += d.quantidade;
        if (d.dias_restantes < 0) s.atrasados += d.quantidade;
      }
    });
    return m;
  }, [demandas]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Demandas de Setup</h3>
        <span className="text-xs text-muted-foreground">Clique em um card para abrir a subpágina</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIAS_ENTREGAVEIS.map((c) => {
          const Icon = ICONS[c.value];
          const s = stats.get(c.value)!;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onAbrirAba(c.value)}
              className={cn(
                'text-left rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium truncate">{c.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{s.pendentes}</span>
                <span className="text-xs text-muted-foreground">pendente(s)</span>
              </div>
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {s.atrasados > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {s.atrasados} atrasado(s)
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {s.entregues} entregue(s)
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default DemandasSetupResumo;