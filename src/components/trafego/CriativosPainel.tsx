import { Badge } from '@/components/ui/badge';
import { formatBRL } from '@/lib/anuncios';
import type { LinhaCriativo } from '@/hooks/useFunilTrafego';

/**
 * A copy que estava no ar, ao lado do número que ela produziu.
 *
 * O par (texto, desempenho) só faz sentido porque a consulta casa o período com
 * a vigência da versão. Sem isso, o resultado de um período que atravessa uma
 * troca de criativo apareceria colado no texto atual, creditando ao texto novo
 * um número que foi do antigo.
 */

function dataBR(iso: string): string {
  return iso.split('-').reverse().join('/');
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="font-mono text-sm">{valor}</div>
    </div>
  );
}

export function CriativosPainel({ criativos }: { criativos: LinhaCriativo[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Criativos e copy</h2>
        <span className="text-xs text-muted-foreground">
          {criativos.length} versão(ões) com entrega no período
        </span>
      </div>

      {criativos.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhum criativo com entrega neste período. Se a coleta de criativos ainda não
          rodou, os textos aparecem na próxima drenagem da fila.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {criativos.map((c) => (
          <article
            key={`${c.ad_id}-${c.vigente_desde}`}
            className="flex gap-4 rounded-xl border border-border bg-card p-4"
          >
            {c.image_url && (
              <img
                src={c.image_url}
                alt=""
                loading="lazy"
                className="h-24 w-24 shrink-0 rounded-lg object-cover"
              />
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{c.ad_name ?? c.ad_id}</span>
                {c.no_ar ? (
                  <Badge variant="secondary" className="text-[10px]">no ar</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    até {dataBR(c.vigente_ate!)}
                  </Badge>
                )}
              </div>

              {c.titulo && <p className="text-sm font-medium leading-snug">{c.titulo}</p>}
              {c.corpo && (
                <p className="line-clamp-4 whitespace-pre-line text-sm leading-snug text-muted-foreground">
                  {c.corpo}
                </p>
              )}

              <div className="grid grid-cols-4 gap-2 border-t border-border/60 pt-2">
                <Metrica rotulo="Investido" valor={formatBRL(c.investimento)} />
                <Metrica rotulo="Leads" valor={c.leads.toLocaleString('pt-BR')} />
                <Metrica rotulo="CPL" valor={c.cpl != null ? formatBRL(c.cpl) : '—'} />
                <Metrica rotulo="CTR" valor={c.ctr != null ? `${c.ctr.toFixed(2)}%` : '—'} />
              </div>

              {/* Sem esta linha, comparar dois criativos ignora que um rodou 30
                  dias e o outro 3 — e a comparação de CPL vira ruído. */}
              <p className="text-[11px] text-muted-foreground/70">
                Versão no ar desde {dataBR(c.vigente_desde)} · {c.dias_no_periodo} dia(s) com
                entrega no período exibido
                {c.campaign_name ? ` · ${c.campaign_name}` : ''}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
