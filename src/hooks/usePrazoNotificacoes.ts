import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePrazosAtivos, calcDiasRestantes, type PrazoPreco } from '@/hooks/usePrazoPrecoAtivo';

const STORAGE_KEY = 'prazo-notificacoes-emitidas-v1';

type Emitidas = Record<string, { aviso3?: boolean; expirado?: boolean }>;

function load(): Emitidas {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function save(v: Emitidas) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {}
}

/**
 * Emite toasts quando faltam <=3 dias para vencer ou quando o prazo já venceu.
 * Persiste em localStorage para não duplicar avisos no mesmo navegador.
 */
export function usePrazoNotificacoes() {
  const { data: prazos } = usePrazosAtivos();
  const emitidasRef = useRef<Emitidas>(load());

  useEffect(() => {
    if (!prazos || prazos.length === 0) return;
    const emitidas = emitidasRef.current;
    let mudou = false;

    prazos.forEach((p: PrazoPreco) => {
      const dias = calcDiasRestantes(p.data_fim);
      const reg = emitidas[p.id] || {};
      const dataFim = new Date(p.data_fim).toLocaleDateString('pt-BR');

      if (dias <= 0 && !reg.expirado) {
        toast.warning('Prazo de Preços expirado', {
          description: `Os preços de orçamentos não aprovados serão recalculados automaticamente agora (vencimento: ${dataFim}).`,
          duration: 10_000,
        });
        reg.expirado = true;
        emitidas[p.id] = reg;
        mudou = true;
      } else if (dias > 0 && dias <= 3 && !reg.aviso3) {
        toast.warning(`Faltam ${dias} dia(s) para o recálculo automático`, {
          description: `Vencimento em ${dataFim}. Os orçamentos em rascunho/enviado/em negociação serão recalculados ao final do prazo.`,
          duration: 10_000,
        });
        reg.aviso3 = true;
        emitidas[p.id] = reg;
        mudou = true;
      }
    });

    if (mudou) save(emitidas);
  }, [prazos]);
}
