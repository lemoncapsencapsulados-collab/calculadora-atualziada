import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Lote, MateriaPrima, Embalagem } from '@/types/formula';
import { differenceInDays, format, parseISO } from 'date-fns';

interface InventarioDashboardProps {
  lotes: Lote[];
  materiasPrimas: MateriaPrima[];
  embalagens: Embalagem[];
}

interface StockItem {
  nome: string;
  tipo: string;
  totalQtd: number;
}

interface ExpiryItem {
  nome: string;
  codigo?: string;
  validade: string;
  quantidade: number;
  diasRestantes: number;
}

export default function InventarioDashboard({ lotes, materiasPrimas, embalagens }: InventarioDashboardProps) {
  const nameMap = useMemo(() => {
    const map = new Map<string, { nome: string; tipo: string }>();
    materiasPrimas.forEach(mp => map.set(mp.id, { nome: mp.nome, tipo: 'MP' }));
    embalagens.forEach(emb => map.set(emb.id, { nome: emb.nome, tipo: 'Emb' }));
    return map;
  }, [materiasPrimas, embalagens]);

  const stockAggregated = useMemo(() => {
    const agg = new Map<string, number>();
    lotes.forEach(l => {
      agg.set(l.item_id, (agg.get(l.item_id) || 0) + l.quantidade);
    });
    const items: StockItem[] = [];
    agg.forEach((totalQtd, itemId) => {
      const info = nameMap.get(itemId);
      if (info) items.push({ nome: info.nome, tipo: info.tipo, totalQtd });
    });
    return items;
  }, [lotes, nameMap]);

  const top10Maior = useMemo(() =>
    [...stockAggregated].sort((a, b) => b.totalQtd - a.totalQtd).slice(0, 10),
    [stockAggregated]
  );

  const top10Menor = useMemo(() =>
    [...stockAggregated].filter(i => i.totalQtd > 0).sort((a, b) => a.totalQtd - b.totalQtd).slice(0, 10),
    [stockAggregated]
  );

  const proximosVencimento = useMemo(() => {
    const now = new Date();
    const items: ExpiryItem[] = [];
    lotes.forEach(l => {
      if (l.item_tipo !== 'materia_prima' || !l.validade || l.quantidade <= 0) return;
      const dias = differenceInDays(parseISO(l.validade), now);
      if (dias <= 180) {
        const info = nameMap.get(l.item_id);
        items.push({
          nome: info?.nome || 'Desconhecido',
          codigo: l.codigo,
          validade: l.validade,
          quantidade: l.quantidade,
          diasRestantes: dias,
        });
      }
    });
    return items.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [lotes, nameMap]);

  function getExpiryColor(dias: number) {
    if (dias < 0) return 'bg-destructive text-destructive-foreground';
    if (dias <= 30) return 'bg-destructive/80 text-destructive-foreground';
    if (dias <= 90) return 'bg-yellow-500 text-white';
    return 'bg-orange-400 text-white';
  }

  function getExpiryLabel(dias: number) {
    if (dias < 0) return 'VENCIDO';
    if (dias === 0) return 'Vence hoje';
    return `${dias}d`;
  }

  if (lotes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Top 10 Maior Estoque */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Top 10 — Maior Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {top10Maior.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados de lotes</p>
          ) : (
            <div className="space-y-1.5">
              {top10Maior.map((item, i) => (
                <div key={`${item.nome}-${i}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="truncate">{item.nome}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{item.tipo}</Badge>
                  </div>
                  <span className="font-medium ml-2 shrink-0">{item.totalQtd.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 10 Menor Estoque */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
            Top 10 — Menor Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {top10Menor.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados de lotes</p>
          ) : (
            <div className="space-y-1.5">
              {top10Menor.map((item, i) => (
                <div key={`${item.nome}-${i}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="truncate">{item.nome}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{item.tipo}</Badge>
                  </div>
                  <span className="font-medium ml-2 shrink-0">{item.totalQtd.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximos do Vencimento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Próximos do Vencimento (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {proximosVencimento.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item próximo do vencimento</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {proximosVencimento.map((item, i) => (
                <div key={`${item.nome}-${item.validade}-${i}`} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="truncate block text-xs">{item.nome}</span>
                    {item.codigo && <span className="text-[10px] text-muted-foreground font-mono">{item.codigo}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{format(parseISO(item.validade), 'dd/MM/yy')}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${getExpiryColor(item.diasRestantes)}`}>
                    {getExpiryLabel(item.diasRestantes)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
