import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis } from 'recharts';
import { formatBRL } from '@/lib/anuncios';
import type { LinhaConsultorAnuncio, PontoTimeline } from '@/hooks/useAnunciosDados';
import type { EtapaFunil } from './FunilVisual';

interface Props {
  consultores: LinhaConsultorAnuncio[];
  etapa: EtapaFunil;
  timeline: PontoTimeline[];
}

type Ordem = 'vendas' | 'conversao' | 'cpl' | 'investimento';

export default function ConsultoresPainel({ consultores, etapa, timeline }: Props) {
  const [ordem, setOrdem] = useState<Ordem>('vendas');
  const [expandido, setExpandido] = useState<string | null>(null);

  const lista = useMemo(() => {
    const arr = [...consultores];
    if (etapa === 'leads') arr.sort((a, b) => b.leads - a.leads);
    else if (etapa === 'orcamentos') arr.sort((a, b) => b.orcamentos - a.orcamentos);
    else if (etapa === 'vendas') arr.sort((a, b) => b.vendas - a.vendas);
    else if (ordem === 'vendas') arr.sort((a, b) => b.vendas - a.vendas);
    else if (ordem === 'conversao') arr.sort((a, b) => b.taxaLV - a.taxaLV);
    else if (ordem === 'cpl') arr.sort((a, b) => (a.cpl || Infinity) - (b.cpl || Infinity));
    else arr.sort((a, b) => b.invest - a.invest);
    return arr;
  }, [consultores, ordem, etapa]);

  const maxLeads = Math.max(...consultores.map((c) => c.leads), 1);
  const maxOrc = Math.max(...consultores.map((c) => c.orcamentos), 1);
  const maxVen = Math.max(...consultores.map((c) => c.vendas), 1);
  const mediaLV = consultores.length
    ? consultores.reduce((s, c) => s + c.taxaLV, 0) / consultores.length
    : 0;

  if (consultores.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum consultor com dados no período.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {etapa ? `Ordenado pela etapa selecionada no funil (${etapa}).` : 'Ordenação livre.'}
        </p>
        <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vendas">Ordenar por vendas</SelectItem>
            <SelectItem value="conversao">Ordenar por conversão</SelectItem>
            <SelectItem value="cpl">Ordenar por CPL</SelectItem>
            <SelectItem value="investimento">Ordenar por investimento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        {lista.map((c, i) => {
          const performance =
            c.taxaLV >= mediaLV * 1.15 ? 'alta' : c.taxaLV >= mediaLV * 0.85 ? 'media' : 'baixa';
          const badgeClass =
            performance === 'alta'
              ? 'bg-success/15 text-success border-success/30'
              : performance === 'media'
              ? 'bg-secondary/15 text-secondary border-secondary/30'
              : 'bg-destructive/15 text-destructive border-destructive/30';
          const aberto = expandido === c.nome;
          return (
            <div key={c.nome} className="surface p-4 anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left"
                onClick={() => setExpandido(aberto ? null : c.nome)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.nome}</span>
                  <Badge variant="outline" className={badgeClass}>
                    {performance === 'alta' ? 'Acima da média' : performance === 'media' ? 'Na média' : 'Abaixo da meta'}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  Invest.: {formatBRL(c.invest)}
                  <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                </span>
              </button>

              <div className="mt-3 space-y-2">
                <Barra label="Leads" valor={c.leads} max={maxLeads} cor="hsl(var(--primary))" />
                <Barra label="Orçamentos" valor={c.orcamentos} max={maxOrc} cor="hsl(var(--secondary))" sufixo={`${c.taxaLO.toFixed(1)}%`} />
                <Barra label="Vendas" valor={c.vendas} max={maxVen} cor="hsl(var(--success))" sufixo={`${c.taxaOV.toFixed(1)}%`} />
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Metrica label="Lead→Orç" valor={`${c.taxaLO.toFixed(1)}%`} />
                <Metrica label="Orç→Venda" valor={`${c.taxaOV.toFixed(1)}%`} />
                <Metrica label="Lead→Venda" valor={`${c.taxaLV.toFixed(1)}%`} />
                <Metrica label="CPL" valor={formatBRL(c.cpl)} />
                <Metrica label="Custo/Venda" valor={formatBRL(c.custoVenda)} />
              </div>

              {aberto && (
                <div className="mt-3 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline}>
                      <XAxis dataKey="label" hide />
                      <RTooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          backdropFilter: 'blur(8px)',
                        }}
                      />
                      <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Leads (geral)" />
                      <Line type="monotone" dataKey="vendas" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Vendas (geral)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Barra({ label, valor, max, cor, sufixo }: { label: string; valor: number; max: number; cor: string; sufixo?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{valor}</span>
          {sufixo ? <span className="text-muted-foreground"> · {sufixo} conv.</span> : null}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max((valor / max) * 100, 2)}%`, background: cor }} />
      </div>
    </div>
  );
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{valor}</div>
    </div>
  );
}
