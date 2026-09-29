/**
 * Ponte do `useToast`/`toast` antigo para os avisos fixos.
 *
 * Este arquivo era o toast do shadcn: notificação flutuante que sumia sozinha.
 * O comportamento mudou -- erro e alerta agora ficam na tela até alguém fechar
 * --, mas a assinatura continua a mesma para as 17 telas que já o usavam não
 * precisarem ser reescritas.
 *
 * O `variant: 'destructive'` que essas telas passam vira erro; o resto vira
 * alerta, que é o que aquele toast neutro significava na prática.
 */

import { aviso, fecharAviso, inscrever, lerAvisos } from '@/lib/avisos';
import { useSyncExternalStore } from 'react';

interface PropsToast {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive' | string;
  [k: string]: unknown;
}

const comoTexto = (v: unknown): string => (v == null ? '' : String(v));

export function toast(props: PropsToast) {
  const titulo = comoTexto(props.title) || comoTexto(props.description);
  const detalhe = props.title ? comoTexto(props.description) : '';
  const id =
    props.variant === 'destructive'
      ? aviso.error(titulo, { description: detalhe })
      : aviso.warning(titulo, { description: detalhe });

  return {
    id,
    dismiss: () => typeof id === 'number' && fecharAviso(id),
    update: () => undefined,
  };
}

export function useToast() {
  const avisos = useSyncExternalStore(inscrever, lerAvisos, lerAvisos);
  return {
    toast,
    dismiss: (id?: number) => aviso.dismiss(id),
    // A lista continua exposta porque o Toaster do shadcn a lia; hoje quem
    // desenha e' `AvisosFixos`, entao vem so' para nao quebrar quem importar.
    toasts: avisos.map((a) => ({
      id: String(a.id),
      title: a.titulo,
      description: a.detalhe,
      action: undefined as React.ReactNode,
    })),
  };
}
