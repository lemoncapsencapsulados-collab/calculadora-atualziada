import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  type ItemParaRecalculo,
  type PrecificacaoAtual,
  type ResultadoRecalculo,
  custosDaPrecificacao,
  recalcularItens,
} from '@/lib/recalculoPreco';

/**
 * Recálculo de preço de um orçamento contra a precificação de hoje.
 *
 * Em dois passos de propósito: `simular` mostra o que mudaria, `aplicar` grava.
 * O consultor precisa ver a diferença antes, porque quem fala com o cliente é
 * ele -- e um preço que muda sozinho, sem ninguém saber de onde veio, é pior
 * que um preço velho.
 */

interface AlvoRecalculo {
  id: string;
  itens_producao?: unknown;
  subtotal_servicos?: number | null;
}

/** Lê as precificações que os itens deste orçamento usam. */
async function precificacoesDosItens(itens: ItemParaRecalculo[]): Promise<PrecificacaoAtual[]> {
  const ids = Array.from(
    new Set(itens.map((i) => i.precificacao_id).filter((id): id is string => !!id)),
  );
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('precificacoes')
    .select(
      'id, preco_venda, custo_materia_prima, custo_embalagem, total_impostos, custo_mao_obra_direta, margem_lucro_percentual',
    )
    .in('id', ids);
  if (error) throw error;
  return (data || []) as PrecificacaoAtual[];
}

export function useRecalcularPreco() {
  const queryClient = useQueryClient();

  /** Só calcula: não grava nada. É o que alimenta o popup. */
  const simular = useMutation({
    mutationFn: async (alvo: AlvoRecalculo): Promise<ResultadoRecalculo> => {
      const itens = ((alvo.itens_producao || []) as ItemParaRecalculo[]) ?? [];
      return recalcularItens(itens, await precificacoesDosItens(itens));
    },
  });

  /**
   * Grava o preço novo nos itens e reinicia a janela de 5 dias.
   *
   * `preco_anterior_recalculo` guarda o total de antes: depois de gravar não há
   * mais como saber quanto era, e é o número que o cliente vai cobrar se
   * reclamar do aumento.
   */
  const aplicar = useMutation({
    mutationFn: async ({
      alvo,
      resultado,
    }: {
      alvo: AlvoRecalculo;
      resultado: ResultadoRecalculo;
    }) => {
      const itens = ((alvo.itens_producao || []) as ItemParaRecalculo[]) ?? [];
      const precificacoes = await precificacoesDosItens(itens);
      const porId = new Map(precificacoes.map((p) => [p.id, p]));

      const novosItens = itens.map((item) => {
        const atual = item.precificacao_id ? porId.get(item.precificacao_id) : null;
        if (!atual) return item;
        const preco = Number(atual.preco_venda) || 0;
        return {
          ...item,
          preco_unitario: preco,
          subtotal: preco * (Number(item.quantidade) || 0),
          // Guarda os componentes de agora: é o que permite explicar a causa
          // no próximo recálculo, em vez de só mostrar a diferença de preço.
          custos_no_orcamento: custosDaPrecificacao(atual),
        };
      });

      const subtotalProducao = novosItens.reduce(
        (s, i) => s + (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 0),
        0,
      );
      const servicos = Number(alvo.subtotal_servicos) || 0;

      const { error } = await supabase
        .from('orcamentos')
        .update({
          itens_producao: novosItens as never,
          subtotal_producao: subtotalProducao,
          valor_total: subtotalProducao + servicos,
          preco_recalculado_em: new Date().toISOString(),
          preco_anterior_recalculo: resultado.totalAntes,
        })
        .eq('id', alvo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });

  return { simular, aplicar };
}
