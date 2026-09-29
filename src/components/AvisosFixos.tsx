import { useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type TipoAviso, fecharAviso, inscrever, lerAvisos } from '@/lib/avisos';

/**
 * Faixa de avisos no topo da janela.
 *
 * Fica sobre o conteúdo, como barra de sistema, e não empurra a página. Erro e
 * alerta continuam ali enquanto a pessoa corrige o formulário -- que é
 * justamente quando ela precisa ler a mensagem. Antes eram notificações
 * flutuantes que sumiam em poucos segundos.
 */

const ESTILO: Record<TipoAviso, { caixa: string; icone: typeof AlertTriangle }> = {
  erro: {
    caixa:
      'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
    icone: AlertTriangle,
  },
  alerta: {
    caixa:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
    icone: Info,
  },
  sucesso: {
    caixa:
      'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
    icone: CheckCircle2,
  },
};

export default function AvisosFixos() {
  const avisos = useSyncExternalStore(inscrever, lerAvisos, lerAvisos);
  if (avisos.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-1.5 p-2 sm:p-3">
      {avisos.map((aviso) => {
        const { caixa, icone: Icone } = ESTILO[aviso.tipo];
        return (
          <div
            key={aviso.id}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-2xl items-start gap-2 rounded-lg border px-3 py-2 shadow-md',
              caixa,
            )}
          >
            <Icone className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{aviso.titulo}</p>
              {aviso.detalhe && <p className="text-xs opacity-80">{aviso.detalhe}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => fecharAviso(aviso.id)}
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
