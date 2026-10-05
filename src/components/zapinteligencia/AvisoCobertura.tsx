import { AlertTriangle, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AvisoCobertura as Aviso } from '@/lib/coberturaWhatsapp';

/**
 * O aviso de período sem dado.
 *
 * Fica ACIMA dos números, não ao lado nem no rodapé: quem abre o painel lê o
 * primeiro número que vê e decide. Se o alerta chega depois, chega tarde.
 *
 * O botão não é enfeite -- é a saída. Sem ele, o leitor sabe que o período está
 * vazio mas continua sem ver o atendimento real do consultor, que é o que foi
 * pesquisar.
 */
export default function AvisoCoberturaWhatsapp({
  aviso,
  onVerPeriodoComDado,
}: {
  aviso: Aviso;
  onVerPeriodoComDado?: (ate: Date) => void;
}) {
  const parada = aviso.tom === 'parada';
  const Icone = parada ? AlertTriangle : Scissors;

  return (
    <div
      role="alert"
      className={
        parada
          ? 'rounded-xl border-2 border-destructive/60 bg-destructive/10 p-5 space-y-2'
          : 'rounded-xl border border-warning/50 bg-warning/10 p-5 space-y-2'
      }
    >
      <div className="flex items-start gap-3">
        <Icone
          className={`w-5 h-5 mt-0.5 shrink-0 ${parada ? 'text-destructive' : 'text-warning'}`}
        />
        <div className="space-y-1.5 min-w-0">
          <p className="font-semibold leading-snug">{aviso.titulo}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{aviso.detalhe}</p>
          {onVerPeriodoComDado && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => onVerPeriodoComDado(aviso.confiavelAte)}
            >
              Ver o último mês com dado
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
