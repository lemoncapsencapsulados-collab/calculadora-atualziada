import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePrazosAtivos, calcDiasRestantes } from '@/hooks/usePrazoPrecoAtivo';

const JANELA_DIAS = 20;

export function PrazoPrecoCountdown() {
  const { data: prazos, isLoading } = usePrazosAtivos();
  const ativos = (prazos || []).filter((p) => calcDiasRestantes(p.data_fim) > 0);

  if (isLoading) {
    return (
      <Card className="p-4 mb-6 animate-pulse h-24 bg-muted/30" />
    );
  }

  if (ativos.length === 0) {
    return (
      <Card className="p-4 mb-6 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-900">Nenhum Prazo de Preços ativo</p>
            <p className="text-muted-foreground">
              As próximas alterações nas variáveis estruturais iniciarão uma nova janela de {JANELA_DIAS} dias para recálculo automático.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Mais próximo de vencer = menor diasRestantes
  const principal = [...ativos].sort(
    (a, b) => calcDiasRestantes(a.data_fim) - calcDiasRestantes(b.data_fim),
  )[0];
  const dias = calcDiasRestantes(principal.data_fim);
  const dataInicio = new Date(principal.data_inicio).toLocaleDateString('pt-BR');
  const dataFim = new Date(principal.data_fim).toLocaleDateString('pt-BR');

  // % decorrido da janela
  const totalMs = new Date(principal.data_fim).getTime() - new Date(principal.data_inicio).getTime();
  const decorridoMs = Date.now() - new Date(principal.data_inicio).getTime();
  const pctDecorrido = Math.min(100, Math.max(0, (decorridoMs / totalMs) * 100));

  const tema =
    dias > 10
      ? {
          card: 'border-emerald-500/30 bg-emerald-500/5',
          texto: 'text-emerald-700',
          numero: 'text-emerald-700',
          icone: 'text-emerald-600',
          Icon: Clock,
        }
      : dias > 3
      ? {
          card: 'border-amber-500/40 bg-amber-500/10',
          texto: 'text-amber-800',
          numero: 'text-amber-700',
          icone: 'text-amber-600',
          Icon: Clock,
        }
      : {
          card: 'border-red-500/40 bg-red-500/10',
          texto: 'text-red-800',
          numero: 'text-red-700',
          icone: 'text-red-600',
          Icon: AlertTriangle,
        };

  const Icon = tema.Icon;
  const extras = ativos.length - 1;

  return (
    <Card className={`p-5 mb-6 border ${tema.card}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4 md:flex-1">
          <div className={`shrink-0 ${tema.icone}`}>
            <Icon className="w-8 h-8" />
          </div>
          <div>
            <p className={`text-xs uppercase tracking-wide font-semibold ${tema.texto}`}>
              Prazo de Preços ativo
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${tema.numero}`}>{dias}</span>
              <span className={`text-lg font-medium ${tema.texto}`}>
                {dias === 1 ? 'dia restante' : 'dias restantes'}
              </span>
            </div>
            <p className={`text-xs mt-1 ${tema.texto}`}>
              Início: <strong>{dataInicio}</strong> • Vencimento: <strong>{dataFim}</strong>
              {extras > 0 && (
                <span className="ml-2 opacity-80">(+{extras} outro{extras === 1 ? '' : 's'} prazo{extras === 1 ? '' : 's'} ativo{extras === 1 ? '' : 's'})</span>
              )}
            </p>
          </div>
        </div>

        <div className="md:w-72 space-y-2">
          <Progress value={pctDecorrido} className="h-2" />
          <p className={`text-xs ${tema.texto}`}>
            Os preços de orçamentos não aprovados serão recalculados automaticamente em <strong>{dataFim}</strong>.
          </p>
        </div>
      </div>
    </Card>
  );
}
