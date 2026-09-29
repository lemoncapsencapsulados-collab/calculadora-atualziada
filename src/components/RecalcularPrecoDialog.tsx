import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Calculator, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import { useRecalcularPreco } from '@/hooks/useRecalcularPreco';
import type { ResultadoRecalculo } from '@/lib/recalculoPreco';
import { situacaoPrazo } from '@/lib/prazoRecalculo';

interface Alvo {
  id: string;
  numero_orcamento?: string | null;
  nome_cliente?: string | null;
  status?: string | null;
  created_at?: string | null;
  preco_recalculado_em?: string | null;
  itens_producao?: unknown;
  subtotal_servicos?: number | null;
}

interface Props {
  alvo: Alvo;
  tipo: 'orcamento' | 'pedido';
  onClose: () => void;
  onAplicado?: () => void;
}

/**
 * Mostra o que o recálculo mudaria antes de mudar.
 *
 * O consultor é quem fala com o cliente sobre o aumento, então ele precisa ver
 * o de/para item a item e a causa de cada um -- "matéria-prima subiu R$ 3,00",
 * não apenas "o preço mudou". Só grava depois que ele confirma.
 */
export default function RecalcularPrecoDialog({ alvo, tipo, onClose, onAplicado }: Props) {
  const { simular, aplicar } = useRecalcularPreco();
  const [resultado, setResultado] = useState<ResultadoRecalculo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const situacao = situacaoPrazo({
    status: alvo.status,
    criadoEm: alvo.created_at,
    recalculadoEm: alvo.preco_recalculado_em,
  });

  useEffect(() => {
    let vivo = true;
    setErro(null);
    simular
      .mutateAsync(alvo)
      .then((r) => vivo && setResultado(r))
      .catch((e) => vivo && setErro(e?.message || 'Não foi possível ler as precificações.'));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo.id]);

  const confirmar = async () => {
    if (!resultado) return;
    setErro(null);
    try {
      await aplicar.mutateAsync({ alvo, resultado });
      onAplicado?.();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível gravar o preço novo.');
    }
  };

  const nome = tipo === 'pedido' ? 'Pedido de Compra' : 'Orçamento';
  const subiu = (resultado?.diferencaTotal ?? 0) > 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calculator className="h-5 w-5 text-primary" />
            Recalcular {nome} {alvo.numero_orcamento ? `nº ${alvo.numero_orcamento}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {situacao.vencido
              ? `O preço combinado venceu há ${Math.abs(situacao.diasRestantes)} dia(s). ` +
                'Confira o que mudou antes de levar o valor novo ao cliente.'
              : 'O preço combinado ainda está no prazo. Recalcular agora reinicia a janela de 5 dias.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {erro && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{erro}</p>
            </div>
          )}

          {!resultado && !erro && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Lendo as precificações de hoje…
              </span>
            </div>
          )}

          {resultado?.semMudanca && (
            <div className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
              <div className="text-sm text-green-900 dark:text-green-100">
                <p className="font-medium">Nenhum preço mudou.</p>
                <p className="text-xs opacity-80">
                  Custos, imposto e markup continuam os mesmos de quando o {nome.toLowerCase()} foi
                  montado. Confirmar apenas reinicia o prazo de 5 dias.
                </p>
              </div>
            </div>
          )}

          {resultado && resultado.mudancas.length > 0 && (
            <div className="space-y-3">
              {resultado.mudancas.map((m) => (
                <div key={m.precificacaoId + m.nome} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{m.nome}</span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {formatCurrency(m.precoAntes)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold">{formatCurrency(m.precoDepois)}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px]',
                          m.diferenca > 0
                            ? 'border-red-400 text-red-700 dark:text-red-400'
                            : 'border-green-500 text-green-700 dark:text-green-400',
                        )}
                      >
                        {m.diferenca > 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(m.diferenca))} / un.
                      </Badge>
                    </span>
                  </div>

                  {m.motivos.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {m.motivos.map((motivo) => (
                        <li key={motivo}>• {motivo}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Este {nome.toLowerCase()} é anterior ao sistema guardar os componentes do
                      custo, então dá para mostrar a diferença de preço, mas não de onde ela veio.
                      No próximo recálculo a causa aparece.
                    </p>
                  )}

                  {m.quantidade > 1 && (
                    <p className="mt-1 text-xs">
                      {m.quantidade} unidades ={' '}
                      <span className={m.diferenca > 0 ? 'text-red-700 dark:text-red-400' : ''}>
                        {m.diferenca > 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(m.diferenca * m.quantidade))}
                      </span>{' '}
                      no total
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {resultado && resultado.semPrecificacao.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm text-amber-900 dark:text-amber-100">
                <p className="font-medium">
                  {resultado.semPrecificacao.length} produto(s) sem precificação no sistema
                </p>
                <p className="text-xs opacity-80">
                  {resultado.semPrecificacao.join(', ')} — o preço deles fica como está, porque não
                  há de onde recalcular. Confira à mão se ainda vale.
                </p>
              </div>
            </div>
          )}

          {resultado && !resultado.semMudanca && (
            <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <span className="text-sm font-medium">Total do {nome.toLowerCase()}</span>
              <span className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground line-through">
                  {formatCurrency(resultado.totalAntes)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span
                  className={cn(
                    'text-base font-bold',
                    subiu ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400',
                  )}
                >
                  {formatCurrency(resultado.totalDepois)}
                </span>
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:px-6">
          <Button variant="ghost" onClick={onClose} className="sm:mr-auto">
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!resultado || aplicar.isPending}>
            {aplicar.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gravando…
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {resultado?.semMudanca ? 'Confirmar e renovar o prazo' : 'Aplicar preço novo'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
