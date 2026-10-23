import { useState } from 'react';
import { History } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ROTULO_ORIGEM,
  type RegistroEdicao,
  dataHoraDaEdicao,
  ultimaEdicao,
} from '@/lib/historicoEdicao';
import { cn } from '@/lib/utils';

/**
 * "Editado em 23/10/2026 às 14:07" -- e, ao clicar, o que mudou.
 *
 * Orçamentos e pedidos passaram a se atualizar sozinhos quando o produto ou o
 * Orçamento para Contrato mudam. Isso resolve o valor desatualizado e cria uma
 * pergunta nova: "por que está diferente do que mandei ao cliente?". Ela
 * aparece com o cliente na linha, e o consultor precisa da resposta ali.
 *
 * A data é um botão porque a data sozinha não responde nada -- diz que mudou,
 * não o que mudou.
 */
export default function UltimaEdicao({
  historico,
  className,
}: {
  historico: unknown;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ultima = ultimaEdicao(historico);
  if (!ultima) return null;

  const lista = (Array.isArray(historico) ? historico : [])
    .filter((r): r is RegistroEdicao => !!r && typeof (r as RegistroEdicao).em === 'string')
    .sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
          className,
        )}
        title="Ver o que foi editado"
      >
        <History className="h-3 w-3" />
        Editado em {dataHoraDaEdicao(ultima.em)}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Histórico de edições</DialogTitle>
            <DialogDescription>
              Da mais recente para a mais antiga. Mudanças automáticas aparecem com a origem.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {lista.map((r, i) => (
              <div key={`${r.em}-${i}`} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{dataHoraDaEdicao(r.em)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {ROTULO_ORIGEM[r.origem] ?? r.origem}
                  </span>
                </div>
                {r.mudancas?.length ? (
                  <ul className="mt-2 space-y-1">
                    {r.mudancas.map((m, j) => (
                      <li key={j} className="text-xs leading-relaxed text-muted-foreground">
                        • {m}
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* Registro sem detalhe é registro antigo, de antes de o
                     resumo existir. Dizer isso é melhor que mostrar vazio. */
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    Sem detalhamento registrado nesta edição.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
