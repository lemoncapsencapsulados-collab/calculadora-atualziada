import { Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePrazoPrecoAtivo } from '@/hooks/usePrazoPrecoAtivo';

interface Props {
  prazoPrecoId?: string | null;
  className?: string;
  compact?: boolean;
}

export function PrazoPrecoBadge({ prazoPrecoId, className, compact }: Props) {
  const { prazo, diasRestantes, ativo } = usePrazoPrecoAtivo(prazoPrecoId);
  if (!prazoPrecoId || !prazo || !ativo) return null;

  const cor = diasRestantes > 10
    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40'
    : diasRestantes > 3
    ? 'bg-amber-500/15 text-amber-700 border-amber-500/40'
    : 'bg-red-500/15 text-red-700 border-red-500/40';

  const dataFim = new Date(prazo.data_fim).toLocaleDateString('pt-BR');
  const dataInicio = new Date(prazo.data_inicio).toLocaleDateString('pt-BR');
  const Icon = diasRestantes <= 3 ? AlertTriangle : Clock;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 border ${cor} ${className || ''}`}>
            <Icon className="w-3 h-3" />
            {compact ? `${diasRestantes}d` : `Prazo de Preços: ${diasRestantes}d`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">
            Os custos foram alterados em <strong>{dataInicio}</strong>. Após <strong>{dataFim}</strong> este item será
            recalculado automaticamente com base na nova configuração.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
