import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';

interface AlteracaoEntry {
  alterado_em: string;
  alterado_por?: string | null;
  data_pagamento_anterior?: string | null;
  data_pagamento_nova?: string | null;
  resumo_anterior?: string;
  resumo_novo?: string;
}

interface Props {
  alteracoes?: AlteracaoEntry[];
  compact?: boolean;
}

const formatarData = (iso?: string | null) =>
  iso ? format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }) : '—';

export default function HistoricoPagamentoLista({ alteracoes, compact }: Props) {
  if (!alteracoes || alteracoes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nenhuma alteração de pagamento registrada.
      </p>
    );
  }
  const ordered = [...alteracoes].sort(
    (a, b) => new Date(b.alterado_em).getTime() - new Date(a.alterado_em).getTime(),
  );
  return (
    <div className="space-y-2">
      {ordered.map((alt, i) => (
        <div
          key={i}
          className="rounded-md border bg-muted/40 p-2 text-xs space-y-1"
        >
          <div className="flex items-center gap-1 text-muted-foreground">
            <History className="h-3 w-3" />
            <span>
              {format(new Date(alt.alterado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {alt.alterado_por && <span>· {alt.alterado_por}</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <p className="font-semibold text-[11px] uppercase text-muted-foreground">Antes</p>
              <p>Data: <strong>{formatarData(alt.data_pagamento_anterior)}</strong></p>
              {!compact && alt.resumo_anterior && (
                <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground mt-1">
                  {alt.resumo_anterior}
                </pre>
              )}
            </div>
            <div>
              <p className="font-semibold text-[11px] uppercase text-primary">Depois</p>
              <p>Data: <strong>{formatarData(alt.data_pagamento_nova)}</strong></p>
              {!compact && alt.resumo_novo && (
                <pre className="whitespace-pre-wrap text-[11px] mt-1">
                  {alt.resumo_novo}
                </pre>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}