import { AlertTriangle, ExternalLink, Phone } from 'lucide-react';
import { useFilaAtendimento } from '@/hooks/useEtiquetas';

/**
 * Quem escreveu e nunca foi respondido.
 *
 * Este painel existe porque a contagem sozinha não resolve nada: saber que "166
 * leads ficaram sem atendimento" não diz a quem retornar. Aqui vem a lista, com
 * nome, há quanto tempo espera e um caminho para abrir a conversa.
 *
 * SOBRE O TELEFONE: aparece só para parte dos contatos, e isso não é descuido.
 * O WhatsApp migrou para identificadores `@lid`, que por design não carregam o
 * número; ele só chega em `key.remoteJidAlt`, presente apenas em mensagens
 * recentes. A cobertura cresce sozinha conforme os contatos trocam mensagem.
 * Enquanto isso, o nome e o link para a conversa é que resolvem na prática.
 */

function espera(horas: number): string {
  if (horas < 24) return `${Math.round(horas)}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `${dias}d`;
  return `${Math.floor(dias / 30)} meses`;
}

/** Vermelho a partir de um dia: abaixo disso ainda é atendimento em curso. */
function corDaEspera(horas: number): string {
  if (horas >= 24 * 7) return 'text-destructive font-medium';
  if (horas >= 24) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

export function FilaAtendimento({ instancia }: { instancia?: string }) {
  const { data: fila = [], isLoading } = useFilaAtendimento(instancia);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando fila…</p>;

  if (fila.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Nenhum contato sem resposta. Todo mundo que escreveu foi atendido.
      </p>
    );
  }

  const comTelefone = fila.filter((f) => f.telefone).length;
  const criticos = fila.filter((f) => Number(f.horas_esperando) >= 24 * 7).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>
          <span className="num text-lg font-semibold">{fila.length}</span>{' '}
          <span className="text-muted-foreground">esperando resposta</span>
        </span>
        {criticos > 0 && (
          <span className="text-destructive">
            <span className="num font-semibold">{criticos}</span> há mais de uma semana
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {comTelefone} com telefone conhecido
        </span>
      </div>

      {comTelefone < fila.length && (
        <p className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            O telefone aparece para {comTelefone} de {fila.length}. O WhatsApp passou a usar
            identificadores que não carregam o número; ele só chega em mensagens recentes, e a
            cobertura cresce conforme cada contato volta a escrever. Para retomar agora, use o
            nome e abra a conversa.
          </span>
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Contato</th>
              <th className="px-3 py-2 text-left font-medium">Telefone</th>
              <th className="px-3 py-2 text-left font-medium">Etiquetas</th>
              <th className="px-3 py-2 text-right font-medium">Mensagens</th>
              <th className="px-3 py-2 text-right font-medium">Esperando há</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {fila.map((f) => (
              <tr key={`${f.instance_name}-${f.remote_jid}`} className="border-b border-border/40 last:border-0">
                <td className="max-w-[16rem] truncate px-3 py-2 font-medium">
                  {f.nome ?? '(sem nome)'}
                  <div className="text-[11px] font-normal text-muted-foreground">
                    {f.instance_name}
                  </div>
                </td>
                <td className="num px-3 py-2 text-xs">
                  {f.telefone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {f.telefone}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {f.etiquetas.map((e) => (
                      <span
                        key={e}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="num px-3 py-2 text-right text-muted-foreground">
                  {f.total_mensagens}
                </td>
                <td className={`num px-3 py-2 text-right ${corDaEspera(Number(f.horas_esperando))}`}>
                  {espera(Number(f.horas_esperando))}
                </td>
                <td className="px-3 py-2 text-right">
                  {f.telefone && (
                    <a
                      href={`https://wa.me/${f.telefone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Abrir
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
