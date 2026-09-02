import { Lock } from 'lucide-react';

/**
 * O que a página ainda não pode medir, dito com o motivo.
 *
 * Existe porque a alternativa é pior nas duas pontas: omitir faz quem procura
 * o número achar que faltou, e mostrar uma aproximação sem marcação repete o
 * defeito da página de anúncios atual, onde o CAC é verba do mês dividida por
 * vendas do mês, sem nenhum vínculo entre elas.
 *
 * Visualmente distinto de qualquer coisa medida, de propósito: tracejado,
 * dessaturado e com cadeado. Bloqueado nunca pode ser confundido com zero.
 */

interface CartaoProps {
  label: string;
  motivo: string;
}

/** Para o lugar de um KPI, dentro da grade de cartões. */
export function CartaoBloqueado({ label, motivo }: CartaoProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Lock className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl text-muted-foreground/50">—</div>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{motivo}</p>
    </div>
  );
}

interface SecaoProps {
  titulo: string;
  motivo: string;
  destrava: string;
}

/** Para o lugar de um bloco inteiro da página. */
export function SecaoPendente({ titulo, motivo, destrava }: SecaoProps) {
  return (
    <section className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-muted-foreground">{titulo}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{motivo}</p>
      <p className="mt-3 text-xs text-muted-foreground/80">
        <span className="font-medium">Destrava com:</span> {destrava}
      </p>
    </section>
  );
}
