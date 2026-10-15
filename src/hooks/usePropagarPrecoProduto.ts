import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  type ItemParaRecalculo,
  type PrecificacaoAtual,
  custosDaPrecificacao,
  motivosDaMudanca,
  recalcularItens,
} from '@/lib/recalculoPreco';
import {
  type OrcamentoParaPropagar,
  type PedidoParaPropagar,
  registroDaPropagacao,
  selecionarOrcamentos,
  selecionarPedidos,
} from '@/lib/propagacaoPreco';
import { invalidarCachesDaFormula } from '@/lib/cachesDaFormula';

/**
 * Leva o preço novo de um produto precificado aos documentos em negociação.
 *
 * Roda depois de salvar o produto, sozinho. Antes, mudar uma matéria-prima
 * atualizava a precificação e parava ali: todo orçamento aberto seguia com o
 * preço antigo até alguém abrir cada um e apertar RECALCULAR. Quem não
 * lembrasse mandava ao cliente um preço que o sistema já não sustentava.
 *
 * Alcança só o que está em aberto. Orçamento pago, pedido aprovado e contrato
 * assinado ficam como estão -- a regra de quem pode mora em `propagacaoPreco`,
 * isolada e testada, porque é a fronteira entre atualizar e adulterar.
 *
 * Silencioso por decisão do Wesley: não interrompe quem está editando. O que
 * mudou fica no histórico de cada documento, com valor antes, valor depois e o
 * motivo -- é o que o consultor precisa ter na mão se o cliente perguntar.
 *
 * Falhar aqui NÃO derruba o salvamento do produto. A edição da fórmula e da
 * precificação já está gravada e é o que o usuário pediu; a propagação é
 * consequência, e o RECALCULAR manual continua de pé como rede.
 */

interface Resultado {
  orcamentosAtualizados: number;
  pedidosAtualizados: number;
  /** Usam o produto mas estão fechados. Não foram tocados. */
  travados: number;
}

/** Lê as precificações que os itens usam, para saber o preço de hoje. */
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

/** Reprecifica os itens e devolve a lista nova mais o total de produção. */
function reprecificar(itens: ItemParaRecalculo[], precificacoes: PrecificacaoAtual[]) {
  const porId = new Map(precificacoes.map((p) => [p.id, p]));
  const novos = itens.map((item) => {
    const atual = item.precificacao_id ? porId.get(item.precificacao_id) : null;
    // Sem precificação correspondente o item fica como está. Zerar o preço de
    // um item cuja precificação sumiu transformaria um dado faltando num
    // desconto total.
    if (!atual) return item;
    const preco = Number(atual.preco_venda) || 0;
    return {
      ...item,
      preco_unitario: preco,
      subtotal: preco * (Number(item.quantidade) || 0),
      custos_no_orcamento: custosDaPrecificacao(atual),
    };
  });
  const subtotal = novos.reduce(
    (s, i) => s + (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 0),
    0,
  );
  return { novos, subtotal };
}

/** Motivos da mudança do item que veio deste produto. */
function motivosDoProduto(
  itens: ItemParaRecalculo[],
  precificacoes: PrecificacaoAtual[],
  precificacaoId: string,
): string[] {
  const item = itens.find((i) => i.precificacao_id === precificacaoId);
  const atual = precificacoes.find((p) => p.id === precificacaoId);
  if (!item || !atual) return [];
  return motivosDaMudanca(
    (item as { custos_no_orcamento?: never }).custos_no_orcamento,
    custosDaPrecificacao(atual),
  );
}

/**
 * A coluna `historico_preco` pode não existir ainda (migração
 * 20261015120000_historico_preco.sql). Quando falta, grava o preço mesmo
 * assim e segue sem o histórico.
 *
 * O contrário -- desistir da gravação porque o log não cabe -- deixaria o
 * consultor mandando ao cliente um preço que o sistema já não sustenta, que é
 * exatamente o que esta propagação existe para evitar. O log é importante; o
 * preço certo é mais.
 */
function colunaDeHistoricoFaltando(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return (
    e?.code === '42703' ||
    e?.code === 'PGRST204' ||
    /historico_preco/.test(e?.message || '')
  );
}

export function usePropagarPrecoProduto() {
  const queryClient = useQueryClient();

  /**
   * @param precificacaoId produto que acabou de ser editado
   * @param nomeProduto só para o histórico ficar legível
   */
  const propagar = async (precificacaoId: string, nomeProduto?: string): Promise<Resultado> => {
    const vazio: Resultado = { orcamentosAtualizados: 0, pedidosAtualizados: 0, travados: 0 };
    if (!precificacaoId) return vazio;

    // Traz só o que pode mudar. Filtrar o status no banco em vez de no
    // navegador evita carregar a base inteira a cada edição de produto.
    //
    // A leitura também precisa tolerar a coluna de histórico faltando: pedir
    // uma coluna inexistente faz a PostgREST recusar a consulta inteira, e a
    // propagação morreria antes de gravar qualquer preço. Quando falta, relê
    // sem ela e segue sem histórico.
    const COLUNAS_ORC =
      'id, status, contrato_assinado_em, contrato_enviado_em, itens_producao, subtotal_servicos';
    const COLUNAS_PED = 'id, status, status_aprovacao, orcamento_snapshot';

    let semHistorico = false;

    const lerOrcamentos = (comHistorico: boolean) =>
      supabase
        .from('orcamentos')
        .select(comHistorico ? `${COLUNAS_ORC}, historico_preco` : COLUNAS_ORC)
        .in('status', ['rascunho', 'enviado']);
    const lerPedidos = (comHistorico: boolean) =>
      supabase
        .from('pedidos')
        .select(comHistorico ? `${COLUNAS_PED}, historico_preco` : COLUNAS_PED)
        .eq('status_aprovacao', 'pendente_assinatura');

    let [{ data: orcs, error: erroOrc }, { data: peds, error: erroPed }] = await Promise.all([
      lerOrcamentos(true),
      lerPedidos(true),
    ]);
    if (colunaDeHistoricoFaltando(erroOrc) || colunaDeHistoricoFaltando(erroPed)) {
      semHistorico = true;
      [{ data: orcs, error: erroOrc }, { data: peds, error: erroPed }] = await Promise.all([
        lerOrcamentos(false),
        lerPedidos(false),
      ]);
    }
    if (erroOrc) throw erroOrc;
    if (erroPed) throw erroPed;

    const selOrc = selecionarOrcamentos(
      (orcs || []) as unknown as (OrcamentoParaPropagar & { historico_preco?: unknown })[],
      precificacaoId,
    );
    const selPed = selecionarPedidos(
      (peds || []) as unknown as (PedidoParaPropagar & { historico_preco?: unknown })[],
      precificacaoId,
    );

    let orcamentosAtualizados = 0;
    let pedidosAtualizados = 0;

    for (const o of selOrc.atualizar) {
      const itens = ((o.itens_producao || []) as ItemParaRecalculo[]) ?? [];
      const precificacoes = await precificacoesDosItens(itens);
      const antes = recalcularItens(itens, precificacoes);
      if (antes.semMudanca) continue;

      const { novos, subtotal } = reprecificar(itens, precificacoes);
      const servicos = Number(o.subtotal_servicos) || 0;
      const registro = registroDaPropagacao({
        precificacaoId,
        nomeProduto,
        valorAnterior: antes.totalAntes,
        valorNovo: antes.totalDepois,
        motivos: motivosDoProduto(itens, precificacoes, precificacaoId),
      });

      const campos = {
        itens_producao: novos as never,
        subtotal_producao: subtotal,
        valor_total: subtotal + servicos,
        // Reinicia a janela de 5 dias: o preço de hoje passa a valer de hoje.
        preco_recalculado_em: registro.atualizado_em,
        preco_anterior_recalculo: antes.totalAntes,
      };
      const historico = {
        historico_preco: [
          ...(Array.isArray(o.historico_preco) ? o.historico_preco : []),
          registro,
        ] as never,
      };

      let { error } = semHistorico
        ? await supabase.from('orcamentos').update(campos).eq('id', o.id)
        : await supabase.from('orcamentos').update({ ...campos, ...historico }).eq('id', o.id);
      if (error && colunaDeHistoricoFaltando(error)) {
        semHistorico = true;
        ({ error } = await supabase.from('orcamentos').update(campos).eq('id', o.id));
      }
      if (error) throw error;
      orcamentosAtualizados++;
    }

    for (const p of selPed.atualizar) {
      const snap = (p.orcamento_snapshot || {}) as Record<string, unknown>;
      const itens = ((snap.itens_producao || []) as ItemParaRecalculo[]) ?? [];
      const precificacoes = await precificacoesDosItens(itens);
      const antes = recalcularItens(itens, precificacoes);
      if (antes.semMudanca) continue;

      const { novos, subtotal } = reprecificar(itens, precificacoes);
      const servicos = Number(snap.subtotal_servicos) || 0;
      const registro = registroDaPropagacao({
        precificacaoId,
        nomeProduto,
        valorAnterior: antes.totalAntes,
        valorNovo: antes.totalDepois,
        motivos: motivosDoProduto(itens, precificacoes, precificacaoId),
      });

      const campos = {
        orcamento_snapshot: {
          ...snap,
          itens_producao: novos,
          subtotal_producao: subtotal,
          valor_total: subtotal + servicos,
        } as never,
      };
      const historico = {
        historico_preco: [
          ...(Array.isArray(p.historico_preco) ? p.historico_preco : []),
          registro,
        ] as never,
      };

      let { error } = semHistorico
        ? await supabase.from('pedidos').update(campos).eq('id', p.id)
        : await supabase.from('pedidos').update({ ...campos, ...historico }).eq('id', p.id);
      if (error && colunaDeHistoricoFaltando(error)) {
        semHistorico = true;
        ({ error } = await supabase.from('pedidos').update(campos).eq('id', p.id));
      }
      if (error) throw error;
      pedidosAtualizados++;
    }

    if (orcamentosAtualizados || pedidosAtualizados) {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      invalidarCachesDaFormula(queryClient);
    }

    return {
      orcamentosAtualizados,
      pedidosAtualizados,
      travados: selOrc.travados.length + selPed.travados.length,
    };
  };

  return { propagar };
}
