import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBRL } from '@/lib/anuncios';
import type { LinhaModeloAquisicao } from '@/hooks/useAnunciosDados';

interface GeralInfo {
  invest: number;
  leads: number;
  orcamentos: number;
  vendas: number;
  valorVendido: number;
  cpl: number;
  custoVenda: number;
  taxaOV: number;
  campanhas: string[];
}

interface Props {
  modelos: LinhaModeloAquisicao[];
  geral: GeralInfo;
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

export default function FunilAquisicao({ modelos, geral }: Props) {
  const maxOrc = Math.max(1, ...modelos.map((m) => m.orcamentos));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Funil geral — campanhas sem vendedor no nome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Metrica label="Investimento" valor={formatBRL(geral.invest)} />
            <Metrica label="Leads" valor={String(geral.leads)} />
            <Metrica label="Orçamentos" valor={String(geral.orcamentos)} />
            <Metrica label="Clientes adquiridos" valor={String(geral.vendas)} />
            <Metrica label="CPL" valor={formatBRL(geral.cpl)} />
            <Metrica label="Custo por venda" valor={formatBRL(geral.custoVenda)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Orçamentos e vendas considerados: modelos de aquisição vindos de anúncio (Tráfego no WhatsApp, Funil de
            formulário e Página de vendas). Conversão orçamento → venda: {geral.taxaOV.toFixed(1)}% · Valor vendido:{' '}
            {formatBRL(geral.valorVendido)}
          </p>
          {geral.campanhas.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Campanhas gerais no período: {geral.campanhas.slice(0, 8).join(' · ')}
              {geral.campanhas.length > 8 ? ` · +${geral.campanhas.length - 8}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Funil por modelo de aquisição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {modelos.map((m) => (
            <div key={m.modelo} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {m.orcamentos} orçamentos · {m.vendas} clientes · {m.taxaConversao.toFixed(1)}% ·{' '}
                  {formatBRL(m.valorVendido)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.min(100, (m.orcamentos / maxOrc) * 100)}%` }}
                />
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[hsl(var(--success))]"
                  style={{ width: `${Math.min(100, (m.vendas / maxOrc) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
