import { useState } from 'react';
import { AlertTriangle, ChevronRight, Tag } from 'lucide-react';
import {
  useBasePorEtiqueta,
  useContatosPorEtiqueta,
  corDaEtiqueta,
} from '@/hooks/useEtiquetas';

/**
 * A carteira pelas etiquetas que os consultores marcam à mão.
 *
 * O valor não é a contagem — é o confronto. A etiqueta diz o que o consultor
 * ACHA do contato; a etapa da IA diz o que a conversa MOSTRA. Onde as duas
 * discordam costuma estar o lead se perdendo: 'EM NEGOCIAÇÃO' cheio de
 * 'sem_resposta' é carteira parada que alguém ainda considera viva.
 */

const ETAPA_LEGIVEL: Record<string, string> = {
  sem_resposta: 'sem resposta',
  em_conversa: 'em conversa',
  catalogo_enviado: 'catálogo enviado',
  meeting_agendada: 'reunião agendada',
  proposta: 'proposta',
  fechado: 'fechado',
  perdido: 'perdido',
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="num">{valor}</span>
    </div>
  );
}

export function PainelEtiquetas({ instancia }: { instancia?: string }) {
  const { data: base = [], isLoading } = useBasePorEtiqueta(instancia);
  const [aberta, setAberta] = useState<string | null>(null);
  const { data: contatos = [] } = useContatosPorEtiqueta(aberta, instancia);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando etiquetas…</p>;
  }

  if (base.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Nenhuma etiqueta sincronizada ainda. A carga roda a cada 30 minutos a partir do
        banco da Evolution.
      </p>
    );
  }

  const semConversaTotal = base.reduce((s, b) => s + Number(b.sem_conversa), 0);
  const total = base.reduce((s, b) => s + Number(b.contatos), 0);

  return (
    <div className="space-y-3">
      {/* Sem esse aviso, a tabela sugere uma carteira analisável maior do que
          existe — e a conclusão sobre a base sairia errada. */}
      {semConversaTotal > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {semConversaTotal} de {total} contatos etiquetados não têm conversa no acervo. Não
            é falha de coleta: a própria Evolution lista o chat e nunca sincronizou o conteúdo.
            Dá para trabalhar essa carteira, mas não há o que a IA analisar nela.
          </span>
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Etiqueta</th>
              <th className="px-3 py-2 text-right font-medium">Contatos</th>
              <th className="px-3 py-2 text-right font-medium">Com conversa</th>
              <th className="px-3 py-2 text-right font-medium">Sem atendimento</th>
              <th className="px-3 py-2 text-right font-medium">Analisados</th>
              <th className="px-3 py-2 text-left font-medium">Etapa que a IA vê</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {base.map((b) => {
              const aberto = aberta === b.label_id;
              return (
                <tr
                  key={b.label_id}
                  className={`border-b border-border/50 last:border-0 ${
                    aberto ? 'bg-muted/30' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: corDaEtiqueta(b.cor) }}
                      />
                      <span className="font-medium">{b.etiqueta}</span>
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-right">{b.contatos}</td>
                  <td className="num px-3 py-2 text-right">
                    {b.com_conversa}
                    {Number(b.sem_conversa) > 0 && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        (+{b.sem_conversa} sem)
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-2 text-right">
                    {Number(b.sem_atendimento) > 0 ? (
                      <span className="text-destructive">{b.sem_atendimento}</span>
                    ) : (
                      b.sem_atendimento
                    )}
                  </td>
                  <td className="num px-3 py-2 text-right text-muted-foreground">
                    {b.analisados}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {b.etapa_ia_mais_comum
                      ? (ETAPA_LEGIVEL[b.etapa_ia_mais_comum] ?? b.etapa_ia_mais_comum)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setAberta(aberto ? null : b.label_id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {aberto ? 'Fechar' : 'Ver contatos'}
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-90' : ''}`}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aberta && (
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            {contatos.length} contato(s) em{' '}
            <span className="font-medium text-foreground">
              {base.find((b) => b.label_id === aberta)?.etiqueta}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {contatos.map((c) => (
                  <tr key={c.remote_jid} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="font-medium">{c.nome ?? '(sem nome)'}</span>
                      {!c.tem_conversa && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          sem conversa no acervo
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-1.5 text-right text-xs text-muted-foreground">
                      {c.telefone ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                      {c.etapa_ia ? (ETAPA_LEGIVEL[c.etapa_ia] ?? c.etapa_ia) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs">
                      {c.tem_conversa && !c.atendido && (
                        <span className="text-destructive">nunca respondido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
