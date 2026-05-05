import { AlertTriangle } from 'lucide-react';
import { usePrazosAtivos, calcDiasRestantes } from '@/hooks/usePrazoPrecoAtivo';

export function PrazoPrecoBanner() {
  const { data: prazos } = usePrazosAtivos();
  const ativos = (prazos || []).filter((p) => calcDiasRestantes(p.data_fim) > 0);
  if (ativos.length === 0) return null;

  const principal = ativos[0];
  const dias = calcDiasRestantes(principal.data_fim);
  const dataFim = new Date(principal.data_fim).toLocaleDateString('pt-BR');

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-amber-900">
      <div className="container mx-auto flex items-center gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <strong>Prazo de Preços ativo</strong> — vence em <strong>{dias} dia{dias === 1 ? '' : 's'}</strong> ({dataFim}).
          Orçamentos não aprovados serão recalculados automaticamente nessa data.
        </span>
      </div>
    </div>
  );
}
