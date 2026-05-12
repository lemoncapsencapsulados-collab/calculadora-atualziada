import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { HistoricoVhsysEntry } from '@/types/formula';

interface Props {
  entradas?: HistoricoVhsysEntry[];
}

const ORIGEM_LABEL: Record<HistoricoVhsysEntry['origem'], string> = {
  aprovacao_pagamento: 'Aprovação de pagamento',
  proposta_completa: 'Proposta completa',
  manual: 'Reenvio manual',
};

export default function HistoricoVhsysLista({ entradas }: Props) {
  const [aberto, setAberto] = useState<Record<number, boolean>>({});

  if (!entradas || entradas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nenhum cadastro no VhSys registrado para este pedido.
      </p>
    );
  }
  const ordered = [...entradas].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );
  return (
    <div className="space-y-2">
      {ordered.map((e, i) => {
        const open = !!aberto[i];
        const hasDetails = !!(e.payload || e.resposta);
        return (
          <div
            key={i}
            className={`rounded-md border p-2 text-xs space-y-1 ${
              e.sucesso ? 'bg-green-50 border-green-200' : 'bg-destructive/5 border-destructive/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {e.sucesso ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span className="text-muted-foreground">
                  {format(new Date(e.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <Badge variant="outline" className="text-[10px] py-0 h-4">
                  {ORIGEM_LABEL[e.origem] || e.origem}
                </Badge>
              </div>
              {hasDetails && (
                <button
                  type="button"
                  onClick={() => setAberto((p) => ({ ...p, [i]: !open }))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
            <p className="text-foreground">{e.mensagem}</p>
            {open && hasDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {e.payload && (
                  <div>
                    <p className="font-semibold text-[10px] uppercase text-muted-foreground">Enviado</p>
                    <pre className="whitespace-pre-wrap break-all text-[10px] bg-background/60 rounded p-1.5 max-h-40 overflow-auto">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </div>
                )}
                {e.resposta != null && (
                  <div>
                    <p className="font-semibold text-[10px] uppercase text-muted-foreground">Resposta</p>
                    <pre className="whitespace-pre-wrap break-all text-[10px] bg-background/60 rounded p-1.5 max-h-40 overflow-auto">
                      {JSON.stringify(e.resposta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
