import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatBRL } from '@/lib/anuncios';
import type { EventoMeta } from '@/hooks/useFunilTrafego';

/**
 * Tudo que a conta reporta, evento por evento.
 *
 * Existe por duas razões práticas. A primeira: responde "o meu Pixel está
 * funcionando?" com número em vez de suposição — se `landing_page_view` e
 * `lead` aparecem aqui, ele está disparando.
 *
 * A segunda é mais importante. Vários eventos da Meta são AGREGADOS que já
 * contêm outros: `lead` engloba `offsite_conversion.fb_pixel_lead` e
 * `onsite_conversion.lead_grouped`. Somar os três conta o mesmo lead duas
 * vezes — foi exatamente esse o erro que inflava o total em 20% e deixava o
 * CPL ~17% mais barato do que é. Ver a lista crua é o que permite perceber
 * isso antes de construir métrica em cima.
 */

/** Eventos que já contêm outros. Somar com seus componentes conta duas vezes. */
const AGREGADOS = new Set(['lead', 'omni_landing_page_view', 'post_interaction_gross']);

const NOMES: Record<string, string> = {
  lead: 'Leads (total do formulário)',
  'offsite_conversion.fb_pixel_lead': 'Lead pelo Pixel',
  'onsite_conversion.lead_grouped': 'Lead agrupado',
  'onsite_conversion.messaging_conversation_started_7d': 'Conversa iniciada no WhatsApp',
  'onsite_conversion.messaging_first_reply': 'Primeira resposta na conversa',
  'onsite_conversion.total_messaging_connection': 'Conexão por mensagem',
  landing_page_view: 'Visita na landing page',
  link_click: 'Clique no link',
  video_view: 'View de vídeo',
  page_engagement: 'Engajamento com a página',
  post_engagement: 'Engajamento com o post',
  post_reaction: 'Reação no post',
};

export function EventosMeta({ eventos }: { eventos: EventoMeta[] }) {
  const [aberto, setAberto] = useState(false);
  const visiveis = aberto ? eventos : eventos.slice(0, 8);

  if (eventos.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Eventos reportados pela Meta</h2>
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
          O que a conta e o Pixel de fato registram no período. Serve para conferir se o
          rastreamento está funcionando — e para não construir métrica sobre um evento que
          nunca dispara.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Evento</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Anúncios</th>
              <th className="px-4 py-2 text-right font-medium">Custo unitário</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((e) => (
              <tr key={e.evento} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2">
                  <span>{NOMES[e.evento] ?? e.evento}</span>
                  {AGREGADOS.has(e.evento) && (
                    <span
                      className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                      title="Este evento já inclui outros da lista. Somá-lo com eles conta a mesma conversão duas vezes."
                    >
                      agregado
                    </span>
                  )}
                  {NOMES[e.evento] && (
                    <div className="font-mono text-[10px] text-muted-foreground/60">
                      {e.evento}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {Number(e.total).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                  {e.anuncios.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {e.custo_por_evento != null ? formatBRL(e.custo_por_evento) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {eventos.length > 8 && (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {aberto ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Ver todos os {eventos.length} eventos
            </>
          )}
        </button>
      )}
    </section>
  );
}
