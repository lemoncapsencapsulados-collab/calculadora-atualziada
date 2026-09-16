import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Pedido } from '@/types/formula';
import { derivarRecebimentos, Recebimento } from '@/lib/recebimentos';

const STORAGE_KEY = 'recebimento-notificacoes-emitidas-v1';
const SETTINGS_KEY = 'recebimento-notificacoes-settings-v1';

export interface RecebimentoNotifSettings {
  diasAntesVencimento: number; // alerta quando faltam <= N dias
  diasPendenteAlerta: number;  // alerta quando pendente há > N dias
  ativo: boolean;
}

export const DEFAULT_NOTIF_SETTINGS: RecebimentoNotifSettings = {
  diasAntesVencimento: 3,
  diasPendenteAlerta: 5,
  ativo: true,
};

export function loadNotifSettings(): RecebimentoNotifSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
}
export function saveNotifSettings(s: RecebimentoNotifSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

type Emitidas = Record<string, { proximo?: boolean; atrasado?: boolean }>;
const loadEmitidas = (): Emitidas => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const saveEmitidas = (v: Emitidas) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {}
};

const diasEntre = (a: string, b: string): number => {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86_400_000);
};

export function useRecebimentoNotificacoes(pedidos: Pedido[] | undefined) {
  const emitidasRef = useRef<Emitidas>(loadEmitidas());

  const recebimentos = useMemo<Recebimento[]>(
    () => (pedidos || []).flatMap((p) => derivarRecebimentos(p)),
    [pedidos],
  );

  useEffect(() => {
    if (!recebimentos.length) return;
    const cfg = loadNotifSettings();
    if (!cfg.ativo) return;

    const hoje = new Date().toISOString().slice(0, 10);
    const emitidas = emitidasRef.current;
    let mudou = false;

    recebimentos.forEach((r) => {
      if (!r.data || r.status === 'pago' || r.status === 'sem_data') return;
      const id = `${r.pedidoId}-${r.indice}`;
      const reg = emitidas[id] || {};
      const dias = diasEntre(hoje, r.data);

      // Vencimento próximo (futuro, dentro do limite)
      if (r.status === 'futuro' && dias <= cfg.diasAntesVencimento && dias >= 0 && !reg.proximo) {
        toast.warning(
          dias === 0 ? 'Recebimento vence hoje' : `Recebimento vence em ${dias} dia(s)`,
          {
            description: `${r.clienteNome} · ${r.descricao} · R$ ${r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            duration: 10_000,
          },
        );
        reg.proximo = true;
        emitidas[id] = reg;
        mudou = true;
      }

      // Pendente há mais de X dias
      if (r.status === 'pendente') {
        const diasAtraso = -dias; // r.data é passado, dias é negativo
        if (diasAtraso > cfg.diasPendenteAlerta && !reg.atrasado) {
          toast.error(`Pagamento atrasado há ${diasAtraso} dia(s)`, {
            description: `${r.clienteNome} · ${r.descricao} · R$ ${r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            duration: 12_000,
          });
          reg.atrasado = true;
          emitidas[id] = reg;
          mudou = true;
        }
      }
    });

    if (mudou) saveEmitidas(emitidas);
  }, [recebimentos]);
}