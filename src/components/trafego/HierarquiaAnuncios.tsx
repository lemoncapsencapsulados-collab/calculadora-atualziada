import { useState } from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatBRL } from '@/lib/anuncios';
import { useHierarquiaTrafego, type FiltrosTrafego, type NivelHierarquia } from '@/hooks/useFunilTrafego';

/**
 * Campanha -> conjunto -> anúncio, descendo por clique.
 *
 * Cada descida é uma consulta nova em vez de uma árvore carregada de uma vez:
 * a maior parte das campanhas nunca é aberta, e trazer todos os anúncios de
 * todas elas para talvez mostrar dois seria pagar o custo à toa.
 */

const PROXIMO: Record<NivelHierarquia, NivelHierarquia | null> = {
  campanha: 'conjunto',
  conjunto: 'anuncio',
  anuncio: null,
};

const ROTULO: Record<NivelHierarquia, string> = {
  campanha: 'Campanha',
  conjunto: 'Conjunto',
  anuncio: 'Anúncio',
};

interface Trilha {
  nivel: NivelHierarquia;
  id: string | null;
  nome: string;
}

export function HierarquiaAnuncios({ filtros }: { filtros: FiltrosTrafego }) {
  const [trilha, setTrilha] = useState<Trilha[]>([
    { nivel: 'campanha', id: null, nome: 'Todas as campanhas' },
  ]);
  const atual = trilha[trilha.length - 1];
  const { data, isLoading } = useHierarquiaTrafego(filtros, atual.nivel, atual.id);
  const linhas = data ?? [];

  const descer = (id: string, nome: string) => {
    const proximo = PROXIMO[atual.nivel];
    if (proximo) setTrilha((t) => [...t, { nivel: proximo, id, nome }]);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Campanha → conjunto → anúncio</h2>

        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {trilha.map((t, i) => (
            <span key={`${t.nivel}-${t.id ?? 'raiz'}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              <button
                type="button"
                onClick={() => setTrilha((tr) => tr.slice(0, i + 1))}
                className={
                  i === trilha.length - 1
                    ? 'font-medium text-foreground'
                    : 'hover:text-foreground hover:underline'
                }
              >
                {t.nome}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{ROTULO[atual.nivel]}</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Contatos</TableHead>
              <TableHead className="text-right">Custo/contato</TableHead>
              <TableHead className="text-right">Conversas</TableHead>
              <TableHead className="text-right">Custo/conversa</TableHead>
              <TableHead className="text-right">Form.</TableHead>
              <TableHead className="text-right">Cliques link</TableHead>
              <TableHead className="text-right">CTR link</TableHead>
              <TableHead className="text-right">CPM</TableHead>
              <TableHead className="text-right">Freq. média</TableHead>
              <TableHead className="text-right">
                {/* A coluna fica, desabilitada, em vez de sumir: some e ninguém
                    sabe que essa leitura falta; fica assim e o buraco é visível. */}
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help items-center gap-1 text-muted-foreground/60">
                        <Lock className="h-3 w-3" />
                        Qualidade
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Ranking por qualidade do lead depende de ligar a conversa de WhatsApp
                      à campanha que a gerou. Essa atribuição ainda não existe.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}

            {!isLoading && linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma entrega neste período.
                </TableCell>
              </TableRow>
            )}

            {linhas.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="max-w-[22rem] truncate font-medium">{l.nome}</TableCell>
                <TableCell className="text-right font-mono">{formatBRL(l.investimento)}</TableCell>
                <TableCell className="text-right font-mono">
                  {l.leads.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.cpl != null ? formatBRL(l.cpl) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.conversas.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.custo_por_conversa != null ? formatBRL(l.custo_por_conversa) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.leads_formulario.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.cliques_link.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.ctr_link != null ? `${l.ctr_link.toFixed(2)}%` : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.cpm != null ? formatBRL(l.cpm) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.frequencia_media != null ? l.frequencia_media.toFixed(2) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground/40">—</TableCell>
                <TableCell className="text-right">
                  {PROXIMO[atual.nivel] && (
                    <Button variant="ghost" size="sm" onClick={() => descer(l.id, l.nome)}>
                      Abrir
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground/70">
        Ordenado por investimento. Linhas sem impressão no período não aparecem.
        <span className="ml-1">
          "Freq. média" é a média das frequências diárias, não a frequência do período —
          esta exigiria o alcance real, que não se obtém somando dias.
        </span>
      </p>
    </section>
  );
}
