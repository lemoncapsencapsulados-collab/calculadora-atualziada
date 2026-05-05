import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aplicarPrazosVencidos } from '@/lib/aplicarPrazoPreco';

/**
 * Roda 1x na montagem e a cada 5 min. Aplica recálculo de orçamentos quando o prazo de 20 dias vence.
 */
export function useAplicarPrazoVencido(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const rodando = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelado = false;

    const executar = async () => {
      if (rodando.current) return;
      rodando.current = true;
      try {
        const resultados = await aplicarPrazosVencidos();
        if (cancelado) return;
        const totalOrc = resultados.reduce((a, r) => a + r.orcamentos, 0);
        const totalPrec = resultados.reduce((a, r) => a + r.precificacoes, 0);
        if (resultados.length > 0 && (totalOrc + totalPrec) > 0) {
          toast.info(`Prazo de Preços aplicado: ${totalOrc} orçamento(s) e ${totalPrec} precificação(ões) recalculados.`);
          queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
          queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
          queryClient.invalidateQueries({ queryKey: ['prazos-precos-ativos'] });
        }
      } catch (e) {
        console.error('Falha em aplicarPrazosVencidos', e);
      } finally {
        rodando.current = false;
      }
    };

    executar();
    const intervalo = setInterval(executar, 5 * 60 * 1000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [queryClient, enabled]);
}
