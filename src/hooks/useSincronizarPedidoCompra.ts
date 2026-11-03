import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { montarDadosPedidoCompra } from '@/lib/pedidoCompraAutoFill';
import { pedidoCompraPreenchido } from '@/types/pedidoCompra';
import { houveMudanca, reconciliarPedidoCompra } from '@/lib/reconciliarPedidoCompra';
import { novoRegistro, resumirDiferencas } from '@/lib/historicoEdicao';

/**
 * O Pedido de Compra seguindo o Orçamento para Contrato que o originou.
 *
 * Roda sozinho depois que a Proposta grava. Antes, editar produto, quantidade,
 * fórmula ou dose no Orçamento para Contrato não chegava ao Pedido de Compra:
 * o documento, uma vez preenchido, valia sobre o autopreenchimento e congelava
 * junto tudo que vinha do orçamento.
 *
 * O mesmo documento mora em dois lugares -- no orçamento e no pedido que
 * nasceu dele -- e os dois são atualizados, senão abrir por um caminho mostra
 * uma versão e pelo outro, outra.
 *
 * A embalagem nunca é tocada: `reconciliarPedidoCompra` separa o que vem do
 * orçamento do que foi escolhido à mão.
 */
const historicoDe = (row: { historico_edicoes?: unknown } | null | undefined) =>
  Array.isArray(row?.historico_edicoes) ? row.historico_edicoes : [];

/** A coluna de histórico ainda não existe neste banco. */
const semColunaDeHistorico = (e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  return (
    err?.code === '42703' ||
    err?.code === 'PGRST204' ||
    /historico_edicoes/.test(err?.message || '')
  );
};

export function useSincronizarPedidoCompra() {
  const queryClient = useQueryClient();

  /**
   * @param orcamentoId orçamento que acabou de ser gravado
   * @param snapshot o conteúdo dele agora, como a Proposta o montou
   */
  const sincronizar = async (orcamentoId: string, snapshot: unknown): Promise<number> => {
    if (!orcamentoId || !snapshot) return 0;

    // O documento auto-preenchido a partir do orçamento de AGORA.
    const doOrcamento = montarDadosPedidoCompra({ snapshot } as never) as never;

    const [{ data: orc }, { data: peds }] = await Promise.all([
      supabase
        .from('orcamentos')
        // `*` porque os tipos gerados ainda nao conhecem `historico_edicoes`:
        // pedi-la por nome faz o TypeScript recusar a linha inteira.
        .select('*')
        .eq('id', orcamentoId)
        .maybeSingle(),
      supabase
        .from('pedidos')
        .select('*')
        .eq('orcamento_id', orcamentoId),
    ]);

    let atualizados = 0;

    const gravar = async (
      tabela: 'orcamentos' | 'pedidos',
      id: string,
      salvoRow: { pedido_compra_dados?: unknown; historico_edicoes?: unknown },
    ): Promise<void> => {
      const salvo = salvoRow?.pedido_compra_dados;
      // Documento ainda não preenchido não precisa de reconciliação: ele será
      // montado do orçamento na hora em que alguém abrir. Só o número do pedido
      // editado no Projeto para Contrato também não é documento.
      if (!pedidoCompraPreenchido(salvo)) return;
      const novo = reconciliarPedidoCompra(salvo as never, doOrcamento);
      if (!houveMudanca(salvo as never, novo)) return;

      const registro = novoRegistro('orcamento_para_contrato', resumirDiferencas(salvo, novo));

      // O historico vai junto na mesma gravacao. Se a coluna ainda nao existe
      // (migracao 20261023120000 nao aplicada), grava so' o documento: o que
      // o consultor precisa e' o documento certo; o log e' o complemento.
      const campos = { pedido_compra_dados: novo as never };
      let { error } = await supabase
        .from(tabela)
        .update({ ...campos, historico_edicoes: [...historicoDe(salvoRow), registro] as never })
        .eq('id', id);
      if (error && semColunaDeHistorico(error)) {
        ({ error } = await supabase.from(tabela).update(campos).eq('id', id));
      }
      if (error) throw error;
      atualizados++;
    };

    if (orc?.id) await gravar('orcamentos', orc.id, orc as never);
    for (const p of peds || []) await gravar('pedidos', p.id, p as never);

    if (atualizados) {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    }
    return atualizados;
  };

  return { sincronizar };
}
